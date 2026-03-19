import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";
import { Outreach, ClassifiedItem } from "@/lib/types";

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function gmailLink(messageId: string) {
  return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
}

async function classifyBatch(
  items: { subject: string; snippet: string; from: string; date: string; type: string; id: string }[],
  deepseekKey: string
): Promise<(ClassifiedItem & { sourceId: string })[]> {
  const prompt = `You are an extremely strict classifier. A startup founder (Sarthak) wants to track ONLY his direct investor outreach activity. You must reject anything that is not a 1-to-1 interaction.

INCLUDE only if it is one of these:
1. "outreach" — An email Sarthak SENT to an investor/VC/angel/fund (cold email, pitch deck, intro request). The "To" field should contain the investor, the "From" should be Sarthak.
2. "form_submission" — A PERSONAL confirmation that Sarthak's specific application was received (e.g., "We received YOUR application", "Thank you for applying"). NOT a generic "applications are open" blast.
3. "rejection" — A PERSONAL rejection addressed to Sarthak (e.g., "we're passing on your company", "not selected for interview"). NOT a generic announcement.
4. "ongoing_conversation" — A direct reply between Sarthak and a specific investor/person about fundraising (scheduling calls, deck feedback, follow-ups). Must be a real 1-to-1 or small group thread.

REJECT all of these (confidence 0):
- Newsletters, mass emails, marketing blasts, portfolio updates (even from real VCs like a16z, Sequoia)
- "Applications are now open" announcements — these are NOT form submissions
- Emails sent to a mailing list or large group
- Emails with "unsubscribe" links — these are newsletters
- Job postings, product updates, event invitations, webinars
- Calendar events that are webinars, group events, or internal meetings
- Any email where Sarthak is BCC'd or on a large recipient list

For each INCLUDED item return:
{"type": "outreach|form_submission|rejection|ongoing_conversation", "investor": "person name", "company": "fund/accelerator name", "stage": ["accelerator"] for accelerators or ["seed"] for VCs/funds, "notes": "one-line summary", "confidence": 0.0-1.0, "index": <the idx from input>}

Return: {"items": [...]}
If nothing qualifies, return: {"items": []}

Items:
${JSON.stringify(items.map((i, idx) => ({ idx, subject: i.subject, snippet: i.snippet?.slice(0, 200), from: i.from, date: i.date, type: i.type })))}`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.05,
      max_tokens: 4096,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Extract JSON from response
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  let parsed;
  try {
    parsed = JSON.parse(jsonStr.trim());
    if (parsed.items) parsed = parsed.items;
    else if (!Array.isArray(parsed)) parsed = [parsed];
  } catch {
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        parsed = JSON.parse(arrayMatch[0]);
      } catch {
        console.error("Failed to parse DeepSeek response:", content.slice(0, 500));
        return [];
      }
    } else {
      console.error("No JSON found in DeepSeek response:", content.slice(0, 500));
      return [];
    }
  }

  if (!Array.isArray(parsed)) parsed = [parsed];

  // Only accept high confidence items
  return parsed
    .filter((item: ClassifiedItem & { index: number }) => item.confidence >= 0.75)
    .map((item: ClassifiedItem & { index: number }) => ({
      ...item,
      sourceId: items[item.index]?.id || "",
    }));
}

async function classifyWithDeepSeek(
  items: { subject: string; snippet: string; from: string; date: string; type: string; id: string }[]
): Promise<(ClassifiedItem & { sourceId: string })[]> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey || items.length === 0) return [];

  const BATCH_SIZE = 15;
  const results: (ClassifiedItem & { sourceId: string })[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      const batchResults = await classifyBatch(batch, deepseekKey);
      results.push(...batchResults);
    } catch (error) {
      console.error(`DeepSeek batch ${i / BATCH_SIZE} error:`, error);
    }
  }

  return results;
}

async function fetchRecentEmails(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  // STEP 1: Find emails Sarthak SENT related to fundraising
  const sentQueries = [
    'newer_than:30d in:sent (pitch OR deck OR fundraise OR investment OR intro OR application)',
    'newer_than:30d in:sent (accelerator OR incubator OR "apply" OR "our startup")',
  ];

  const sentThreadIds = new Set<string>();
  const allMessages: { subject: string; snippet: string; from: string; date: string; type: string; id: string }[] = [];
  const seenIds = new Set<string>();

  // Collect thread IDs from sent emails
  for (const q of sentQueries) {
    try {
      const list = await gmail.users.messages.list({ userId: "me", q, maxResults: 40 });
      for (const msg of list.data.messages || []) {
        if (seenIds.has(msg.id!)) continue;
        seenIds.add(msg.id!);

        const full = await gmail.users.messages.get({
          userId: "me", id: msg.id!, format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date"],
        });

        sentThreadIds.add(full.data.threadId!);

        const headers = full.data.payload?.headers || [];
        allMessages.push({
          subject: headers.find((h) => h.name === "Subject")?.value || "",
          snippet: full.data.snippet || "",
          from: `From: ${headers.find((h) => h.name === "From")?.value || ""} | To: ${headers.find((h) => h.name === "To")?.value || ""}`,
          date: headers.find((h) => h.name === "Date")?.value || "",
          type: "email",
          id: msg.id!,
        });
      }
    } catch (error) {
      console.error("Gmail sent query error:", error);
    }
  }

  // STEP 2: Find replies in those threads (responses from investors)
  for (const threadId of sentThreadIds) {
    try {
      const thread = await gmail.users.threads.get({
        userId: "me", id: threadId, format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      });

      for (const msg of thread.data.messages || []) {
        if (seenIds.has(msg.id!)) continue;
        seenIds.add(msg.id!);

        const headers = msg.payload?.headers || [];
        const from = headers.find((h) => h.name === "From")?.value || "";

        // Skip our own messages (already captured above)
        if (from.toLowerCase().includes("sarthak") || from.toLowerCase().includes("influencergarage")) continue;

        allMessages.push({
          subject: headers.find((h) => h.name === "Subject")?.value || "",
          snippet: msg.snippet || "",
          from: `From: ${from} | To: ${headers.find((h) => h.name === "To")?.value || ""}`,
          date: headers.find((h) => h.name === "Date")?.value || "",
          type: "email",
          id: msg.id!,
        });
      }
    } catch (error) {
      console.error("Thread fetch error:", error);
    }
  }

  // STEP 3: Personal accelerator confirmations & rejections (not from threads we initiated)
  const directQueries = [
    'newer_than:30d -category:promotions -category:social to:me (subject:("your application" OR "we received your" OR "thank you for applying") -subject:re:)',
    'newer_than:30d -category:promotions -category:social to:me (subject:("not selected" OR "not moving forward" OR "passing on" OR "decided not to") -subject:re:)',
  ];

  for (const q of directQueries) {
    try {
      const list = await gmail.users.messages.list({ userId: "me", q, maxResults: 20 });
      for (const msg of list.data.messages || []) {
        if (seenIds.has(msg.id!)) continue;
        seenIds.add(msg.id!);

        const full = await gmail.users.messages.get({
          userId: "me", id: msg.id!, format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date", "List-Unsubscribe"],
        });

        const headers = full.data.payload?.headers || [];

        // Hard skip if List-Unsubscribe header exists — it's a mailing list
        if (headers.find((h) => h.name === "List-Unsubscribe")) continue;

        allMessages.push({
          subject: headers.find((h) => h.name === "Subject")?.value || "",
          snippet: full.data.snippet || "",
          from: `From: ${headers.find((h) => h.name === "From")?.value || ""} | To: ${headers.find((h) => h.name === "To")?.value || ""}`,
          date: headers.find((h) => h.name === "Date")?.value || "",
          type: "email",
          id: msg.id!,
        });
      }
    } catch (error) {
      console.error("Gmail direct query error:", error);
    }
  }

  return allMessages;
}

async function fetchRecentCalendarEvents(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const events = await calendar.events.list({
      calendarId: "primary",
      timeMin: thirtyDaysAgo.toISOString(),
      timeMax: weekAhead.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    return (events.data.items || []).map((event) => ({
      subject: event.summary || "",
      snippet: event.description || "",
      from: (event.attendees || []).map((a) => `${a.displayName || ""} <${a.email}>`).join(", "),
      date: event.start?.dateTime || event.start?.date || "",
      type: "calendar",
      id: event.id!,
    }));
  } catch (error) {
    console.error("Calendar fetch error:", error);
    return [];
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as unknown as Record<string, unknown>).accessToken as string;
  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const existingSourceIds: string[] = body.existingSourceIds || [];
  const existingSourceIdSet = new Set(existingSourceIds);

  try {
    const [emails, calendarEvents] = await Promise.all([
      fetchRecentEmails(accessToken),
      fetchRecentCalendarEvents(accessToken),
    ]);

    // Filter out already-tracked items
    const newItems = [...emails, ...calendarEvents].filter((item) => !existingSourceIdSet.has(item.id));

    if (newItems.length === 0) {
      return NextResponse.json({ newOutreaches: [], updatedCount: 0, errors: [], totalScanned: 0 });
    }

    // Classify with DeepSeek
    const classified = await classifyWithDeepSeek(newItems);

    // Convert to outreach entries
    const today = new Date().toISOString().split("T")[0];
    const newOutreaches: Outreach[] = classified.map((item) => {
      const sourceItem = newItems.find((n) => n.id === item.sourceId);
      const itemDate = sourceItem?.date ? new Date(sourceItem.date).toISOString().split("T")[0] : today;
      const isEmail = sourceItem?.type === "email";

      // Map classification type to source and status
      let source: Outreach["source"] = "email";
      let status: string[] = ["ongoing"];
      if (item.type === "investor_meeting" as string) source = "calendar";
      else if (item.type === "form_submission" as string) source = "accelerator";
      if (item.type === "rejection" as string) status = ["rejected"];

      // Normalize stage
      let stage = item.stage || [];
      if (typeof stage === "string") stage = [stage];
      if (!Array.isArray(stage)) stage = [];

      return {
        id: generateId(),
        investor: item.investor || "Unknown",
        company: item.company || "",
        stage,
        contactMethod: isEmail ? ["email"] : ["other"],
        status,
        outreachDate: itemDate,
        followupDate: "",
        notes: item.notes || "",
        dateAdded: today,
        source,
        sourceId: item.sourceId,
        emailLink: isEmail ? gmailLink(item.sourceId) : undefined,
      };
    });

    return NextResponse.json({
      newOutreaches,
      updatedCount: newOutreaches.length,
      errors: [],
      totalScanned: newItems.length,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { newOutreaches: [], updatedCount: 0, errors: [(error as Error).message] },
      { status: 500 }
    );
  }
}

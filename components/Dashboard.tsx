"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Outreach, Settings } from "@/lib/types";

const STORAGE_KEY = "outreach-tracker-v2";
const SETTINGS_KEY = "outreach-settings-v2";
const LAST_SYNC_KEY = "outreach-last-sync";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function makeTodo(investor: string, company: string, priority: "high" | "moderate" | "low", stage: string[] = ["seed"]): Outreach {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    investor,
    company,
    stage,
    contactMethod: [],
    status: ["todo"],
    outreachDate: "",
    followupDate: "",
    notes: "",
    dateAdded: "2026-03-19",
    source: "manual",
    priority,
  };
}

const SEED_DATA: Outreach[] = [
  // Existing outreaches
  {
    id: "ml3ts1i1z0g0appubob", investor: "Sonic", company: "Chiratae", stage: ["seed"],
    contactMethod: ["other"], status: ["ongoing"], outreachDate: "2026-02-01",
    followupDate: "2026-02-05", notes: "Submitted sonic form", dateAdded: "2026-02-01", source: "manual",
  },
  {
    id: "ml3tsjtb3na7p2zd2dk", investor: "Thomas", company: "", stage: ["angel"],
    contactMethod: ["other"], status: ["ongoing"], outreachDate: "2026-02-01",
    followupDate: "2026-02-04", notes: "Met in person, follow up", dateAdded: "2026-02-01", source: "manual",
  },
  {
    id: "ml3tuel4u3igjdejobi", investor: "Nitesh", company: "", stage: ["angel"],
    contactMethod: ["warm-intro"], status: [], outreachDate: "2026-01-31",
    followupDate: "2026-02-05", notes: "Ping him with a note, deck - or in person meeting", dateAdded: "2026-02-01", source: "manual",
  },
  // High confidence targets
  makeTodo("Y Combinator", "Y Combinator", "high", ["accelerator"]),
  makeTodo("a16z", "Andreessen Horowitz", "high", ["seed"]),
  makeTodo("Sequoia Capital", "Sequoia Capital", "high", ["seed"]),
  makeTodo("LDV Capital", "LDV Capital", "high", ["seed"]),
  makeTodo("DCVC", "Data Collective", "high", ["seed"]),
  makeTodo("F2 Venture Capital", "F2 Venture Capital", "high", ["seed"]),
  makeTodo("Fly Ventures", "Fly Ventures", "high", ["seed"]),
  makeTodo("Founders Fund", "Founders Fund", "high", ["seed"]),
  makeTodo("DTC", "DTC", "high", ["seed"]),
  // Moderate confidence targets
  makeTodo("Bloomberg Beta", "Bloomberg Beta", "moderate", ["seed"]),
  makeTodo("Breyer Capital", "Breyer Capital", "moderate", ["seed"]),
  makeTodo("In-Q-Tel", "In-Q-Tel", "moderate", ["seed"]),
  makeTodo("M12", "Microsoft Ventures", "moderate", ["seed"]),
  makeTodo("NVIDIA NVentures", "NVIDIA NVentures", "moderate", ["seed"]),
  makeTodo("Qualcomm Ventures", "Qualcomm Ventures", "moderate", ["seed"]),
  makeTodo("Pi Ventures", "Pi Ventures", "moderate", ["seed"]),
  makeTodo("Radical Ventures", "Radical Ventures", "moderate", ["seed"]),
  makeTodo("Air Street Capital", "Air Street Capital", "moderate", ["seed"]),
  makeTodo("Lux Capital", "Lux Capital", "moderate", ["seed"]),
  makeTodo("Playground Global", "Playground Global", "moderate", ["seed"]),
  // Lower confidence targets
  ...["Khosla Ventures", "Bessemer", "Coatue", "General Catalyst", "Greylock", "Madrona",
    "Felicis", "Wing VC", "Amplify Partners", "Theory Ventures", "Gradient Ventures",
    "Samsung Next", "Intel Capital"].map((name) => makeTodo(name, name, "low", ["seed"])),
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

function loadOutreaches(): Outreach[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
    return SEED_DATA;
  }
  return JSON.parse(data);
}

function saveOutreaches(outreaches: Outreach[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(outreaches));
}

function loadSettings(): Settings {
  if (typeof window === "undefined") return { dailyTarget: 5, weeklyTarget: 25 };
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : { dailyTarget: 5, weeklyTarget: 25 };
}

function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const SOURCE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  manual: { icon: "✏️", label: "Manual", color: "border-l-slate-400" },
  email: { icon: "📧", label: "Email", color: "border-l-violet-400" },
  calendar: { icon: "📅", label: "Calendar", color: "border-l-teal-400" },
  accelerator: { icon: "📋", label: "Form", color: "border-l-amber-400" },
};

const STAGE_COLORS: Record<string, string> = {
  angel: "bg-violet-50 text-violet-600 border border-violet-200",
  seed: "bg-teal-50 text-teal-600 border border-teal-200",
  "series-a": "bg-blue-50 text-blue-600 border border-blue-200",
  "series-b": "bg-indigo-50 text-indigo-600 border border-indigo-200",
  accelerator: "bg-amber-50 text-amber-600 border border-amber-200",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-sky-50 text-sky-600 border border-sky-200",
  ongoing: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  holdoff: "bg-orange-50 text-orange-600 border border-orange-200",
  rejected: "bg-rose-50 text-rose-500 border border-rose-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-rose-50 text-rose-600 border border-rose-200",
  moderate: "bg-amber-50 text-amber-600 border border-amber-200",
  low: "bg-slate-50 text-slate-500 border border-slate-200",
};

const STAT_ACCENTS = [
  "border-l-violet-400",
  "border-l-teal-400",
  "border-l-sky-400",
  "border-l-amber-400",
  "border-l-purple-400",
  "border-l-cyan-400",
  "border-l-orange-400",
];

export default function Dashboard() {
  const { data: session } = useSession();
  const [outreaches, setOutreaches] = useState<Outreach[]>([]);
  const [settings, setSettingsState] = useState<Settings>({ dailyTarget: 5, weeklyTarget: 25 });
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set(["manual", "email", "calendar", "accelerator"]));
  const [sortBy, setSortBy] = useState("recent");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSynced, setLastSynced] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPriority, setBulkPriority] = useState<"high" | "moderate" | "low">("high");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    investor: "",
    company: "",
    stage: [] as string[],
    contactMethod: [] as string[],
    status: [] as string[],
    outreachDate: getToday(),
    followupDate: "",
    notes: "",
  });

  useEffect(() => {
    setOutreaches(loadOutreaches());
    setSettingsState(loadSettings());
    const ls = localStorage.getItem(LAST_SYNC_KEY);
    if (ls) setLastSynced(new Date(parseInt(ls)).toLocaleString());
  }, []);

  // Auto-sync every 24 hours
  const handleSyncRef = useCallback(async () => {
    if (syncing) return;
    await handleSync();
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing, outreaches]);

  useEffect(() => {
    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) || "0");
    const timeSinceSync = Date.now() - lastSync;

    // Auto-sync on first load if never synced, or if 24h have passed
    if (lastSync === 0 || timeSinceSync >= SYNC_INTERVAL_MS) {
      const timer = setTimeout(() => handleSyncRef(), 2000); // slight delay after mount
      return () => clearTimeout(timer);
    }

    // Schedule next sync for when 24h will have passed
    const nextSyncIn = SYNC_INTERVAL_MS - timeSinceSync;
    const timer = setTimeout(() => handleSyncRef(), nextSyncIn);
    return () => clearTimeout(timer);
  }, [handleSyncRef]);

  const persist = useCallback((updated: Outreach[]) => {
    setOutreaches(updated);
    saveOutreaches(updated);
  }, []);

  // Stats
  const today = getToday();
  const weekStart = getWeekStart();
  const todayCount = outreaches.filter((o) => o.dateAdded === today).length;
  const weekCount = outreaches.filter((o) => o.dateAdded >= weekStart).length;
  const totalDays = new Set(outreaches.map((o) => o.dateAdded)).size;
  const avgDaily = totalDays > 0 ? (outreaches.length / totalDays).toFixed(1) : "0";

  // Source breakdown
  const emailCount = outreaches.filter((o) => o.source === "email").length;
  const calendarCount = outreaches.filter((o) => o.source === "calendar").length;
  const acceleratorCount = outreaches.filter((o) => o.source === "accelerator").length;

  // Follow-up reminders
  const overdueFollowups = outreaches.filter(
    (o) => o.followupDate && o.followupDate < today && !o.status.includes("rejected")
  );
  const upcomingFollowups = outreaches.filter(
    (o) => o.followupDate && o.followupDate >= today && o.followupDate <= new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0] && !o.status.includes("rejected")
  );

  // Filtered & sorted outreaches
  const filtered = useMemo(() => {
    let list = [...outreaches];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.investor.toLowerCase().includes(q) ||
          o.company.toLowerCase().includes(q) ||
          o.notes.toLowerCase().includes(q)
      );
    }
    if (filterStage) list = list.filter((o) => (Array.isArray(o.stage) ? o.stage : []).includes(filterStage));
    if (filterStatus) list = list.filter((o) => (Array.isArray(o.status) ? o.status : []).includes(filterStatus));
    // Source filter — show if ANY of the entry's sources are selected
    if (filterSources.size < 4) {
      list = list.filter((o) => {
        const srcs = o.sources && o.sources.length > 0 ? o.sources : [o.source];
        return srcs.some((s) => filterSources.has(s));
      });
    }

    switch (sortBy) {
      case "recent":
        list.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
        break;
      case "date-asc":
        list.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
        break;
      case "followup":
        list.sort((a, b) => (a.followupDate || "z").localeCompare(b.followupDate || "z"));
        break;
      case "investor":
        list.sort((a, b) => a.investor.localeCompare(b.investor));
        break;
    }

    return list;
  }, [outreaches, search, filterStage, filterStatus, filterSources, sortBy]);

  // Chart data — last 30 days
  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().split("T")[0]] = 0;
    }
    outreaches.forEach((o) => {
      if (days[o.dateAdded] !== undefined) days[o.dateAdded]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [outreaches]);

  const maxChart = Math.max(settings.dailyTarget, ...chartData.map((d) => d.count), 1);

  // Sync
  async function handleSync() {
    setSyncing(true);
    setSyncMessage("Scanning emails and calendar...");
    try {
      const existingSourceIds = outreaches.filter((o) => o.sourceId).map((o) => o.sourceId!);
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingSourceIds }),
      });
      const data = await res.json();

      if (data.error) {
        setSyncMessage(`Error: ${data.error}`);
        return;
      }

      if (data.newOutreaches.length > 0) {
        let updated = [...outreaches];
        let newCount = 0;
        let mergedCount = 0;

        for (const rawO of data.newOutreaches as Outreach[]) {
          const newO = {
            ...rawO,
            stage: Array.isArray(rawO.stage) ? rawO.stage : typeof rawO.stage === "string" ? [rawO.stage] : [],
            status: Array.isArray(rawO.status) ? rawO.status : typeof rawO.status === "string" ? [rawO.status] : [],
            contactMethod: Array.isArray(rawO.contactMethod) ? rawO.contactMethod : typeof rawO.contactMethod === "string" ? [rawO.contactMethod] : [],
          };

          // Match by investor name OR company name (fuzzy — case insensitive, partial match)
          const investorLower = newO.investor.toLowerCase();
          const companyLower = newO.company.toLowerCase();
          const existing = updated.find((o) => {
            const oInv = o.investor.toLowerCase();
            const oCo = o.company.toLowerCase();
            return (
              (investorLower && oInv && (oInv.includes(investorLower) || investorLower.includes(oInv))) ||
              (companyLower && oCo && (oCo.includes(companyLower) || companyLower.includes(oCo)))
            );
          });

          if (existing) {
            existing.threadCount = (existing.threadCount || 1) + 1;
            // Track all sources
            const srcSet = new Set(existing.sources || [existing.source]);
            srcSet.add(newO.source);
            existing.sources = [...srcSet];
            // Collect email links
            if (newO.emailLink) {
              existing.emailLinks = [...(existing.emailLinks || (existing.emailLink ? [existing.emailLink] : [])), newO.emailLink];
            }
            // Append notes if different
            if (newO.notes && !existing.notes.includes(newO.notes)) {
              existing.notes = existing.notes ? `${existing.notes} | ${newO.notes}` : newO.notes;
            }
            // Upgrade todo → ongoing
            if (existing.status.includes("todo")) {
              existing.status = ["ongoing"];
              existing.outreachDate = existing.outreachDate || newO.outreachDate;
            }
            if (newO.status.includes("rejected")) {
              existing.status = ["rejected"];
            }
            mergedCount++;
          } else {
            updated.push({
              ...newO,
              threadCount: 1,
              sources: [newO.source],
              emailLinks: newO.emailLink ? [newO.emailLink] : [],
            });
            newCount++;
          }
        }

        persist(updated);
        const parts = [];
        if (newCount > 0) parts.push(`${newCount} new`);
        if (mergedCount > 0) parts.push(`${mergedCount} merged`);
        setSyncMessage(`${parts.join(", ")} (scanned ${data.totalScanned})`);
      } else {
        setSyncMessage(`No new items found (scanned ${data.totalScanned || 0} items)`);
      }
    } catch (err) {
      setSyncMessage(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      setLastSynced(new Date().toLocaleString());
      setTimeout(() => setSyncMessage(""), 5000);
    }
  }

  // CRUD
  function openAdd() {
    setEditId(null);
    setForm({
      investor: "",
      company: "",
      stage: [],
      contactMethod: [],
      status: [],
      outreachDate: getToday(),
      followupDate: "",
      notes: "",
    });
    setShowModal(true);
  }

  function openEdit(o: Outreach) {
    setEditId(o.id);
    setForm({
      investor: o.investor,
      company: o.company,
      stage: [...o.stage],
      contactMethod: [...o.contactMethod],
      status: [...o.status],
      outreachDate: o.outreachDate,
      followupDate: o.followupDate,
      notes: o.notes,
    });
    setShowModal(true);
  }

  function handleSave() {
    if (!form.investor.trim()) return;

    if (editId) {
      const updated = outreaches.map((o) =>
        o.id === editId ? { ...o, ...form } : o
      );
      persist(updated);
    } else {
      const newOutreach: Outreach = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        ...form,
        dateAdded: getToday(),
        source: "manual",
      };
      persist([...outreaches, newOutreach]);
    }
    setShowModal(false);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this outreach?")) {
      persist(outreaches.filter((o) => o.id !== id));
    }
  }

  function handleExport() {
    const data = JSON.stringify({ outreaches, settings, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-backup-${getToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.outreaches) {
          const imported = data.outreaches.map((o: Outreach) => ({
            ...o,
            source: o.source || "manual",
          }));
          persist(imported);
          if (data.settings) {
            setSettingsState(data.settings);
            saveSettings(data.settings);
          }
          alert(`Imported ${imported.length} outreaches`);
        }
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleBulkAdd() {
    if (!bulkText.trim()) return;
    // Split by newline or comma
    const names = bulkText
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const today = getToday();
    const newEntries: Outreach[] = names.map((name) => ({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      investor: name,
      company: name,
      stage: ["seed"],
      contactMethod: [],
      status: ["todo"],
      outreachDate: "",
      followupDate: "",
      notes: "",
      dateAdded: today,
      source: "manual" as const,
      priority: bulkPriority,
    }));

    // Avoid duplicates
    const existingNames = new Set(outreaches.map((o) => o.investor.toLowerCase()));
    const unique = newEntries.filter((e) => !existingNames.has(e.investor.toLowerCase()));

    if (unique.length > 0) {
      persist([...outreaches, ...unique]);
    }
    setShowBulkAdd(false);
    setBulkText("");
    if (unique.length < names.length) {
      setSyncMessage(`Added ${unique.length} new targets (${names.length - unique.length} already existed)`);
    } else {
      setSyncMessage(`Added ${unique.length} new targets`);
    }
    setTimeout(() => setSyncMessage(""), 4000);
  }

  function toggleArrayItem(arr: string[], item: string) {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  }

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Top bar */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Outreach Tracker</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {session?.user?.email}
              {lastSynced && <span className="ml-2 text-slate-300">· Last sync: {lastSynced}</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-violet-200 transition-all"
            >
              {syncing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              )}
              {syncing ? "Syncing..." : "Sync"}
            </button>
            <button onClick={openAdd} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 shadow-sm shadow-teal-200 transition-all">
              + Add
            </button>
            <button onClick={() => setShowBulkAdd(true)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-all">
              Bulk Add
            </button>
            <button onClick={() => setShowSettings(true)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </button>
            <button onClick={() => signOut()} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {syncMessage && (
          <div className={`mb-5 p-3.5 rounded-xl text-sm font-medium ${syncMessage.startsWith("Error") || syncMessage.startsWith("Sync failed") ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-violet-50 text-violet-600 border border-violet-200"}`}>
            {syncMessage}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            { label: "Total", value: outreaches.length },
            { label: "Today", value: todayCount, target: settings.dailyTarget },
            { label: "This Week", value: weekCount, target: settings.weeklyTarget },
            { label: "Daily Avg", value: avgDaily },
            { label: "From Email", value: emailCount },
            { label: "Calendar", value: calendarCount },
            { label: "Accelerators", value: acceleratorCount },
          ].map((stat, i) => (
            <div key={stat.label} className={`bg-white rounded-2xl p-4 border-l-4 ${STAT_ACCENTS[i]} shadow-sm`}>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">{stat.label}</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</div>
              {stat.target && <div className="text-[11px] text-slate-400 mt-0.5">/ {stat.target} target</div>}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Last 30 Days</h2>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Hit target</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-300" /> Below</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-[2px] bg-rose-300 rounded" /> Target ({settings.dailyTarget})</span>
            </div>
          </div>
          <div className="relative">
            {/* Target line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-rose-200 z-10 pointer-events-none"
              style={{ bottom: `${(settings.dailyTarget / maxChart) * 140 + 8}px` }}
            />
            <div className="flex items-end gap-[3px] h-44">
              {chartData.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-8 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-20 shadow-lg transition-opacity">
                    {d.date.slice(5)}: {d.count} outreach{d.count !== 1 ? "es" : ""}
                  </div>
                  <div
                    className={`w-full rounded-md transition-all duration-300 ${d.count >= settings.dailyTarget ? "bg-gradient-to-t from-violet-400 to-violet-300" : d.count > 0 ? "bg-gradient-to-t from-teal-300 to-teal-200" : "bg-slate-100"}`}
                    style={{ height: `${Math.max((d.count / maxChart) * 140, 3)}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Follow-up Reminders */}
        {(overdueFollowups.length > 0 || upcomingFollowups.length > 0) && (
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Follow-up Reminders</h2>
            {overdueFollowups.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-rose-500 text-xs font-semibold">{overdueFollowups.length} overdue</span>
              </div>
            )}
            <div className="space-y-2">
              {[...overdueFollowups, ...upcomingFollowups].slice(0, 8).map((o) => (
                <div
                  key={o.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border-l-4 ${o.followupDate < today ? "border-l-rose-400 bg-rose-50/50" : "border-l-amber-400 bg-amber-50/50"}`}
                >
                  <div>
                    <div className="font-medium text-sm text-slate-700">{o.investor} {o.company && <span className="text-slate-400">· {o.company}</span>}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{o.notes}</div>
                  </div>
                  <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${o.followupDate < today ? "bg-rose-100 text-rose-500" : "bg-amber-100 text-amber-600"}`}>
                    {o.followupDate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters & Table */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">All Outreaches</h2>
            <div className="ml-auto relative">
              <svg className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input
                type="text"
                placeholder="Search investors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all bg-slate-50/50 placeholder:text-slate-300"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { value: sortBy, setter: setSortBy, options: [["recent", "Recent first"], ["date-asc", "Oldest first"], ["followup", "Follow-up date"], ["investor", "Name A-Z"]] },
              { value: filterStage, setter: setFilterStage, options: [["", "All Stages"], ["angel", "Angel"], ["seed", "Seed"], ["series-a", "Series A"], ["accelerator", "Accelerator"]] },
              { value: filterStatus, setter: setFilterStatus, options: [["", "All Statuses"], ["todo", "ToDo"], ["ongoing", "Ongoing"], ["holdoff", "Hold off"], ["rejected", "Rejected"]] },
            ].map((f, i) => (
              <select
                key={i}
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all cursor-pointer"
              >
                {f.options.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            ))}
            <div className="flex items-center gap-1 ml-1">
              {(["manual", "email", "calendar", "accelerator"] as const).map((s) => {
                const src = SOURCE_ICONS[s];
                const active = filterSources.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => {
                      const next = new Set(filterSources);
                      if (active) next.delete(s); else next.add(s);
                      setFilterSources(next);
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${active ? "bg-violet-50 border-violet-200 text-violet-600" : "bg-white border-slate-200 text-slate-300"}`}
                    title={src.label}
                  >
                    <span>{src.icon}</span>
                    <span className="hidden sm:inline">{src.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Source", "Investor", "Company", "Stage", "Priority", "Status", "Threads", "Date", "Notes", ""].map((h) => (
                    <th key={h} className="text-left p-3 text-[11px] text-slate-400 uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const allSources = o.sources && o.sources.length > 0 ? o.sources : [o.source];
                  const primarySrc = SOURCE_ICONS[allSources[0]] || SOURCE_ICONS.manual;
                  return (
                    <tr key={o.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors border-l-4 ${primarySrc.color}`}>
                      <td className="p-3">
                        <div className="flex gap-0.5" title={allSources.map(s => SOURCE_ICONS[s]?.label || s).join(" + ")}>
                          {[...new Set(allSources)].map((s) => (
                            <span key={s} className="text-sm">{SOURCE_ICONS[s]?.icon || "✏️"}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{o.investor}</td>
                      <td className="p-3 text-slate-400">{o.company || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(o.stage) ? o.stage : typeof o.stage === "string" ? [o.stage] : []).map((s) => (
                            <span key={s} className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${STAGE_COLORS[s] || "bg-slate-50 text-slate-500 border border-slate-200"}`}>{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        {o.priority && (
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${PRIORITY_COLORS[o.priority] || ""}`}>{o.priority}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(o.status) ? o.status : typeof o.status === "string" ? [o.status] : []).map((s) => (
                            <span key={s} className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[s] || "bg-slate-50 text-slate-500 border border-slate-200"}`}>{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {(o.threadCount || 0) > 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-[11px] font-bold">{o.threadCount}</span>
                        ) : (o.threadCount === 1 ? (
                          <span className="text-slate-300 text-xs">1</span>
                        ) : (
                          <span className="text-slate-200 text-xs">—</span>
                        ))}
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap text-xs">{o.outreachDate || "—"}</td>
                      <td className="p-3 text-slate-400 max-w-[220px] text-xs">
                        <div className="truncate">{o.notes || "—"}</div>
                        {/* Email links */}
                        {(o.emailLinks && o.emailLinks.length > 0) ? (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {o.emailLinks.map((link, i) => (
                              <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-600 text-[10px] font-medium inline-flex items-center gap-0.5">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                email {i + 1}
                              </a>
                            ))}
                          </div>
                        ) : o.emailLink ? (
                          <a href={o.emailLink} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-600 text-[10px] font-medium mt-0.5 inline-flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            Open in Gmail
                          </a>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(o)} className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-violet-50 hover:border-violet-200 hover:text-violet-500 text-slate-400 text-xs transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button onClick={() => handleDelete(o.id)} className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 text-slate-400 text-xs transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                {outreaches.length === 0 ? (
                  <div>
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="font-medium text-slate-600 mb-1">No outreaches yet</p>
                    <p className="text-sm">Click &quot;+ Add&quot; or &quot;Sync&quot; to get started</p>
                  </div>
                ) : (
                  <p className="text-sm">No outreaches match your filters</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800 mb-5">{editId ? "Edit Outreach" : "Add Outreach"}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Investor Name</label>
                  <input value={form.investor} onChange={(e) => setForm({ ...form, investor: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" placeholder="Name..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Company</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" placeholder="Fund / Company..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Stage</label>
                <div className="flex flex-wrap gap-2">
                  {["angel", "seed", "series-a", "series-b", "accelerator"].map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, stage: toggleArrayItem(form.stage, s) })} className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.stage.includes(s) ? "bg-violet-500 text-white border-violet-500 shadow-sm shadow-violet-200" : "bg-white border-slate-200 text-slate-500 hover:border-violet-200 hover:text-violet-500"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Contact Method</label>
                <div className="flex flex-wrap gap-2">
                  {["email", "linkedin", "warm-intro", "cold-call", "other"].map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, contactMethod: toggleArrayItem(form.contactMethod, s) })} className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.contactMethod.includes(s) ? "bg-teal-500 text-white border-teal-500 shadow-sm shadow-teal-200" : "bg-white border-slate-200 text-slate-500 hover:border-teal-200 hover:text-teal-500"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Status</label>
                <div className="flex flex-wrap gap-2">
                  {["todo", "ongoing", "holdoff", "rejected"].map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, status: toggleArrayItem(form.status, s) })} className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.status.includes(s) ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200" : "bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-500"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Outreach Date</label>
                  <input type="date" value={form.outreachDate} onChange={(e) => setForm({ ...form, outreachDate: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Follow-up Date</label>
                  <input type="date" value={form.followupDate} onChange={(e) => setForm({ ...form, followupDate: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" placeholder="Add notes, links..." />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={handleSave} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 shadow-sm shadow-violet-200 transition-all">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800 mb-5">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Daily Target</label>
                <input type="number" value={settings.dailyTarget} onChange={(e) => setSettingsState({ ...settings, dailyTarget: parseInt(e.target.value) || 5 })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Weekly Target</label>
                <input type="number" value={settings.weeklyTarget} onChange={(e) => setSettingsState({ ...settings, weeklyTarget: parseInt(e.target.value) || 25 })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Data</label>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleExport} className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-all">Export JSON</button>
                  <label className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-all cursor-pointer text-center">
                    Import JSON
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                  <button onClick={() => { if (confirm("Clear all data?")) { persist([]); setShowSettings(false); } }} className="px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-500 hover:bg-rose-100 transition-all">Clear</button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button onClick={() => setShowSettings(false)} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={() => { saveSettings(settings); setShowSettings(false); }} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 shadow-sm shadow-violet-200 transition-all">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBulkAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Bulk Add Targets</h2>
            <p className="text-xs text-slate-400 mb-4">Paste investor/accelerator names — one per line or comma-separated. They&apos;ll be added as &quot;ToDo&quot;.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Priority</label>
                <div className="flex gap-2">
                  {(["high", "moderate", "low"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setBulkPriority(p)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${bulkPriority === p ? (p === "high" ? "bg-rose-500 text-white border-rose-500" : p === "moderate" ? "bg-amber-500 text-white border-amber-500" : "bg-slate-500 text-white border-slate-500") : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Names</label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={8}
                  placeholder={"Y Combinator\na16z\nSequoia Capital\n\nor: Y Combinator, a16z, Sequoia Capital"}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all font-mono"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  {bulkText.trim() ? `${bulkText.split(/[,\n]/).map((n) => n.trim()).filter((n) => n).length} names detected` : ""}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowBulkAdd(false)} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={handleBulkAdd} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 shadow-sm shadow-violet-200 transition-all">
                  Add All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { CompanyOutreach, Settings } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const SETTINGS_KEY = "outreach-settings-v2";

function normalizeCompanyKey(name: string): string {
  return name.toLowerCase().split(/[|,&]/).map((p) => p.trim()).filter((p) => p.length > 0).sort().join("|");
}

function makeTodo(company: string, priority: "high" | "moderate" | "low", stage: string = "seed"): CompanyOutreach {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    company, companyKey: normalizeCompanyKey(company), contacts: [],
    stage, status: "todo", sources: ["manual"], sourceIds: [], emailLinks: [],
    threadCount: 0, outreachDate: "", followupDate: "", notes: "", dateAdded: "2026-03-19", priority,
  };
}

const SEED_DATA: CompanyOutreach[] = [
  {
    id: "ml3ts1i1z0g0appubob", company: "Chiratae", companyKey: "chiratae",
    contacts: [{ name: "Sonic" }], stage: "seed", status: "ongoing",
    sources: ["manual"], sourceIds: [], emailLinks: [], threadCount: 1,
    outreachDate: "2026-02-01", followupDate: "2026-02-05",
    notes: "Submitted sonic form", dateAdded: "2026-02-01",
  },
  {
    id: "ml3tsjtb3na7p2zd2dk", company: "Angel", companyKey: "angel",
    contacts: [{ name: "Thomas" }], stage: "angel", status: "ongoing",
    sources: ["manual"], sourceIds: [], emailLinks: [], threadCount: 1,
    outreachDate: "2026-02-01", followupDate: "2026-02-04",
    notes: "Met in person, follow up", dateAdded: "2026-02-01",
  },
  {
    id: "ml3tuel4u3igjdejobi", company: "Angel", companyKey: "angel",
    contacts: [{ name: "Nitesh" }], stage: "angel", status: "ongoing",
    sources: ["manual"], sourceIds: [], emailLinks: [], threadCount: 0,
    outreachDate: "2026-01-31", followupDate: "2026-02-05",
    notes: "Ping him with a note, deck - or in person meeting", dateAdded: "2026-02-01",
  },
  makeTodo("Y Combinator", "high", "accelerator"),
  makeTodo("Andreessen Horowitz", "high"), makeTodo("Sequoia Capital", "high"),
  makeTodo("LDV Capital", "high"), makeTodo("Data Collective", "high"),
  makeTodo("F2 Venture Capital", "high"), makeTodo("Fly Ventures", "high"),
  makeTodo("Founders Fund", "high"), makeTodo("DTC", "high"),
  makeTodo("Bloomberg Beta", "moderate"), makeTodo("Breyer Capital", "moderate"),
  makeTodo("In-Q-Tel", "moderate"), makeTodo("Microsoft Ventures", "moderate"),
  makeTodo("NVIDIA NVentures", "moderate"), makeTodo("Qualcomm Ventures", "moderate"),
  makeTodo("Pi Ventures", "moderate"), makeTodo("Radical Ventures", "moderate"),
  makeTodo("Air Street Capital", "moderate"), makeTodo("Lux Capital", "moderate"),
  makeTodo("Playground Global", "moderate"),
  ...["Khosla Ventures", "Bessemer", "Coatue", "General Catalyst", "Greylock", "Madrona",
    "Felicis", "Wing VC", "Amplify Partners", "Theory Ventures", "Gradient Ventures",
    "Samsung Next", "Intel Capital"].map((name) => makeTodo(name, "low")),
];

function getToday() { return new Date().toISOString().split("T")[0]; }
function getWeekStart() { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split("T")[0]; }

interface OldOutreach {
  id: string; investor: string; company: string; stage: string[]; contactMethod: string[];
  status: string[]; outreachDate: string; followupDate: string; notes: string; dateAdded: string;
  source: string; sources?: string[]; sourceId?: string; emailLink?: string; emailLinks?: string[];
  threadCount?: number; priority?: "high" | "moderate" | "low";
}

function migrateV2ToV3(old: OldOutreach[]): CompanyOutreach[] {
  return old.map((o) => ({
    id: o.id, company: o.company || o.investor, companyKey: normalizeCompanyKey(o.company || o.investor),
    contacts: o.investor ? [{ name: o.investor }] : [],
    stage: Array.isArray(o.stage) ? (o.stage[0] || "seed") : (typeof o.stage === "string" ? o.stage : "seed"),
    status: Array.isArray(o.status) ? (o.status[0] || "todo") : (typeof o.status === "string" ? o.status : "todo"),
    sources: o.sources || [o.source || "manual"], sourceIds: o.sourceId ? [o.sourceId] : [],
    emailLinks: o.emailLinks || (o.emailLink ? [o.emailLink] : []), threadCount: o.threadCount || 0,
    priority: o.priority, notes: o.notes || "", outreachDate: o.outreachDate || "",
    followupDate: o.followupDate || "", dateAdded: o.dateAdded || getToday(),
  }));
}

// Supabase row → CompanyOutreach
function rowToOutreach(r: Record<string, unknown>): CompanyOutreach {
  return {
    id: r.id as string, company: r.company as string, companyKey: r.company_key as string,
    contacts: (r.contacts || []) as CompanyOutreach["contacts"],
    stage: (r.stage || "seed") as string, status: (r.status || "todo") as string,
    sources: (r.sources || ["manual"]) as string[], sourceIds: (r.source_ids || []) as string[],
    emailLinks: (r.email_links || []) as string[], threadCount: (r.thread_count || 0) as number,
    priority: r.priority as CompanyOutreach["priority"], notes: (r.notes || "") as string,
    outreachDate: (r.outreach_date || "") as string, followupDate: (r.followup_date || "") as string,
    dateAdded: (r.date_added || "") as string,
  };
}

// CompanyOutreach → Supabase row
function outreachToRow(o: CompanyOutreach) {
  return {
    id: o.id, company: o.company, company_key: o.companyKey, contacts: o.contacts,
    stage: o.stage, status: o.status, sources: o.sources, source_ids: o.sourceIds,
    email_links: o.emailLinks, thread_count: o.threadCount, priority: o.priority || null,
    notes: o.notes, outreach_date: o.outreachDate, followup_date: o.followupDate, date_added: o.dateAdded,
  };
}
function loadSettings(): Settings {
  if (typeof window === "undefined") return { dailyTarget: 5, weeklyTarget: 25 };
  const d = localStorage.getItem(SETTINGS_KEY);
  return d ? JSON.parse(d) : { dailyTarget: 5, weeklyTarget: 25 };
}
function saveSettings(s: Settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

const STAGE_COLORS: Record<string, string> = {
  angel: "bg-purple-50 text-purple-600 border border-purple-200",
  seed: "bg-emerald-50 text-emerald-600 border border-emerald-200",
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
  low: "bg-gray-50 text-gray-500 border border-gray-200",
};

const SOURCE_ICONS: Record<string, { icon: string; label: string }> = {
  manual: { icon: "✏️", label: "Manual" },
  email: { icon: "📧", label: "Email" },
  calendar: { icon: "📅", label: "Calendar" },
  accelerator: { icon: "📋", label: "Form" },
};

type View = "dashboard" | "todo" | "followups" | "ongoing" | "holdoff" | "rejected" | "settings";

interface QuickNote {
  id: string;
  text: string;
  createdAt: string;
}

// Notes and outreaches stored in Supabase

export default function Dashboard() {
  const router = useRouter();
  const [outreaches, setOutreaches] = useState<CompanyOutreach[]>([]);
  const [settings, setSettingsState] = useState<Settings>({ dailyTarget: 5, weeklyTarget: 25 });
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set(["manual", "email", "calendar", "accelerator"]));
  const [sortBy, setSortBy] = useState("recent");
  const [syncMessage, setSyncMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPriority, setBulkPriority] = useState<"high" | "moderate" | "low">("high");
  const [editId, setEditId] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [form, setForm] = useState({
    company: "", contacts: "", stage: "", status: "",
    outreachDate: getToday(), followupDate: "", notes: "",
  });
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([]);
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    // Load outreaches from Supabase
    async function loadData() {
      const { data: rows } = await supabase.from("outreaches").select("*").order("created_at", { ascending: false });
      if (rows && rows.length > 0) {
        setOutreaches(rows.map(rowToOutreach));
      } else {
        // Seed data on first load
        const seedRows = SEED_DATA.map(outreachToRow);
        await supabase.from("outreaches").upsert(seedRows);
        setOutreaches(SEED_DATA);
      }
      // Load notes
      const { data: notes } = await supabase.from("quick_notes").select("*").order("created_at", { ascending: false });
      if (notes) setQuickNotes(notes.map((n) => ({ id: n.id, text: n.text, createdAt: n.created_at })));
    }
    loadData();
    setSettingsState(loadSettings());
  }, []);

  const persist = useCallback(async (updated: CompanyOutreach[]) => {
    setOutreaches(updated);
    // Sync to Supabase: upsert all, delete removed
    const rows = updated.map(outreachToRow);
    await supabase.from("outreaches").upsert(rows);
    // Delete any that were removed
    const currentIds = updated.map((o) => o.id);
    const { data: existing } = await supabase.from("outreaches").select("id");
    if (existing) {
      const toDelete = existing.filter((r) => !currentIds.includes(r.id)).map((r) => r.id);
      if (toDelete.length > 0) await supabase.from("outreaches").delete().in("id", toDelete);
    }
  }, []);

  const today = getToday();
  const weekStart = getWeekStart();
  const todayCount = outreaches.filter((o) => o.dateAdded === today).length;
  const weekCount = outreaches.filter((o) => o.dateAdded >= weekStart).length;
  const totalDays = new Set(outreaches.map((o) => o.dateAdded)).size;
  const avgDaily = totalDays > 0 ? (outreaches.length / totalDays).toFixed(1) : "0";
  const emailCount = outreaches.filter((o) => o.sources.includes("email")).length;
  const calendarCount = outreaches.filter((o) => o.sources.includes("calendar")).length;
  const acceleratorCount = outreaches.filter((o) => o.sources.includes("accelerator")).length;

  const overdueFollowups = outreaches.filter((o) => o.followupDate && o.followupDate < today && o.status !== "rejected" && o.status !== "holdoff");
  const upcomingFollowups = outreaches.filter(
    (o) => o.followupDate && o.followupDate >= today && o.followupDate <= new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0] && o.status !== "rejected" && o.status !== "holdoff"
  );
  const allFollowups = useMemo(() => {
    return outreaches
      .filter((o) => o.followupDate && o.status !== "rejected" && o.status !== "holdoff")
      .sort((a, b) => a.followupDate.localeCompare(b.followupDate));
  }, [outreaches]);

  const filtered = useMemo(() => {
    let list = [...outreaches];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.company.toLowerCase().includes(q) || o.contacts.some((c) => c.name.toLowerCase().includes(q)) || o.notes.toLowerCase().includes(q));
    }
    if (filterStage) list = list.filter((o) => o.stage === filterStage);
    if (filterStatus) list = list.filter((o) => o.status === filterStatus);
    if (filterSources.size < 4) list = list.filter((o) => o.sources.some((s) => filterSources.has(s)));
    switch (sortBy) {
      case "recent": list.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)); break;
      case "date-asc": list.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded)); break;
      case "followup": list.sort((a, b) => (a.followupDate || "z").localeCompare(b.followupDate || "z")); break;
      case "company": list.sort((a, b) => a.company.localeCompare(b.company)); break;
    }
    return list;
  }, [outreaches, search, filterStage, filterStatus, filterSources, sortBy]);

  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days[d.toISOString().split("T")[0]] = 0; }
    outreaches.forEach((o) => { if (days[o.dateAdded] !== undefined) days[o.dateAdded]++; });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [outreaches]);
  const maxChart = Math.max(settings.dailyTarget, ...chartData.map((d) => d.count), 1);

  function companyKeysOverlap(keyA: string, keyB: string): boolean {
    const partsA = keyA.split("|").filter((p) => p.length >= 4);
    const partsB = keyB.split("|").filter((p) => p.length >= 4);
    return partsA.some((a) => partsB.some((b) => a.includes(b) || b.includes(a)));
  }



  function openAdd() {
    setEditId(null);
    setForm({ company: "", contacts: "", stage: "", status: "", outreachDate: getToday(), followupDate: "", notes: "" });
    setShowModal(true);
  }

  function openEdit(o: CompanyOutreach) {
    setEditId(o.id);
    setForm({ company: o.company, contacts: o.contacts.map((c) => c.name).join(", "), stage: o.stage, status: o.status, outreachDate: o.outreachDate, followupDate: o.followupDate, notes: o.notes });
    setShowModal(true);
  }

  function handleSave() {
    const contactsList = form.contacts.split(",").map((n) => n.trim()).filter((n) => n.length > 0).map((name) => ({ name }));
    // Allow saving with just company OR just contacts
    const company = form.company.trim() || (contactsList.length > 0 ? contactsList[0].name : "");
    if (!company) return;
    if (editId) {
      persist(outreaches.map((o) => o.id === editId ? { ...o, company, companyKey: normalizeCompanyKey(company), contacts: contactsList, stage: form.stage || "seed", status: form.status || "todo", outreachDate: form.outreachDate, followupDate: form.followupDate, notes: form.notes } : o));
    } else {
      persist([...outreaches, {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36), company,
        companyKey: normalizeCompanyKey(company), contacts: contactsList, stage: form.stage || "seed",
        status: form.status || "todo", sources: ["manual"], sourceIds: [], emailLinks: [], threadCount: 0,
        outreachDate: form.outreachDate, followupDate: form.followupDate, notes: form.notes, dateAdded: getToday(),
      }]);
    }
    setShowModal(false);
  }

  function handleDelete(id: string) { if (confirm("Delete this outreach?")) persist(outreaches.filter((o) => o.id !== id)); }

  function handleExport() {
    const data = JSON.stringify({ outreaches, settings, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `outreach-backup-${getToday()}.json`; a.click(); URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.outreaches) {
          const first = data.outreaches[0];
          const imported = first && "investor" in first ? migrateV2ToV3(data.outreaches) : data.outreaches;
          persist(imported);
          if (data.settings) { setSettingsState(data.settings); saveSettings(data.settings); }
          alert(`Imported ${imported.length} outreaches`);
        }
      } catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  function handleBulkAdd() {
    if (!bulkText.trim()) return;
    const names = bulkText.split(/[,\n]/).map((n) => n.trim()).filter((n) => n.length > 0);
    const today = getToday();
    const newEntries: CompanyOutreach[] = names.map((name) => ({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      company: name, companyKey: normalizeCompanyKey(name), contacts: [], stage: "seed", status: "todo",
      sources: ["manual"], sourceIds: [], emailLinks: [], threadCount: 0, outreachDate: "", followupDate: "",
      notes: "", dateAdded: today, priority: bulkPriority,
    }));
    const existingKeys = new Set(outreaches.map((o) => o.companyKey));
    const unique = newEntries.filter((e) => !existingKeys.has(e.companyKey));
    if (unique.length > 0) persist([...outreaches, ...unique]);
    setShowBulkAdd(false); setBulkText("");
    setSyncMessage(unique.length < names.length ? `Added ${unique.length} new targets (${names.length - unique.length} already existed)` : `Added ${unique.length} new targets`);
    setTimeout(() => setSyncMessage(""), 4000);
  }

  function clearFollowupDate(id: string) {
    persist(outreaches.map((o) => o.id === id ? { ...o, followupDate: "" } : o));
  }

  function changeStatus(id: string, newStatus: string) {
    persist(outreaches.map((o) => o.id === id ? { ...o, status: newStatus } : o));
  }

  async function addQuickNote() {
    if (!noteInput.trim()) return;
    const note: QuickNote = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), text: noteInput.trim(), createdAt: new Date().toISOString() };
    setQuickNotes([note, ...quickNotes]);
    setNoteInput("");
    await supabase.from("quick_notes").insert({ id: note.id, text: note.text });
  }

  async function deleteQuickNote(id: string) {
    setQuickNotes(quickNotes.filter((n) => n.id !== id));
    await supabase.from("quick_notes").delete().eq("id", id);
  }

  // --- NAV ITEMS ---
  // Status counts
  const todoCount = outreaches.filter((o) => o.status === "todo").length;
  const ongoingCount = outreaches.filter((o) => o.status === "ongoing").length;
  const holdoffCount = outreaches.filter((o) => o.status === "holdoff").length;
  const rejectedCount = outreaches.filter((o) => o.status === "rejected").length;

  const navItems: { key: View; label: string; icon: React.ReactNode; badge?: number; section?: string }[] = [
    {
      key: "dashboard", label: "Dashboard", section: "Overview",
      icon: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>,
    },
    {
      key: "todo", label: "To Do", section: "Pipeline",
      icon: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      badge: todoCount || undefined,
    },
    {
      key: "ongoing", label: "Ongoing",
      icon: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      badge: ongoingCount || undefined,
    },
    {
      key: "followups", label: "Follow-ups",
      icon: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      badge: overdueFollowups.length || undefined,
    },
    {
      key: "holdoff", label: "Hold Off",
      icon: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      badge: holdoffCount || undefined,
    },
    {
      key: "rejected", label: "Rejected",
      icon: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
      badge: rejectedCount || undefined,
    },
    {
      key: "settings", label: "Settings", section: "System",
      icon: <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
  ];

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 bg-gray-800 text-white rounded-lg p-2 md:hidden"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen bg-gray-900 z-40 flex flex-col transition-all duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 ${sidebarCollapsed ? "w-16" : "w-64"}`}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#7832E6] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Outreach</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navItems.map((item, i) => (
            <div key={item.key}>
              {item.section && !sidebarCollapsed && (
                <div className={`text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-4 ${i === 0 ? "mb-2" : "mt-4 mb-2"}`}>
                  {item.section}
                </div>
              )}
              {item.section && sidebarCollapsed && i > 0 && (
                <div className="border-t border-gray-700 my-2 mx-2" />
              )}
              <button
                onClick={() => { setView(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors px-4 py-2.5 mb-0.5 ${view === item.key ? "bg-[#7832E6] text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && item.badge !== undefined && (
                  <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${view === item.key ? "bg-white/20 text-white" : "bg-gray-700 text-gray-400"}`}>{item.badge}</span>
                )}
              </button>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-700 py-4 space-y-1 px-3">
          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-full items-center gap-3 rounded-lg text-sm font-medium transition-colors px-4 py-2.5 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <svg className={`w-5 h-5 shrink-0 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          {/* Sign out */}
          <button
            onClick={() => { localStorage.removeItem("outreach-auth"); router.push("/login"); }}
            className="w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors px-4 py-2.5 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen p-4 pt-14 md:pt-8 md:p-8 max-w-7xl mx-auto w-full">
        {/* Sync message */}
        {syncMessage && (
          <div className={`mb-5 p-3.5 rounded-xl text-sm font-medium ${syncMessage.startsWith("Error") || syncMessage.startsWith("Sync failed") ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-purple-50 text-[#7832E6] border border-purple-200"}`}>
            {syncMessage}
          </div>
        )}

        {/* ===== DASHBOARD VIEW ===== */}
        {view === "dashboard" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Track your investor outreach pipeline</p>
              </div>
              <div className="flex gap-2">
                <button onClick={openAdd} className="px-4 py-2 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors">+ Add Outreach</button>
                <button onClick={() => setShowBulkAdd(true)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-purple-300 transition-colors">Bulk Add</button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[
                { label: "Total", value: outreaches.length, color: "text-[#7832E6]" },
                { label: "To Do", value: todoCount, color: "text-sky-600" },
                { label: "Ongoing", value: ongoingCount, color: "text-emerald-600" },
                { label: "Hold Off", value: holdoffCount, color: "text-orange-600" },
                { label: "Rejected", value: rejectedCount, color: "text-rose-500" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-purple-200 transition-all">
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{stat.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Drop Links/Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input side */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Drop Links / Notes</h2>
                <div className="space-y-3">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addQuickNote(); } }}
                    rows={4}
                    placeholder={"Paste a link, jot a quick note...\nPress Enter to save, Shift+Enter for new line"}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all bg-gray-50 placeholder:text-gray-400"
                  />
                  <button
                    onClick={addQuickNote}
                    disabled={!noteInput.trim()}
                    className="w-full px-4 py-2.5 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              {/* Notes list side */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Saved Notes</h2>
                  <span className="text-[10px] text-gray-400 font-medium">{quickNotes.length} item{quickNotes.length !== 1 ? "s" : ""}</span>
                </div>
                {quickNotes.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    <p className="text-sm">No notes yet</p>
                    <p className="text-xs text-gray-300 mt-1">Drop links, ideas, or quick notes here</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {quickNotes.map((note) => {
                      const isLink = /https?:\/\/\S+/.test(note.text);
                      const timeAgo = (() => {
                        const diff = Date.now() - new Date(note.createdAt).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return "just now";
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        const days = Math.floor(hrs / 24);
                        return `${days}d ago`;
                      })();
                      return (
                        <div key={note.id} className="group flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-gray-50/50 transition-all">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isLink ? "bg-purple-100 text-[#7832E6]" : "bg-gray-100 text-gray-400"}`}>
                            {isLink ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                              {note.text.split(/(https?:\/\/\S+)/g).map((part, i) =>
                                /^https?:\/\//.test(part) ? (
                                  <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[#7832E6] hover:text-[#6526C7] underline underline-offset-2 break-all">{part}</a>
                                ) : <span key={i}>{part}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">{timeAgo}</div>
                          </div>
                          <button
                            onClick={() => deleteQuickNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 text-gray-300 transition-all shrink-0"
                            title="Delete note"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== FOLLOW-UPS VIEW ===== */}
        {view === "followups" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Follow-ups</h1>
                <p className="text-sm text-gray-500 mt-1">{allFollowups.length} scheduled · {overdueFollowups.length} overdue</p>
              </div>
              <button onClick={openAdd} className="px-4 py-2 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors">+ Add</button>
            </div>

            {allFollowups.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
                <div className="text-4xl mb-3">🔔</div>
                <p className="font-medium text-gray-600 mb-1">No follow-ups scheduled</p>
                <p className="text-sm text-gray-400">Edit an outreach to set a follow-up date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allFollowups.map((o) => {
                  const isOverdue = o.followupDate < today;
                  const isUpcoming = o.followupDate >= today && o.followupDate <= new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
                  return (
                    <div
                      key={o.id}
                      className={`group bg-white rounded-xl border p-5 transition-all hover:shadow-lg cursor-pointer ${isOverdue ? "border-rose-200 hover:border-rose-300" : isUpcoming ? "border-amber-200 hover:border-amber-300" : "border-gray-200 hover:border-purple-300"}`}
                      onClick={() => openEdit(o)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{o.company}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${STAGE_COLORS[o.stage] || "bg-gray-50 text-gray-500 border border-gray-200"}`}>{o.stage}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[o.status] || "bg-gray-50 text-gray-500 border border-gray-200"}`}>{o.status}</span>
                          </div>
                          {o.contacts.length > 0 && (
                            <div className="text-xs text-gray-500 mb-1">{o.contacts.map((c) => c.name).join(", ")}</div>
                          )}
                          <div className="text-sm text-gray-600 truncate">{o.notes || "No notes"}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${isOverdue ? "bg-rose-100 text-rose-500" : isUpcoming ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"}`}>
                            {o.followupDate}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(o); }}
                            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-purple-50 hover:border-purple-200 hover:text-[#7832E6] text-gray-400 transition-all"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); clearFollowupDate(o.id); }}
                            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 text-gray-400 transition-all"
                            title="Remove follow-up"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}
                            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 text-gray-400 transition-all"
                            title="Delete outreach"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== STATUS-FILTERED VIEWS (todo, ongoing, holdoff, rejected) ===== */}
        {(view === "todo" || view === "ongoing" || view === "holdoff" || view === "rejected") && (() => {
          const statusLabel: Record<string, string> = { todo: "To Do", ongoing: "Ongoing", holdoff: "Hold Off", rejected: "Rejected" };
          const statusMoveOptions: Record<string, { label: string; value: string; color: string }[]> = {
            todo: [
              { label: "Start → Ongoing", value: "ongoing", color: "bg-emerald-500 hover:bg-emerald-600" },
              { label: "Hold Off", value: "holdoff", color: "bg-orange-500 hover:bg-orange-600" },
            ],
            ongoing: [
              { label: "Hold Off", value: "holdoff", color: "bg-orange-500 hover:bg-orange-600" },
              { label: "Rejected", value: "rejected", color: "bg-rose-500 hover:bg-rose-600" },
              { label: "Back to ToDo", value: "todo", color: "bg-sky-500 hover:bg-sky-600" },
            ],
            holdoff: [
              { label: "Resume → Ongoing", value: "ongoing", color: "bg-emerald-500 hover:bg-emerald-600" },
              { label: "Back to ToDo", value: "todo", color: "bg-sky-500 hover:bg-sky-600" },
              { label: "Rejected", value: "rejected", color: "bg-rose-500 hover:bg-rose-600" },
            ],
            rejected: [
              { label: "Re-open → ToDo", value: "todo", color: "bg-sky-500 hover:bg-sky-600" },
              { label: "Resume → Ongoing", value: "ongoing", color: "bg-emerald-500 hover:bg-emerald-600" },
            ],
          };
          const items = outreaches.filter((o) => o.status === view).sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
          const moves = statusMoveOptions[view] || [];

          return (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{statusLabel[view]}</h1>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[view]}`}>{items.length}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{items.length} outreach{items.length !== 1 ? "es" : ""}</p>
                </div>
                <button onClick={openAdd} className="px-4 py-2 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors">+ Add</button>
              </div>

              {items.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
                  <div className="text-4xl mb-3">{view === "todo" ? "📋" : view === "ongoing" ? "🚀" : view === "holdoff" ? "⏸️" : "❌"}</div>
                  <p className="font-medium text-gray-600 mb-1">No {statusLabel[view].toLowerCase()} outreaches</p>
                  <p className="text-sm text-gray-400">Items will appear here when their status changes to {statusLabel[view].toLowerCase()}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((o) => (
                    <div key={o.id} className="group bg-white rounded-xl border border-gray-200 p-5 transition-all hover:shadow-lg hover:border-purple-300">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(o)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{o.company}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${STAGE_COLORS[o.stage] || "bg-gray-50 text-gray-500 border border-gray-200"}`}>{o.stage}</span>
                            {o.priority && <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${PRIORITY_COLORS[o.priority]}`}>{o.priority}</span>}
                            {o.sources.map((s) => <span key={s} className="text-sm">{SOURCE_ICONS[s]?.icon || "✏️"}</span>)}
                          </div>
                          {o.contacts.length > 0 && (
                            <div className="text-xs text-gray-500 mb-1">{o.contacts.map((c) => c.name).join(", ")}</div>
                          )}
                          {o.notes && <div className="text-sm text-gray-600 truncate">{o.notes}</div>}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                            {o.outreachDate && <span>Outreach: {o.outreachDate}</span>}
                            {o.followupDate && <span>Follow-up: {o.followupDate}</span>}
                            {o.threadCount > 0 && <span>{o.threadCount} thread{o.threadCount !== 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          {/* Quick status moves */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {moves.map((m) => (
                              <button
                                key={m.value}
                                onClick={() => changeStatus(o.id, m.value)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-white transition-colors ${m.color}`}
                                title={m.label}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(o)} className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-purple-50 hover:border-purple-200 hover:text-[#7832E6] text-gray-400 transition-all" title="Edit">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(o.id)} className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 text-gray-400 transition-all" title="Delete">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {/* ===== SETTINGS VIEW ===== */}
        {view === "settings" && (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Settings</h1>
            <div className="max-w-lg space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Targets</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Daily Target</label>
                    <input type="number" value={settings.dailyTarget} onChange={(e) => setSettingsState({ ...settings, dailyTarget: parseInt(e.target.value) || 5 })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Weekly Target</label>
                    <input type="number" value={settings.weeklyTarget} onChange={(e) => setSettingsState({ ...settings, weeklyTarget: parseInt(e.target.value) || 25 })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all" />
                  </div>
                  <button onClick={() => { saveSettings(settings); setSyncMessage("Settings saved"); setTimeout(() => setSyncMessage(""), 3000); }}
                    className="px-5 py-2.5 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors">Save Settings</button>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Data</h2>
                <div className="flex gap-3">
                  <button onClick={handleExport} className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-purple-300 transition-all">Export JSON</button>
                  <label className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-purple-300 transition-all cursor-pointer text-center">
                    Import JSON
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                  <button onClick={() => { if (confirm("Clear all data?")) { persist([]); } }}
                    className="px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-500 hover:bg-rose-100 transition-all">Clear All</button>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Account</h2>
                <p className="text-sm text-gray-500 mb-3">Outreach Tracker</p>
                <button onClick={() => { localStorage.removeItem("outreach-auth"); router.push("/login"); }} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-rose-200 hover:text-rose-500 transition-all">Sign Out</button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{editId ? "Edit Outreach" : "Add Outreach"}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Company</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all" placeholder="Fund / Company..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Contacts</label>
                  <input value={form.contacts} onChange={(e) => setForm({ ...form, contacts: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all" placeholder="Names, comma-separated..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Stage</label>
                <div className="flex flex-wrap gap-2">
                  {["angel", "seed", "series-a", "series-b", "accelerator"].map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, stage: form.stage === s ? "" : s })}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.stage === s ? "bg-[#7832E6] text-white border-[#7832E6]" : "bg-white border-gray-200 text-gray-500 hover:border-purple-300 hover:text-[#7832E6]"}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                <div className="flex flex-wrap gap-2">
                  {["todo", "ongoing", "holdoff", "rejected"].map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, status: form.status === s ? "" : s })}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.status === s ? "bg-[#7832E6] text-white border-[#7832E6]" : "bg-white border-gray-200 text-gray-500 hover:border-purple-300 hover:text-[#7832E6]"}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Outreach Date</label>
                  <input type="date" value={form.outreachDate} onChange={(e) => setForm({ ...form, outreachDate: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Follow-up Date</label>
                  <input type="date" value={form.followupDate} onChange={(e) => setForm({ ...form, followupDate: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all" placeholder="Add notes, links..." />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                <button onClick={handleSave} className="px-5 py-2.5 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBulkAdd(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Bulk Add Targets</h2>
            <p className="text-xs text-gray-400 mb-4">Paste company/fund names — one per line or comma-separated.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Priority</label>
                <div className="flex gap-2">
                  {(["high", "moderate", "low"] as const).map((p) => (
                    <button key={p} onClick={() => setBulkPriority(p)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${bulkPriority === p ? "bg-[#7832E6] text-white border-[#7832E6]" : "bg-white border-gray-200 text-gray-500 hover:border-purple-300"}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Names</label>
                <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8}
                  placeholder={"Y Combinator\na16z\nSequoia Capital"}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all font-mono" />
                <div className="text-[10px] text-gray-400 mt-1">
                  {bulkText.trim() ? `${bulkText.split(/[,\n]/).map((n) => n.trim()).filter((n) => n).length} names detected` : ""}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowBulkAdd(false)} className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                <button onClick={handleBulkAdd} className="px-5 py-2.5 bg-[#7832E6] text-white rounded-lg text-sm font-medium hover:bg-[#6526C7] transition-colors">Add All</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

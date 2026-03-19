export interface Outreach {
  id: string;
  investor: string;
  company: string;
  stage: string[];
  contactMethod: string[];
  status: string[];
  outreachDate: string;
  followupDate: string;
  notes: string;
  dateAdded: string;
  source: "manual" | "email" | "calendar" | "accelerator";
  sources?: string[];    // All source types for clubbed entries
  sourceId?: string;
  emailLink?: string;
  emailLinks?: string[]; // All Gmail links for this investor
  threadCount?: number;  // Number of conversations
  priority?: "high" | "moderate" | "low"; // For bulk-added targets
}

export interface SyncResult {
  newOutreaches: Outreach[];
  updatedCount: number;
  errors: string[];
}

export interface Settings {
  dailyTarget: number;
  weeklyTarget: number;
}

export interface ClassifiedItem {
  type: "investor_conversation" | "accelerator_confirmation" | "investor_meeting" | "irrelevant";
  investor: string;
  company: string;
  stage: string[];
  notes: string;
  confidence: number;
}

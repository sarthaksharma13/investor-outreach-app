export interface Contact {
  name: string;
  email?: string;
}

export interface CompanyOutreach {
  id: string;
  company: string;
  companyKey: string; // normalized for matching
  contacts: Contact[];
  stage: string;
  status: string;
  sources: string[];
  sourceIds: string[];
  emailLinks: string[];
  threadCount: number;
  priority?: "high" | "moderate" | "low";
  notes: string;
  outreachDate: string;
  followupDate: string;
  dateAdded: string;
}

export interface SyncResult {
  newOutreaches: CompanyOutreach[];
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

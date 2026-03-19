import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jdbgzarlwsclinvvruko.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYmd6YXJsd3NjbGludnZydWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc1MTIsImV4cCI6MjA4OTUxMzUxMn0.tGbeB-mupZW40uyHP2Zycv4fqRN-SFCMy3lMHCsMFiA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

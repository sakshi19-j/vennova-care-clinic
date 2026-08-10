// Supabase client for the Lovable Cloud project that stores the appointment
// module (scheduling settings, slot reservation mirror and the public booking
// RPCs). The main `supabase` client points at the clinic auth project, which
// does not hold these tables.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

export const appointmentsDb = createClient<Database>(url, key, {
  auth: {
    storage: undefined,
    persistSession: false,
    autoRefreshToken: false,
  },
});

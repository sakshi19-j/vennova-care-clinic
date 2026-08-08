// Supabase browser client. Reads ONLY VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// The clinic's own auth/database project (same one the Railway backend validates
// tokens against). Falls back to the platform project when not configured.
const clinicUrl = import.meta.env.VITE_CLINIC_SUPABASE_URL as string | undefined;
const clinicKey = import.meta.env.VITE_CLINIC_SUPABASE_ANON_KEY as string | undefined;

// URL and key must always come from the SAME project, otherwise Supabase
// rejects every request with "Invalid API key".
const useClinic = Boolean(clinicUrl && clinicKey);
const supabaseUrl = (useClinic ? clinicUrl : import.meta.env.VITE_SUPABASE_URL) as string;
const supabaseAnonKey = (useClinic
  ? clinicKey
  : import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in the environment variables.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});

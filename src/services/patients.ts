// Patient service — wraps /patients/* and related read endpoints.
// All calls go through the centralized api client (Supabase JWT injected).

import { api } from "@/lib/api-client";

export type Patient = {
  id: string;
  reg_no?: number;
  title?: string | null;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  dob?: string | null;
  age?: number | null;
  gender?: string | null;
  marital_status?: string | null;
  res_address?: string | null;
  res_city?: string | null;
  res_state?: string | null;
  res_postal?: string | null;
  res_country?: string | null;
  phone_mobile?: string | null;
  phone_res?: string | null;
  email?: string | null;
  blood_group?: string | null;
  occupation?: string | null;
  notes?: string | null;
  referred_by_name?: string | null;
  referred_by_contact?: string | null;
  language_pref?: string | null;
  created_at?: string;
  last_visit_at?: string | null;
  visit_count?: number;
  outstanding_balance?: number;
  [k: string]: unknown;
};

export type PatientCreate = Partial<Omit<Patient, "id" | "reg_no" | "created_at">> & {
  first_name: string;
};

export type PatientUpdate = Partial<PatientCreate>;

export type PatientListResult = {
  items: Patient[];
  total: number | null; // null when backend doesn't return a count
};

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "rows", "patients"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function pickTotal(raw: unknown): number | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of ["total", "count", "total_count"]) {
      if (typeof o[k] === "number") return o[k] as number;
    }
  }
  return null;
}

export const patientsService = {
  async list(params: { search?: string; skip?: number; limit?: number } = {}): Promise<PatientListResult> {
    const raw = await api.get<unknown>("/patients", {
      query: {
        search: params.search || undefined,
        skip: params.skip ?? 0,
        limit: params.limit ?? 25,
      },
    });
    return { items: asArray<Patient>(raw), total: pickTotal(raw) };
  },
  get: (id: string) => api.get<Patient>(`/patients/${encodeURIComponent(id)}`),
  create: (body: PatientCreate) => api.post<Patient>("/patients", body),
  update: (id: string, body: PatientUpdate) =>
    api.put<Patient>(`/patients/${encodeURIComponent(id)}`, body),
  history: (id: string) =>
    api.get<unknown>(`/patients/${encodeURIComponent(id)}/history`),
  visits: (id: string, params: { skip?: number; limit?: number } = {}) =>
    api
      .get<unknown>(`/visits/patient/${encodeURIComponent(id)}`, {
        query: { skip: params.skip ?? 0, limit: params.limit ?? 50 },
      })
      .then((d) => asArray<Record<string, unknown>>(d)),
  followups: (id: string) =>
    api
      .get<unknown>(`/reminders/patient/${encodeURIComponent(id)}`)
      .then((d) => asArray<Record<string, unknown>>(d)),
};

export function patientDisplayName(p: Patient): string {
  if (p.full_name) return p.full_name;
  return [p.title, p.first_name, p.middle_name, p.last_name]
    .map((s) => (s || "").toString().trim())
    .filter(Boolean)
    .join(" ") || "Unnamed patient";
}

export function patientPhone(p: Patient): string {
  return (p.phone_mobile || p.phone_res || "").toString();
}

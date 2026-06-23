// Dashboard service — wraps backend analytics endpoints for the Owner/Doctor
// console. All requests go through the centralized api client (Supabase JWT
// auto-injected). No mock fallbacks — components show empty states / errors.

import { api } from "@/lib/api-client";

export type SummaryToday = {
  revenue_today?: number;
  revenue?: number;
  visits_today?: number;
  visits?: number;
  appointments_today?: number;
  appointments?: number;
  pending_followups?: number;
  followups_today?: number;
  total_patients?: number;
  new_patients_today?: number;
  [k: string]: unknown;
};

export type RevenuePoint = {
  date?: string;
  day?: string;
  d?: string;
  label?: string;
  total?: number;
  amount?: number;
  revenue?: number;
  value?: number;
  [k: string]: unknown;
};

export type Appointment = {
  id?: string;
  appointment_id?: string;
  patient_name?: string;
  name?: string;
  slot_at?: string;
  time?: string;
  status?: string;
  [k: string]: unknown;
};

export type Followup = {
  id?: string;
  followup_id?: string;
  patient_name?: string;
  due_at?: string;
  due_date?: string;
  status?: string;
  [k: string]: unknown;
};

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "rows"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

export const dashboardService = {
  summaryToday: () => api.get<SummaryToday>("/analytics/summary/today"),
  monthlyRevenue: () => api.get<unknown>("/analytics/revenue/monthly"),
  weeklyRevenue: () => api.get<unknown>("/analytics/revenue/weekly"),
  dailyRevenue: () =>
    api.get<unknown>("/analytics/revenue/daily").then((d) => asArray<RevenuePoint>(d)),
  followupsToday: () =>
    api.get<unknown>("/analytics/followups/today").then((d) => asArray<Followup>(d)),
  appointmentsToday: () =>
    api.get<unknown>("/appointments/today").then((d) => asArray<Appointment>(d)),
  patientsCount: async () => {
    const list = await api.get<unknown>("/patients", { query: { limit: 1, skip: 0 } });
    const arr = asArray<unknown>(list);
    if (arr.length > 0 && typeof list === "object" && list !== null) {
      const o = list as Record<string, unknown>;
      if (typeof o.total === "number") return o.total;
      if (typeof o.count === "number") return o.count;
    }
    // fallback — fetch a larger page and count
    const all = await api.get<unknown>("/patients", { query: { limit: 1000, skip: 0 } });
    return asArray<unknown>(all).length;
  },
};

export { asArray };

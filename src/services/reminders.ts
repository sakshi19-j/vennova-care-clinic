// Reminders / followups service.
import { api } from "@/lib/api-client";

export type Reminder = {
  id?: string;
  followup_id?: string;
  patient_id?: string;
  patient_name?: string;
  phone?: string;
  reason?: string;
  message?: string;
  due_at?: string;
  due_date?: string;
  status?: string; // PENDING | SENT | DONE | FAILED
  channel?: string;
  scheduled_for?: string;
  [k: string]: unknown;
};

export type ReminderStats = {
  pending?: number;
  sent?: number;
  done?: number;
  failed?: number;
  [k: string]: unknown;
};

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "rows", "reminders", "followups"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function pickId(r: Reminder): string {
  return String(r.followup_id ?? r.id ?? "");
}

export const remindersService = {
  today: () =>
    api.get<unknown>("/reminders/today").then((d) => asArray<Reminder>(d)),
  stats: () => api.get<ReminderStats>("/reminders/stats"),
  send: (id: string) =>
    api.post<unknown>(`/reminders/${encodeURIComponent(id)}/send`),
  markSent: (id: string) =>
    api.put<unknown>(`/reminders/${encodeURIComponent(id)}/mark-sent`),
  markDone: (id: string) =>
    api.put<unknown>(`/reminders/${encodeURIComponent(id)}/mark-done`),
  sendTodayBatch: () => api.post<unknown>("/reminders/send-today"),
};

export { pickId as reminderId };

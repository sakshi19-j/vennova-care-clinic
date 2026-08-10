// Appointment module — slot engine, clinic scheduling settings and the
// slot-reservation mirror used to prevent double booking.
//
// Appointments themselves live in the Railway backend (`/appointments/`).
// The backend has no slot / settings / public-booking endpoints, so this
// module keeps three appointment-only concerns in Lovable Cloud:
//   1. appointment_settings  — working days, hours, slot size, breaks, holidays
//   2. appointment_slots     — a reservation mirror (unique per clinic+date+time)
//   3. public_* RPCs         — the anonymous patient booking link
//
// Everything degrades gracefully: if the Cloud tables are not present yet the
// app falls back to sensible defaults and staff booking still works.

import { appointmentsDb } from "@/integrations/supabase/appointments-client";
import { api } from "@/lib/api-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = appointmentsDb as any;

// ---------------------------------------------------------------- settings

export type AppointmentSettings = {
  /** 0 = Sunday … 6 = Saturday */
  working_days: number[];
  open_time: string; // "09:00"
  close_time: string; // "13:00"
  slot_minutes: number;
  break_start: string | null;
  break_end: string | null;
  /** ISO dates (YYYY-MM-DD) the clinic is closed */
  holidays: string[];
};

export const DEFAULT_APPOINTMENT_SETTINGS: AppointmentSettings = {
  working_days: [1, 2, 3, 4, 5, 6],
  open_time: "09:00",
  close_time: "13:00",
  slot_minutes: 20,
  break_start: null,
  break_end: null,
  holidays: [],
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function normalizeSettings(row: any): AppointmentSettings {
  if (!row) return DEFAULT_APPOINTMENT_SETTINGS;
  return {
    working_days: Array.isArray(row.working_days) && row.working_days.length
      ? row.working_days.map((d: any) => Number(d))
      : DEFAULT_APPOINTMENT_SETTINGS.working_days,
    open_time: hhmm(row.open_time) || DEFAULT_APPOINTMENT_SETTINGS.open_time,
    close_time: hhmm(row.close_time) || DEFAULT_APPOINTMENT_SETTINGS.close_time,
    slot_minutes: Number(row.slot_minutes) > 0 ? Number(row.slot_minutes) : 20,
    break_start: hhmm(row.break_start) || null,
    break_end: hhmm(row.break_end) || null,
    holidays: Array.isArray(row.holidays) ? row.holidays.map(String) : [],
  };
}

function hhmm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export async function loadAppointmentSettings(
  clinicId: string | null | undefined,
): Promise<AppointmentSettings> {
  if (!clinicId) return DEFAULT_APPOINTMENT_SETTINGS;
  try {
    const { data, error } = await db
      .from("appointment_settings")
      .select("*")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (error) return DEFAULT_APPOINTMENT_SETTINGS;
    return normalizeSettings(data);
  } catch {
    return DEFAULT_APPOINTMENT_SETTINGS;
  }
}

export async function saveAppointmentSettings(
  clinicId: string,
  s: AppointmentSettings,
  clinicName?: string | null,
): Promise<void> {
  const { error } = await db
    .from("appointment_settings")
    .upsert(
      {
        clinic_id: clinicId,
        ...(clinicName ? { clinic_name: clinicName } : {}),
        working_days: s.working_days,
        open_time: s.open_time,
        close_time: s.close_time,
        slot_minutes: s.slot_minutes,
        break_start: s.break_start,
        break_end: s.break_end,
        holidays: s.holidays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id" },
    );
  if (error) throw new Error(error.message || "Could not save appointment settings");
}

// ------------------------------------------------------------ slot engine

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatSlotLabel(t: string): string {
  const m = toMinutes(t);
  const h24 = Math.floor(m / 60);
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m % 60).padStart(2, "0")} ${suffix}`;
}

export type Slot = { start: string; end: string };

export function isWorkingDay(s: AppointmentSettings, isoDate: string): boolean {
  if (s.holidays.includes(isoDate)) return false;
  const dow = new Date(`${isoDate}T00:00:00`).getDay();
  return s.working_days.includes(dow);
}

/** Generate every slot the clinic offers on a given date (breaks excluded). */
export function generateSlots(s: AppointmentSettings, isoDate: string): Slot[] {
  if (!isWorkingDay(s, isoDate)) return [];
  const open = toMinutes(s.open_time);
  const close = toMinutes(s.close_time);
  const size = Math.max(5, s.slot_minutes);
  const bs = s.break_start ? toMinutes(s.break_start) : null;
  const be = s.break_end ? toMinutes(s.break_end) : null;

  const out: Slot[] = [];
  for (let t = open; t + size <= close; t += size) {
    const end = t + size;
    if (bs !== null && be !== null && t < be && end > bs) continue; // overlaps break
    out.push({ start: fromMinutes(t), end: fromMinutes(end) });
  }
  return out;
}

/** Slot start times that are already in the past (today only). */
export function isPastSlot(isoDate: string, start: string): boolean {
  const now = new Date();
  const today = localIsoDate(now);
  if (isoDate > today) return false;
  if (isoDate < today) return true;
  return toMinutes(start) <= now.getHours() * 60 + now.getMinutes();
}

export function localIsoDate(d: Date = new Date()): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

// ------------------------------------------------- reservation mirror rows

export type SlotRow = {
  id?: string;
  clinic_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  patient_id: string | null;
  patient_name: string;
  patient_phone: string;
  visit_type: string | null;
  chief_complaint: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  booking_source: "receptionist" | "patient_link";
  backend_appointment_id?: string | null;
  created_at?: string;
};

export class SlotTakenError extends Error {
  constructor() {
    super("Sorry, this slot is no longer available. Please select another slot.");
    this.name = "SlotTakenError";
  }
}

function isUniqueViolation(err: any): boolean {
  return err?.code === "23505" || /duplicate key|already/i.test(err?.message ?? "");
}

export async function loadSlotRows(
  clinicId: string | null | undefined,
  isoDate: string,
): Promise<SlotRow[]> {
  if (!clinicId) return [];
  try {
    const { data, error } = await db.rpc("clinic_slot_rows", {
      p_clinic: clinicId,
      p_date: isoDate,
    });
    if (error) return [];
    return (data ?? []).map((r: any) => ({ ...r, start_time: hhmm(r.start_time) ?? r.start_time }));
  } catch {
    return [];
  }
}

/** Pending requests that came in through the public patient link. */
export async function loadPendingRequests(clinicId: string | null | undefined): Promise<SlotRow[]> {
  if (!clinicId) return [];
  try {
    const { data, error } = await db.rpc("clinic_slot_rows", {
      p_clinic: clinicId,
      p_date: null,
    });
    if (error) return [];
    const today = localIsoDate();
    return (data ?? [])
      .filter(
        (r: any) =>
          r.status === "PENDING" && r.booking_source === "patient_link" && r.slot_date >= today,
      )
      .map((r: any) => ({ ...r, start_time: hhmm(r.start_time) ?? r.start_time }));
  } catch {
    return [];
  }
}

/** Reserve a slot. Throws SlotTakenError when the slot is already booked. */
export async function reserveSlot(row: SlotRow): Promise<SlotRow | null> {
  try {
    const { data, error } = await db.rpc("clinic_reserve_slot", {
      p_clinic: row.clinic_id,
      p_date: row.slot_date,
      p_start: row.start_time,
      p_end: row.end_time,
      p_patient_id: row.patient_id ?? "",
      p_name: row.patient_name ?? "",
      p_phone: row.patient_phone ?? "",
      p_visit_type: row.visit_type ?? null,
      p_reason: row.chief_complaint ?? null,
    });
    if (error) {
      if (isUniqueViolation(error)) throw new SlotTakenError();
      return null;
    }
    if (data && data.ok === false) throw new SlotTakenError();
    return { ...row, id: data?.id, status: "CONFIRMED" };
  } catch (e) {
    if (e instanceof SlotTakenError) throw e;
    return null;
  }
}

export async function releaseSlot(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await db.rpc("clinic_update_slot_status", { p_id: id, p_status: "CANCELLED" });
  } catch {
    /* mirror is best-effort */
  }
}

export async function markSlotConfirmed(
  id: string,
  backendAppointmentId?: string | null,
): Promise<void> {
  try {
    await db.rpc("clinic_update_slot_status", {
      p_id: id,
      p_status: "CONFIRMED",
      p_backend_id: backendAppointmentId ?? null,
    });
  } catch {
    /* best effort */
  }
}

// ------------------------------------------------------- public booking API

export type PublicBookingInfo = {
  clinic_name: string;
  settings: AppointmentSettings;
};

export const publicBooking = {
  async info(clinicId: string): Promise<PublicBookingInfo> {
    const { data, error } = await db.rpc("public_booking_info", { p_clinic: clinicId });
    if (error) throw new Error(error.message || "Booking link is not available.");
    if (!data) throw new Error("This booking link is not valid.");
    return {
      clinic_name: data.clinic_name ?? "Clinic",
      settings: normalizeSettings(data.settings),
    };
  },

  async bookedTimes(clinicId: string, isoDate: string): Promise<string[]> {
    const { data, error } = await db.rpc("public_booked_times", {
      p_clinic: clinicId,
      p_date: isoDate,
    });
    if (error) return [];
    return (data ?? []).map((r: any) => hhmm(typeof r === "string" ? r : r.start_time) ?? "");
  },

  async book(input: {
    clinicId: string;
    isoDate: string;
    start: string;
    end: string;
    name: string;
    phone: string;
    reason?: string;
  }): Promise<void> {
    const { data, error } = await db.rpc("public_book_slot", {
      p_clinic: input.clinicId,
      p_date: input.isoDate,
      p_start: input.start,
      p_end: input.end,
      p_name: input.name,
      p_phone: input.phone,
      p_reason: input.reason ?? null,
    });
    if (error) {
      if (isUniqueViolation(error)) throw new SlotTakenError();
      throw new Error(error.message || "Could not book this slot.");
    }
    if (data && data.ok === false) throw new SlotTakenError();
  },
};

// ----------------------------------------------------- backend appointments

export type BackendAppointment = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  scheduled_at: string;
  visit_type: string;
  status: string;
  chief_complaint?: string;
  duration_mins?: number;
  notes?: string;
};

export function normalizeAppointments(raw: any): BackendAppointment[] {
  const arr = Array.isArray(raw) ? raw : raw?.appointments ?? raw?.items ?? [];
  return arr
    .map((a: any) => ({
      id: String(a.id ?? a.appointment_id ?? ""),
      patient_id: String(a.patient_id ?? ""),
      patient_name:
        a.patient_name ||
        `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() ||
        a.name ||
        "",
      patient_phone: a.patient_phone || a.phone_mobile || a.phone || "",
      scheduled_at: String(a.scheduled_at ?? a.slot_at ?? a.time ?? ""),
      visit_type: String(a.visit_type ?? "HOMEOPATHY"),
      status: String(a.status ?? "SCHEDULED").toUpperCase(),
      chief_complaint: a.chief_complaint ?? undefined,
      duration_mins: a.duration_mins ?? undefined,
      notes: a.notes ?? undefined,
    }))
    .filter((a: BackendAppointment) => a.scheduled_at);
}

export async function fetchAppointments(): Promise<BackendAppointment[]> {
  const raw = await api.get<unknown>("/appointments/");
  return normalizeAppointments(raw);
}

/** "HH:MM" of an appointment in local time. */
export function apptStartTime(a: BackendAppointment): string {
  const d = new Date(a.scheduled_at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function apptDate(a: BackendAppointment): string {
  return localIsoDate(new Date(a.scheduled_at));
}

/** Times already taken for a date: backend appointments + mirror reservations. */
export function takenTimes(
  appts: BackendAppointment[],
  rows: SlotRow[],
  isoDate: string,
): Set<string> {
  const set = new Set<string>();
  for (const a of appts) {
    if (a.status === "CANCELLED") continue;
    if (apptDate(a) === isoDate) set.add(apptStartTime(a));
  }
  for (const r of rows) {
    if (r.status === "CANCELLED") continue;
    if (r.slot_date === isoDate) set.add(r.start_time);
  }
  return set;
}

// --------------------------------------------------------------- statuses

export type UiStatus = "CONFIRMED" | "WAITING" | "COMPLETED" | "CANCELLED";

export function uiStatus(backendStatus: string): UiStatus {
  const s = (backendStatus || "").toUpperCase();
  if (s === "COMPLETED" || s === "DONE") return "COMPLETED";
  if (s === "CANCELLED" || s === "NO_SHOW") return "CANCELLED";
  if (s === "CONFIRMED" || s === "CHECKED_IN") return "CONFIRMED";
  return "WAITING";
}

export const uiStatusStyles: Record<UiStatus, string> = {
  CONFIRMED: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  WAITING: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};

export const uiStatusLabel: Record<UiStatus, string> = {
  CONFIRMED: "Confirmed",
  WAITING: "Waiting",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

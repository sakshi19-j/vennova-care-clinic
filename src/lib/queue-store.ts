import { useEffect, useSyncExternalStore } from "react";
import {
  rxPatients,
  rxAppointments,
  rxPendingBills,
  type RxQueue,
  type QueueStatus,
  type VisitType,
  type RxPatient,
  type PaymentMode,
  type RxAppointment,
  type RxBill,
  type ApptStatus,
  type RxReminder,
} from "./reception-data";
import { api, ApiError } from "./api-client";

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────
export type PaidWith = PaymentMode | null;

export type RxQueueRow = RxQueue & {
  fee: number;
  paid: boolean;
  paid_with?: PaidWith;
  reg_no?: string;
  created_at: number;
  invoice_sent?: boolean;
  invoice_sent_at?: number;
};

export type RecentAction = {
  id: string;
  label: string;
  at: number;
};

export type CallNotification = {
  id: string;
  queue_id: string;
  patient_id: string;
  patient_name: string;
  token_number: number;
  doctor: "ALLOPATHY" | "HOMEOPATHY";
  at: number;
};

export type PatientVisit = {
  visit_id: string;
  date: string;
  chief_complaint?: string;
  doctor_name?: string;
  diagnosis?: string;
  prescription?: string;
  fee?: number;
  paid_with?: PaymentMode;
};

export type ExtendedPatient = RxPatient & {
  history: PatientVisit[];
  email?: string;
  address?: string;
  blood_group?: string;
  dob?: string;
};

const FEE_BY_TYPE: Record<VisitType, number> = {
  WALKIN: 400,
  APPOINTMENT: 500,
};

// ───────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────
let state: RxQueueRow[] = [];
let patients: ExtendedPatient[] = rxPatients.map((p) => ({
  ...p,
  history: [
    // seed some history for demo
    ...(p.total_visits > 0
      ? [
          {
            visit_id: `v-hist-${p.id}-1`,
            date: p.last_visit ?? "2026-05-01",
            chief_complaint: "Routine checkup",
            doctor_name: "Dr. R. Sharma",
            diagnosis: "General wellness",
            prescription: "Rest & fluids",
            fee: FEE_BY_TYPE["APPOINTMENT"],
            paid_with: "UPI" as PaymentMode,
          },
        ]
      : []),
  ],
}));
let appointments: RxAppointment[] = [...rxAppointments];
let bills: RxBill[] = [...rxPendingBills];
let recent: RecentAction[] = [];
let calls: CallNotification[] = [];
let undoStack: RxQueueRow[][] = [];
let reminders: RxReminder[] = [];
let remindersLoading = false;
let remindersError: string | null = null;

const listeners = new Set<() => void>();
let queuePoller: ReturnType<typeof setInterval> | null = null;
let queuePollSubscribers = 0;
function emit() {
  for (const l of listeners) l();
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function snapshot(label: string, id: string) {
  undoStack.push(state.map((r) => ({ ...r })));
  if (undoStack.length > 20) undoStack.shift();
  recent = [{ id, label, at: Date.now() }, ...recent].slice(0, 3);
}

// ───────────────────────────────────────────────────────────
// Hooks
// ───────────────────────────────────────────────────────────
export function useQueue(): RxQueueRow[] {
  useEffect(() => startQueuePolling(), []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export function useRecent(): RecentAction[] {
  return useSyncExternalStore(subscribe, () => recent, () => recent);
}
export function usePatients(): ExtendedPatient[] {
  return useSyncExternalStore(subscribe, () => patients, () => patients);
}
export function useAppointments(): RxAppointment[] {
  return useSyncExternalStore(subscribe, () => appointments, () => appointments);
}
export function useBills(): RxBill[] {
  return useSyncExternalStore(subscribe, () => bills, () => bills);
}
export function useCalls(): CallNotification[] {
  return useSyncExternalStore(subscribe, () => calls, () => calls);
}
export function useReminders(): {
  data: RxReminder[];
  loading: boolean;
  error: string | null;
} {
  const data = useSyncExternalStore(subscribe, () => reminders, () => reminders);
  const loading = useSyncExternalStore(
    subscribe,
    () => remindersLoading,
    () => remindersLoading,
  );
  const error = useSyncExternalStore(
    subscribe,
    () => remindersError,
    () => remindersError,
  );
  return { data, loading, error };
}

function startQueuePolling() {
  queuePollSubscribers += 1;
  void loadQueue();
  if (!queuePoller) {
    queuePoller = setInterval(() => {
      void loadQueue();
    }, 10_000);
  }
  return () => {
    queuePollSubscribers = Math.max(0, queuePollSubscribers - 1);
    if (queuePollSubscribers === 0 && queuePoller) {
      clearInterval(queuePoller);
      queuePoller = null;
    }
  };
}

// ───────────────────────────────────────────────────────────
// Reminders — backend integration
// ───────────────────────────────────────────────────────────
export async function loadReminders(): Promise<RxReminder[]> {
  remindersLoading = true;
  remindersError = null;
  emit();
  try {
    const data = await api.get<RxReminder[]>("/reminders/today");
    reminders = Array.isArray(data) ? data : [];
    return reminders;
  } catch (err) {
    remindersError =
      err instanceof ApiError ? err.message : (err as Error)?.message ?? "Failed to load reminders";
    return reminders;
  } finally {
    remindersLoading = false;
    emit();
  }
}

export async function sendReminder(followupId: string): Promise<void> {
  try {
    await api.post(`/reminders/${encodeURIComponent(followupId)}/send`);
    reminders = reminders.map((r) =>
      r.followup_id === followupId
        ? { ...r, status: "SENT", sent_at: new Date().toISOString() }
        : r,
    );
    emit();
  } catch (err) {
    remindersError =
      err instanceof ApiError ? err.message : (err as Error)?.message ?? "Failed to send reminder";
    emit();
    throw err;
  }
}

// ───────────────────────────────────────────────────────────
// Live API loaders (Rule 3 — replace mocks with backend)
// On failure we keep existing (mock) state so the UI never crashes.
// ───────────────────────────────────────────────────────────
function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["queue", "items", "data", "results"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function normalizeQueueStatus(raw: unknown): QueueStatus {
  const s = String(raw ?? "WAITING").toUpperCase();
  if (s === "IN_CONSULTATION") return "IN_TREATMENT";
  if (s === "BILLING" || s === "COMPLETED") return "DONE";
  if (["WAITING", "CHECKED_IN", "IN_TREATMENT", "DONE", "NO_SHOW", "CANCELLED"].includes(s)) return s as QueueStatus;
  return "WAITING";
}

function toQueueRow(raw: any): RxQueueRow {
  const visit_type: VisitType = raw.visit_type === "APPOINTMENT" ? "APPOINTMENT" : "WALKIN";
  return {
    queue_id: String(raw.queue_id ?? raw.id ?? `q-${Math.random().toString(36).slice(2)}`),
    token_number: Number(raw.token_number ?? raw.token ?? 0),
    patient_id: String(raw.patient_id ?? ""),
    patient_name: String(raw.patient_name ?? raw.full_name ?? "Patient"),
    patient_phone: String(raw.patient_phone ?? raw.phone ?? ""),
    visit_id: raw.visit_id ? String(raw.visit_id) : undefined,
    status: normalizeQueueStatus(raw.status),
    visit_type,
    priority: (raw.priority === 1 ? 1 : 0) as 0 | 1,
    wait_minutes: Number(raw.wait_minutes ?? 0),
    notes: raw.notes ?? undefined,
    fee: Number(raw.fee ?? FEE_BY_TYPE[visit_type]),
    paid: Boolean(raw.paid ?? false),
    paid_with: (raw.paid_with ?? null) as PaidWith,
    reg_no: raw.reg_no ?? undefined,
    created_at: raw.created_at ? new Date(raw.created_at).getTime() : Date.now(),
  };
}

function toPatient(raw: any): ExtendedPatient {
  return {
    id: String(raw.id ?? raw.patient_id ?? `p-${Math.random().toString(36).slice(2)}`),
    reg_no: String(raw.reg_no ?? ""),
    full_name: String(raw.full_name ?? [raw.title, raw.first_name, raw.last_name].filter(Boolean).join(" ") ?? "Unnamed"),
    phone: String(raw.phone ?? raw.phone_mobile ?? ""),
    city: String(raw.city ?? raw.res_city ?? ""),
    patient_type: "HOMEOPATHY",
    total_visits: Number(raw.total_visits ?? 0),
    last_visit: raw.last_visit ?? null,
    is_missed: Boolean(raw.is_missed ?? false),
    age: raw.age ?? undefined,
    gender: raw.gender ?? undefined,
    dob: raw.dob ?? undefined,
    email: raw.email ?? undefined,
    address: raw.res_address ?? raw.address ?? undefined,
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

export async function loadQueue(): Promise<void> {
  try {
    const data = await api.get<any>("/queue/today");
    state = asArray<any>(data).map(toQueueRow);
    emit();
  } catch (err) {
    console.warn("[queue] load failed", err);
  }
}

export async function loadPatients(): Promise<void> {
  try {
    const data = await api.get<any>("/patients", { query: { type: "HOMEOPATHY" } });
    const rows = Array.isArray(data) ? data : data?.patients ?? [];
    if (Array.isArray(rows)) {
      patients = rows.map(toPatient);
      emit();
    }
  } catch (err) {
    console.warn("[patients] load failed", err);
  }
}

export async function loadAppointments(): Promise<void> {
  try {
    const data = await api.get<any>("/appointments/today");
    const rows = Array.isArray(data) ? data : data?.appointments ?? [];
    if (Array.isArray(rows)) {
      appointments = rows.map((a: any) => ({
        id: String(a.id ?? a.appointment_id),
        patient_id: String(a.patient_id ?? ""),
        patient_name: String(a.patient_name ?? a.full_name ?? "Patient"),
        patient_phone: String(a.patient_phone ?? a.phone ?? ""),
        scheduled_at: String(a.scheduled_at ?? a.slot_at ?? new Date().toISOString()),
        visit_type: "HOMEOPATHY",
        status: (a.status ?? "SCHEDULED") as ApptStatus,
        chief_complaint: a.chief_complaint ?? a.notes ?? undefined,
      })) as RxAppointment[];
      emit();
    }
  } catch (err) {
    console.warn("[appointments] load failed", err);
  }
}

/** Refresh everything (queue, patients, appointments) in parallel. */
export async function refreshAll(): Promise<void> {
  await Promise.allSettled([loadQueue(), loadPatients(), loadAppointments()]);
}


// ───────────────────────────────────────────────────────────
// Actions
// ───────────────────────────────────────────────────────────
function nextToken() {
  return state.reduce((m, q) => Math.max(m, q.token_number), 0) + 1;
}

export const queueActions = {
  setStatus(id: string, status: QueueStatus) {
    snapshot(`Status → ${status}`, id);
    state = state.map((q) => (q.queue_id === id ? { ...q, status } : q));
    emit();
  },
  /** Move a queue row to BILLING (doctor finished, awaiting reception payment). */
  markBilling(id: string) {
    snapshot(`→ Billing`, id);
    state = state.map((q) => (q.queue_id === id ? { ...q, status: "DONE" } : q));
    emit();
  },
  checkIn(id: string) {
    const row = state.find((q) => q.queue_id === id);
    if (!row) return;
    snapshot(`Checked in ${row.patient_name}`, id);
    state = state.map((q) =>
      q.queue_id === id ? { ...q, status: "CHECKED_IN", wait_minutes: 0 } : q,
    );
    emit();
  },
  async callIn(id: string, doctor: "ALLOPATHY" | "HOMEOPATHY" = "ALLOPATHY") {
    const row = state.find((q) => q.queue_id === id);
    if (!row) return;
    // No-op if patient is already with the doctor (prevents spurious notifications)
    if (row.status === "IN_TREATMENT") return;
    await api.post("/queue/next");
    snapshot(`Called ${row.patient_name}`, id);
    state = state.map((q) => {
      if (q.queue_id === id) return { ...q, status: "IN_TREATMENT", wait_minutes: 0 };
      if (q.status === "IN_TREATMENT") return { ...q, status: "WAITING" };
      return q;
    });
    // Drop any previous unacked call for this doctor — only one "send in" at a time per room
    calls = [
      ...calls.filter((c) => c.doctor !== doctor),
      {
        id: `call-${Date.now()}`,
        queue_id: id,
        patient_id: row.patient_id,
        patient_name: row.patient_name,
        token_number: row.token_number,
        doctor,
        at: Date.now(),
      },
    ];
    emit();
    void loadQueue();
  },
  acknowledgeCall(callId: string) {
    calls = calls.filter((c) => c.id !== callId);
    emit();
  },
  skip(id: string) {
    const row = state.find((q) => q.queue_id === id);
    if (!row) return;
    snapshot(`Skipped ${row.patient_name}`, id);
    state = state.map((q) =>
      q.queue_id === id ? { ...q, wait_minutes: -1, status: "WAITING" } : q,
    );
    emit();
  },
  collectPayment(id: string, mode: PaymentMode, amount?: number) {
    const row = state.find((q) => q.queue_id === id);
    if (!row) return null;
    snapshot(`Collected ${mode} ₹${amount ?? row.fee}`, id);
    state = state.map((q) =>
      q.queue_id === id
        ? {
            ...q,
            status: "DONE",
            paid: true,
            paid_with: mode,
            fee: amount ?? q.fee,
            invoice_sent: true,
            invoice_sent_at: Date.now(),
          }
        : q,
    );
    // Update patient last_visit
    patients = patients.map((p) =>
      p.id === row.patient_id
        ? {
            ...p,
            total_visits: p.total_visits + 1,
            last_visit: new Date().toISOString().slice(0, 10),
            history: [
              {
                visit_id: row.queue_id,
                date: new Date().toISOString().slice(0, 10),
                chief_complaint: row.notes,
                doctor_name: "Dr. R. Sharma",
                fee: amount ?? row.fee,
                paid_with: mode,
              },
              ...p.history,
            ],
          }
        : p,
    );
    emit();
    return { mode, amount: amount ?? row.fee };
  },
  resendInvoice(id: string) {
    state = state.map((q) =>
      q.queue_id === id ? { ...q, invoice_sent: true, invoice_sent_at: Date.now() } : q,
    );
    emit();
  },
  complete(id: string) {
    snapshot(`Completed`, id);
    state = state.map((q) => (q.queue_id === id ? { ...q, status: "DONE" } : q));
    emit();
  },
  noShow(id: string) {
    snapshot(`No-show`, id);
    state = state.map((q) => (q.queue_id === id ? { ...q, status: "NO_SHOW" } : q));
    emit();
  },
  remove(id: string) {
    snapshot(`Removed`, id);
    state = state.filter((q) => q.queue_id !== id);
    emit();
  },
  async add(item: {
    patient_id: string;
    patient_name: string;
    patient_phone: string;
    visit_type: VisitType;
    priority?: 0 | 1;
    notes?: string;
  }) {
    const dupe = state.find((q) => {
      const samePatient = q.patient_id === item.patient_id;
      const samePhone = q.patient_phone.replace(/\s+/g, "") === item.patient_phone.replace(/\s+/g, "");
      return (samePatient || samePhone) && !["DONE", "COMPLETED", "NO_SHOW", "CANCELLED"].includes(q.status);
    });
    if (dupe) return { token: dupe.token_number, duplicate: true } as const;
    const created = await api.post<any>("/queue/add", {
      patient_id: item.patient_id,
      visit_type: item.visit_type,
      priority: item.priority ?? 0,
      notes: item.notes ?? null,
    });
    snapshot(`Added ${item.patient_name}`, String(created?.id ?? created?.queue_id ?? item.patient_id));
    await loadQueue();
    const row = state.find((q) => q.patient_id === item.patient_id && q.status === "WAITING");
    return { token: Number(created?.token_number ?? row?.token_number ?? nextToken()), duplicate: false } as const;
  },
  createPatient(name: string, phone: string, extra?: Partial<ExtendedPatient>) {
    const existing = patients.find(
      (p) => p.phone.replace(/\s+/g, "") === phone.replace(/\s+/g, ""),
    );
    if (existing) return { patient: existing, created: false } as const;
    const id = `p-${Date.now()}`;
    const reg_no = `VHC-${1042 + patients.length + 1}`;
    const np: ExtendedPatient = {
      id,
      reg_no,
      full_name: name,
      phone,
      city: extra?.city ?? "",
      patient_type: extra?.patient_type ?? "HOMEOPATHY",
      total_visits: 0,
      last_visit: null,
      is_missed: false,
      history: [],
      ...extra,
    };
    patients = [np, ...patients];
    emit();
    return { patient: np, created: true } as const;
  },
  updatePatientDiagnosis(
    patientId: string,
    visitData: { diagnosis: string; prescription: string; chief_complaint?: string; doctor_name?: string },
  ) {
    patients = patients.map((p) => {
      if (p.id !== patientId) return p;
      const updated = p.history.map((h, i) =>
        i === 0 ? { ...h, ...visitData } : h,
      );
      return { ...p, history: updated };
    });
    emit();
  },
  undo() {
    const prev = undoStack.pop();
    if (!prev) return false;
    state = prev;
    recent = recent.slice(1);
    emit();
    return true;
  },
  // Appointments
  addAppointment(appt: Omit<RxAppointment, "id">) {
    const newAppt: RxAppointment = { ...appt, id: `a-${Date.now()}` };
    appointments = [...appointments, newAppt].sort((a, b) =>
      a.scheduled_at.localeCompare(b.scheduled_at),
    );
    emit();
    return newAppt;
  },
  updateAppointmentStatus(id: string, status: ApptStatus) {
    appointments = appointments.map((a) => (a.id === id ? { ...a, status } : a));
    emit();
  },
  checkInAppointment(apptId: string) {
    const appt = appointments.find((a) => a.id === apptId);
    if (!appt) return;
    appointments = appointments.map((a) =>
      a.id === apptId ? { ...a, status: "COMPLETED" } : a,
    );
    const patient = patients.find((p) => p.id === appt.patient_id);
    if (patient) {
      void queueActions.add({
        patient_id: patient.id,
        patient_name: patient.full_name,
        patient_phone: patient.phone,
        visit_type: "APPOINTMENT",
        notes: appt.chief_complaint,
      });
    }
    emit();
  },
  // Billing
  markBillPaid(visitId: string, mode: PaymentMode, fee: number) {
    bills = bills.filter((b) => b.visit_id !== visitId);
    emit();
  },
};

export function findPatient(query: string): ExtendedPatient[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return patients
    .filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.phone.replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ||
        p.reg_no.toLowerCase().includes(q),
    )
    .slice(0, 6);
}

export function feeFor(visitType: VisitType) {
  return FEE_BY_TYPE[visitType];
}

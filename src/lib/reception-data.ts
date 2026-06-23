// Mock data matching backend schemas (receptionist role)

export type QueueStatus = "WAITING" | "CHECKED_IN" | "IN_TREATMENT" | "BILLING_PENDING" | "DONE" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
export type VisitType = "WALKIN" | "APPOINTMENT";
export type ClinicType = "HOMEOPATHY" | "ALLOPATHY";
export type PatientType = "HOMEOPATHY" | "ALLOPATHY" | "BOTH";
export type ApptStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type PaymentMode = "CASH" | "UPI" | "ONLINE" | "CARD";
export type PaymentStatus = "PENDING" | "PAID";
export type FollowupType = "THREE_DAY" | "SEVEN_DAY" | "FIFTEEN_DAY" | "MONTHLY" | "CUSTOM";
export type FollowupStatus = "PENDING" | "SENT" | "DONE" | "SKIPPED" | "FAILED";
export type Channel = "WHATSAPP" | "SMS" | "VOICE" | "EMAIL";

export type RxPatient = {
  id: string;
  reg_no: string;
  full_name: string;
  phone: string;
  city: string;
  patient_type: PatientType;
  total_visits: number;
  last_visit: string | null;
  is_missed: boolean;
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
};

// Live data only — populated by queue-store loaders from the backend.
export const rxPatients: RxPatient[] = [];

export type RxQueue = {
  queue_id: string;
  token_number: number;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  visit_id?: string;
  status: QueueStatus;
  visit_type: VisitType;
  priority: 0 | 1;
  wait_minutes: number;
  notes?: string;
};

export const rxQueue: RxQueue[] = [];

export const rxQueueStats = {
  total_today: 0,
  waiting: 0,
  in_progress: 0,
  completed: 0,
  no_show: 0,
};

export type RxAppointment = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  scheduled_at: string; // ISO
  visit_type: ClinicType;
  status: ApptStatus;
  chief_complaint?: string;
  duration_mins: number;
  notes?: string;
};

export const rxAppointments: RxAppointment[] = [];

export type RxBill = {
  visit_id: string;
  queue_id: string;
  token_number: number;
  patient_id: string;
  patient_name: string;
  visit_type: ClinicType;
  chief_complaint: string;
  doctor_name: string;
  payment_status: PaymentStatus;
  suggested_fee: number;
};

export const rxPendingBills: RxBill[] = [];

export const rxRevenueToday = {
  total: 0,
  CASH: 0,
  UPI: 0,
  CARD: 0,
  ONLINE: 0,
  count: 0,
};

export type RxReminder = {
  followup_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  followup_type: FollowupType;
  due_date: string;
  status: FollowupStatus;
  channel: Channel;
  sent_at?: string;
};

export const rxReminders: RxReminder[] = [];

// ---------- helpers ----------

export const queueStatusStyles: Record<QueueStatus, { dot: string; pill: string; label: string }> = {
  WAITING:      { dot: "bg-amber-500",  pill: "bg-amber-500/15 text-amber-700 border-amber-500/30",     label: "Waiting" },
  CHECKED_IN:   { dot: "bg-blue-500",   pill: "bg-blue-500/15 text-blue-700 border-blue-500/30",        label: "Checked-in" },
  IN_TREATMENT: { dot: "bg-success",    pill: "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30", label: "In treatment" },
  BILLING_PENDING: { dot: "bg-violet-500", pill: "bg-violet-500/15 text-violet-700 border-violet-500/30", label: "Billing" },
  DONE:         { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground border-border",     label: "Done" },
  COMPLETED:    { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground border-border",     label: "Completed" },
  NO_SHOW:      { dot: "bg-destructive",pill: "bg-destructive/15 text-destructive border-destructive/30", label: "No show" },
  CANCELLED:    { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground/70 border-border line-through", label: "Cancelled" },
};

export const apptStatusStyles: Record<ApptStatus, string> = {
  SCHEDULED: "bg-muted text-muted-foreground border-border",
  CONFIRMED: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  COMPLETED: "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
  NO_SHOW:   "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

export const followupStatusStyles: Record<FollowupStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  SENT:    "bg-blue-500/15 text-blue-700 border-blue-500/30",
  DONE:    "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30",
  SKIPPED: "bg-muted text-muted-foreground border-border",
  FAILED:  "bg-destructive/15 text-destructive border-destructive/30",
};

export const followupTypeLabel: Record<FollowupType, string> = {
  THREE_DAY: "3-day",
  SEVEN_DAY: "7-day",
  FIFTEEN_DAY: "15-day",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
};

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

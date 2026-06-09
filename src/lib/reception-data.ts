// Mock data matching backend schemas (receptionist role)

export type QueueStatus = "WAITING" | "CHECKED_IN" | "IN_TREATMENT" | "DONE" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
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

export const rxPatients: RxPatient[] = [
  { id: "p1", reg_no: "VHC-1042", full_name: "Anjali Mehta", phone: "+91 98200 11122", city: "Mumbai", patient_type: "HOMEOPATHY", total_visits: 12, last_visit: "2026-05-10", is_missed: false, age: 34, gender: "FEMALE" },
  { id: "p2", reg_no: "VHC-1041", full_name: "Ravi Kumar", phone: "+91 99300 22113", city: "Pune", patient_type: "BOTH", total_visits: 8, last_visit: "2026-05-09", is_missed: false, age: 47, gender: "MALE" },
  { id: "p3", reg_no: "VHC-1040", full_name: "Priya Singh", phone: "+91 90100 33214", city: "Mumbai", patient_type: "HOMEOPATHY", total_visits: 3, last_visit: "2026-05-06", is_missed: false, age: 28, gender: "FEMALE" },
  { id: "p4", reg_no: "VHC-1039", full_name: "Mahesh Iyer", phone: "+91 98765 44315", city: "Thane", patient_type: "ALLOPATHY", total_visits: 21, last_visit: "2026-05-04", is_missed: false, age: 52, gender: "MALE" },
  { id: "p5", reg_no: "VHC-1038", full_name: "Neha Gupta", phone: "+91 99887 55416", city: "Navi Mumbai", patient_type: "HOMEOPATHY", total_visits: 5, last_visit: "2026-04-27", is_missed: false, age: 31, gender: "FEMALE" },
  { id: "p6", reg_no: "VHC-1037", full_name: "Sandeep Shah", phone: "+91 98123 66517", city: "Mumbai", patient_type: "BOTH", total_visits: 17, last_visit: "2026-04-13", is_missed: true, age: 60, gender: "MALE" },
  { id: "p7", reg_no: "VHC-1036", full_name: "Kavita Rao", phone: "+91 98801 77711", city: "Pune", patient_type: "HOMEOPATHY", total_visits: 9, last_visit: "2026-05-08", is_missed: false, age: 41, gender: "FEMALE" },
  { id: "p8", reg_no: "VHC-1035", full_name: "Arjun Patel", phone: "+91 90901 11220", city: "Mumbai", patient_type: "HOMEOPATHY", total_visits: 2, last_visit: "2026-05-04", is_missed: false, age: 7, gender: "MALE" },
  { id: "p9", reg_no: "VHC-1034", full_name: "Sunita Desai", phone: "+91 98345 88823", city: "Mumbai", patient_type: "HOMEOPATHY", total_visits: 14, last_visit: "2026-03-21", is_missed: true, age: 58, gender: "FEMALE" },
];

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

const today = new Date();
const at = (h: number, m: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).toISOString();

export const rxAppointments: RxAppointment[] = [
  { id: "a1", patient_id: "p1", patient_name: "Anjali Mehta", patient_phone: "+91 98200 11122", scheduled_at: at(10, 0), visit_type: "HOMEOPATHY", status: "COMPLETED", chief_complaint: "Anxiety, insomnia", duration_mins: 30 },
  { id: "a2", patient_id: "p2", patient_name: "Ravi Kumar", patient_phone: "+91 99300 22113", scheduled_at: at(10, 30), visit_type: "HOMEOPATHY", status: "CONFIRMED", chief_complaint: "Diabetes follow-up", duration_mins: 30 },
  { id: "a3", patient_id: "p4", patient_name: "Mahesh Iyer", patient_phone: "+91 98765 44315", scheduled_at: at(11, 0), visit_type: "ALLOPATHY", status: "SCHEDULED", chief_complaint: "Chest discomfort", duration_mins: 45 },
  { id: "a4", patient_id: "p7", patient_name: "Kavita Rao", patient_phone: "+91 98801 77711", scheduled_at: at(11, 45), visit_type: "HOMEOPATHY", status: "SCHEDULED", chief_complaint: "Migraine review", duration_mins: 30 },
  { id: "a5", patient_id: "p3", patient_name: "Priya Singh", patient_phone: "+91 90100 33214", scheduled_at: at(14, 0), visit_type: "HOMEOPATHY", status: "SCHEDULED", chief_complaint: "Skin allergy", duration_mins: 30 },
  { id: "a6", patient_id: "p9", patient_name: "Sunita Desai", patient_phone: "+91 98345 88823", scheduled_at: at(15, 30), visit_type: "HOMEOPATHY", status: "CANCELLED", chief_complaint: "Routine", duration_mins: 30 },
];

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

export const rxPendingBills: RxBill[] = [
  { visit_id: "v-2055", queue_id: "q7", token_number: 13, patient_id: "p7", patient_name: "Kavita Rao", visit_type: "HOMEOPATHY", chief_complaint: "Migraine review", doctor_name: "Dr. R. Sharma", payment_status: "PENDING", suggested_fee: 600 },
  { visit_id: "v-2054", queue_id: "q9", token_number: 11, patient_id: "p5", patient_name: "Neha Gupta", visit_type: "HOMEOPATHY", chief_complaint: "Allergy follow-up", doctor_name: "Dr. R. Sharma", payment_status: "PENDING", suggested_fee: 500 },
  { visit_id: "v-2053", queue_id: "q10", token_number: 10, patient_id: "p4", patient_name: "Mahesh Iyer", visit_type: "ALLOPATHY", chief_complaint: "Hypertension review", doctor_name: "Dr. Meera Joshi", payment_status: "PENDING", suggested_fee: 800 },
];

export const rxRevenueToday = {
  total: 6800,
  CASH: 1800,
  UPI: 3600,
  CARD: 0,
  ONLINE: 1400,
  count: 9,
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

export const rxReminders: RxReminder[] = [
  { followup_id: "f1", patient_id: "p1", patient_name: "Anjali Mehta", patient_phone: "+91 98200 11122", followup_type: "SEVEN_DAY", due_date: today.toISOString(), status: "PENDING", channel: "WHATSAPP" },
  { followup_id: "f2", patient_id: "p2", patient_name: "Ravi Kumar", patient_phone: "+91 99300 22113", followup_type: "FIFTEEN_DAY", due_date: today.toISOString(), status: "SENT", channel: "WHATSAPP", sent_at: at(9, 30) },
  { followup_id: "f3", patient_id: "p4", patient_name: "Mahesh Iyer", patient_phone: "+91 98765 44315", followup_type: "THREE_DAY", due_date: today.toISOString(), status: "PENDING", channel: "SMS" },
  { followup_id: "f4", patient_id: "p6", patient_name: "Sandeep Shah", patient_phone: "+91 98123 66517", followup_type: "MONTHLY", due_date: today.toISOString(), status: "FAILED", channel: "WHATSAPP" },
  { followup_id: "f5", patient_id: "p7", patient_name: "Kavita Rao", patient_phone: "+91 98801 77711", followup_type: "CUSTOM", due_date: today.toISOString(), status: "DONE", channel: "VOICE", sent_at: at(8, 15) },
  { followup_id: "f6", patient_id: "p9", patient_name: "Sunita Desai", patient_phone: "+91 98345 88823", followup_type: "MONTHLY", due_date: today.toISOString(), status: "PENDING", channel: "EMAIL" },
];

// ---------- helpers ----------

export const queueStatusStyles: Record<QueueStatus, { dot: string; pill: string; label: string }> = {
  WAITING:      { dot: "bg-amber-500",  pill: "bg-amber-500/15 text-amber-700 border-amber-500/30",     label: "Waiting" },
  CHECKED_IN:   { dot: "bg-blue-500",   pill: "bg-blue-500/15 text-blue-700 border-blue-500/30",        label: "Checked-in" },
  IN_TREATMENT: { dot: "bg-success",    pill: "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30", label: "In treatment" },
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

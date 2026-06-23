// Mock data for the owner/admin console.

export type StaffPerf = {
  id: string;
  name: string;
  role: "Doctor (Allopathy)" | "Doctor (Homeopathy)" | "Receptionist" | "Pharmacist";
  initials: string;
  patients_today: number;
  avg_consult_min: number;
  collections_today: number;
  on_duty: boolean;
  satisfaction: number; // 0..100
};

export const staffPerf: StaffPerf[] = [
  { id: "S1", name: "Dr. R. Sharma",  role: "Doctor (Homeopathy)", initials: "RS", patients_today: 12, avg_consult_min: 18, collections_today: 9600,  on_duty: true,  satisfaction: 96 },
  { id: "S2", name: "Dr. Meera Joshi", role: "Doctor (Allopathy)",  initials: "MJ", patients_today: 9,  avg_consult_min: 14, collections_today: 11200, on_duty: true,  satisfaction: 92 },
  { id: "S3", name: "Sakshi Patel",    role: "Receptionist",        initials: "SP", patients_today: 24, avg_consult_min: 3,  collections_today: 6600,  on_duty: true,  satisfaction: 89 },
  { id: "S4", name: "Vikram Rao",      role: "Pharmacist",          initials: "VR", patients_today: 0,  avg_consult_min: 0,  collections_today: 0,     on_duty: false, satisfaction: 0 },
];

export type AuditEvent = {
  id: string;
  actor: string;
  actor_role: string;
  action: string;
  target: string;
  at: string;
  severity: "info" | "warn" | "critical";
};

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

export const auditEvents: AuditEvent[] = [
  { id: "e1", actor: "Sakshi Patel",    actor_role: "Receptionist", action: "Called in patient",       target: "Token #15 · Ravi Kumar",            at: ago(2),   severity: "info" },
  { id: "e2", actor: "Dr. R. Sharma",   actor_role: "Doctor",       action: "Completed consultation",  target: "Visit v-2058 · Anjali Mehta",       at: ago(6),   severity: "info" },
  { id: "e3", actor: "Sakshi Patel",    actor_role: "Receptionist", action: "Collected ₹600 UPI",      target: "INV-9821",                          at: ago(9),   severity: "info" },
  { id: "e4", actor: "Dr. Meera Joshi", actor_role: "Doctor",       action: "Edited prescription",     target: "RX-3017 · Ravi Kumar",              at: ago(14),  severity: "warn" },
  { id: "e5", actor: "System",          actor_role: "System",       action: "WhatsApp delivery failed", target: "Follow-up f4 · Sandeep Shah",      at: ago(22),  severity: "critical" },
  { id: "e6", actor: "Sakshi Patel",    actor_role: "Receptionist", action: "Registered new patient",  target: "VHC-1043 · Megha Joshi",            at: ago(38),  severity: "info" },
  { id: "e7", actor: "Dr. R. Sharma",   actor_role: "Doctor",       action: "Marked patient NO_SHOW",  target: "Token #12 · Sandeep Shah",          at: ago(54),  severity: "warn" },
  { id: "e8", actor: "Sakshi Patel",    actor_role: "Receptionist", action: "Cancelled appointment",   target: "A6 · Sunita Desai",                 at: ago(72),  severity: "warn" },
  { id: "e9", actor: "System",          actor_role: "System",       action: "Daily backup completed",  target: "Cloud · 412 MB",                    at: ago(180), severity: "info" },
  { id: "e10",actor: "Vikram Rao",      actor_role: "Pharmacist",   action: "Low stock alert",         target: "Pulsatilla 200C · 8 units left",    at: ago(240), severity: "critical" },
];

export type RevenueSeries = { d: string; allopathy: number; homeopathy: number; total: number };

export const revenue14d: RevenueSeries[] = Array.from({ length: 14 }, (_, i) => {
  const day = new Date();
  day.setDate(day.getDate() - (13 - i));
  const allo = 4000 + Math.round(Math.sin(i / 2) * 1800 + i * 380 + 2200);
  const homeo = 3000 + Math.round(Math.cos(i / 3) * 1400 + i * 260 + 1800);
  return {
    d: day.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    allopathy: allo,
    homeopathy: homeo,
    total: allo + homeo,
  };
});
export const revenue30d: RevenueSeries[] = revenue14d; // alias kept for backward compatibility

// 12 months for monthly view
export const revenue12m = Array.from({ length: 12 }, (_, i) => {
  const day = new Date();
  day.setMonth(day.getMonth() - (11 - i));
  const allo = 95000 + Math.round(Math.sin(i / 2) * 18000 + i * 4200);
  const homeo = 72000 + Math.round(Math.cos(i / 3) * 14000 + i * 3100);
  return {
    d: day.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    allopathy: allo,
    homeopathy: homeo,
    total: allo + homeo,
  };
});

// 24h hourly revenue (for "today")
export const revenueHourly = Array.from({ length: 13 }, (_, i) => {
  const h = 8 + i; // 08:00 .. 20:00
  const v = h >= 9 && h <= 19 ? Math.round(400 + Math.sin((h - 9) / 2) * 800 + (h % 3) * 240) : 0;
  return { d: `${String(h).padStart(2, "0")}:00`, allopathy: Math.round(v * 0.6), homeopathy: Math.round(v * 0.4), total: v };
});

export type PaymentBucket = { name: "UPI" | "Cash" | "Card" | "Online"; value: number; color: string };

export const paymentMix: PaymentBucket[] = [
  { name: "UPI",    value: 38600, color: "oklch(0.55 0.14 295)" },
  { name: "Cash",   value: 21400, color: "oklch(0.78 0.14 75)" },
  { name: "Card",   value: 9200,  color: "oklch(0.42 0.08 250)" },
  { name: "Online", value: 7800,  color: "oklch(0.38 0.16 285)" },
];

// Payment method trend over last 14 days (stacked area)
export const paymentTrend14d = Array.from({ length: 14 }, (_, i) => {
  const day = new Date();
  day.setDate(day.getDate() - (13 - i));
  return {
    d: day.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    UPI: 1800 + Math.round(Math.sin(i / 2) * 600 + i * 120),
    Cash: 900 + Math.round(Math.cos(i / 3) * 400 + i * 60),
    Card: 400 + Math.round(Math.sin(i / 4) * 220),
    Online: 300 + Math.round(Math.cos(i / 2) * 200),
  };
});

export const opdSplit = [
  { name: "Allopathy",  value: 58, color: "oklch(0.42 0.08 250)" },
  { name: "Homeopathy", value: 42, color: "oklch(0.55 0.14 295)" },
];

// Patient counts over time
export const patientCount14d = Array.from({ length: 14 }, (_, i) => {
  const day = new Date();
  day.setDate(day.getDate() - (13 - i));
  return {
    d: day.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    appointments: 12 + Math.round(Math.sin(i / 2) * 5 + i * 0.3),
    walkins:      6  + Math.round(Math.cos(i / 3) * 3 + (i % 4)),
  };
});

export const alerts = [
  { id: "al1", level: "critical" as const, title: "WhatsApp delivery failures", detail: "3 follow-ups failed in the last hour. Check API credits." },
  { id: "al2", level: "critical" as const, title: "Pulsatilla 200C low stock", detail: "Only 8 units left. Reorder threshold is 20." },
  { id: "al3", level: "warn"     as const, title: "Avg wait time rising",      detail: "Today's average wait is 22 min (target ≤ 15)." },
  { id: "al4", level: "warn"     as const, title: "5 patients overdue 30d+",   detail: "Send batch reminder to re-engage." },
];

export const alertStyles = {
  critical: "bg-destructive/10 border-destructive/30 text-destructive",
  warn:     "bg-amber-500/10 border-amber-500/30 text-amber-700",
  info:     "bg-blue-500/10 border-blue-500/30 text-blue-700",
};

export function timeAgo(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ---------- Doctor performance ----------

export type DoctorPerf = {
  id: string;
  name: string;
  initials: string;
  branch: "Allopathy" | "Homeopathy";
  patients_today: number;
  patients_week: number;
  patients_month: number;
  in_treatment_now: number;
  avg_consult_min: number;
  collections_today: number;
  satisfaction: number;
  on_duty: boolean;
};

export const doctorsPerf: DoctorPerf[] = [
  { id: "D1", name: "Dr. R. Sharma",    initials: "RS", branch: "Homeopathy", patients_today: 12, patients_week: 74, patients_month: 308, in_treatment_now: 1, avg_consult_min: 18, collections_today: 9600,  satisfaction: 96, on_duty: true },
  { id: "D2", name: "Dr. Meera Joshi",  initials: "MJ", branch: "Allopathy",  patients_today: 9,  patients_week: 61, patients_month: 264, in_treatment_now: 1, avg_consult_min: 14, collections_today: 11200, satisfaction: 92, on_duty: true },
  { id: "D3", name: "Dr. Aakash Verma", initials: "AV", branch: "Allopathy",  patients_today: 7,  patients_week: 48, patients_month: 211, in_treatment_now: 0, avg_consult_min: 16, collections_today: 7800,  satisfaction: 90, on_duty: true },
];

// ---------- Receptionist daily tasks ----------

export type DailyTask = {
  id: string;
  receptionist: string;
  task: string;
  category: "Reminders" | "Follow-ups" | "Billing" | "Admin";
  target: number;
  done: number;
  due_by: string; // "18:00"
  status: "DONE" | "IN_PROGRESS" | "PENDING" | "MISSED";
};

export const dailyTasks: DailyTask[] = [
  { id: "t1", receptionist: "Sakshi Patel", task: "Send WhatsApp reminders for tomorrow's appointments", category: "Reminders",  target: 14, done: 14, due_by: "13:00", status: "DONE" },
  { id: "t2", receptionist: "Sakshi Patel", task: "Send 3-day post-consult follow-ups",                  category: "Follow-ups", target: 8,  done: 6,  due_by: "17:00", status: "IN_PROGRESS" },
  { id: "t3", receptionist: "Sakshi Patel", task: "Send 7-day post-consult follow-ups",                  category: "Follow-ups", target: 6,  done: 5,  due_by: "17:00", status: "IN_PROGRESS" },
  { id: "t4", receptionist: "Sakshi Patel", task: "Send 15-day post-consult follow-ups",                 category: "Follow-ups", target: 4,  done: 0,  due_by: "17:30", status: "PENDING" },
  { id: "t5", receptionist: "Sakshi Patel", task: "Reconcile end-of-day cash drawer",                    category: "Billing",    target: 1,  done: 0,  due_by: "20:30", status: "PENDING" },
  { id: "t6", receptionist: "Sakshi Patel", task: "Re-engage 30-day overdue patients",                   category: "Follow-ups", target: 5,  done: 0,  due_by: "16:00", status: "MISSED" },
];

export const taskStatusStyles: Record<DailyTask["status"], string> = {
  DONE:        "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  PENDING:     "bg-amber-500/15 text-amber-700 border-amber-500/30",
  MISSED:      "bg-destructive/15 text-destructive border-destructive/30",
};

// ---------- Billing logs / invoices ----------

export type InvoiceRecord = {
  id: string;
  invoice_no: string;
  patient_name: string;
  patient_reg: string;
  doctor: string;
  branch: "Allopathy" | "Homeopathy";
  amount: number;
  gst: number; // amount of GST included
  mode: "CASH" | "UPI" | "CARD" | "ONLINE";
  status: "PAID" | "PENDING" | "REFUNDED";
  issued_at: string; // ISO
  collected_by: string;
};

const t = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const invoices: InvoiceRecord[] = [
  { id: "i1",  invoice_no: "INV-9824", patient_name: "Anjali Mehta",  patient_reg: "VHC-1042", doctor: "Dr. R. Sharma",    branch: "Homeopathy", amount: 600,  gst: 0,    mode: "UPI",    status: "PAID",     issued_at: t(10, 32), collected_by: "Sakshi Patel" },
  { id: "i2",  invoice_no: "INV-9823", patient_name: "Ravi Kumar",    patient_reg: "VHC-1041", doctor: "Dr. Meera Joshi",  branch: "Allopathy",  amount: 800,  gst: 0,    mode: "CASH",   status: "PAID",     issued_at: t(10, 12), collected_by: "Sakshi Patel" },
  { id: "i3",  invoice_no: "INV-9822", patient_name: "Mahesh Iyer",   patient_reg: "VHC-1039", doctor: "Dr. Meera Joshi",  branch: "Allopathy",  amount: 1200, gst: 216,  mode: "CARD",   status: "PAID",     issued_at: t(11, 5),  collected_by: "Sakshi Patel" },
  { id: "i4",  invoice_no: "INV-9821", patient_name: "Priya Singh",   patient_reg: "VHC-1040", doctor: "Dr. R. Sharma",    branch: "Homeopathy", amount: 500,  gst: 0,    mode: "UPI",    status: "PAID",     issued_at: t(11, 41), collected_by: "Sakshi Patel" },
  { id: "i5",  invoice_no: "INV-9820", patient_name: "Neha Gupta",    patient_reg: "VHC-1038", doctor: "Dr. R. Sharma",    branch: "Homeopathy", amount: 500,  gst: 0,    mode: "ONLINE", status: "PENDING",  issued_at: t(12, 4),  collected_by: "Sakshi Patel" },
  { id: "i6",  invoice_no: "INV-9819", patient_name: "Sunita Desai",  patient_reg: "VHC-1034", doctor: "Dr. R. Sharma",    branch: "Homeopathy", amount: 600,  gst: 0,    mode: "UPI",    status: "PAID",     issued_at: t(12, 22), collected_by: "Sakshi Patel" },
  { id: "i7",  invoice_no: "INV-9818", patient_name: "Kavita Rao",    patient_reg: "VHC-1036", doctor: "Dr. R. Sharma",    branch: "Homeopathy", amount: 600,  gst: 0,    mode: "CASH",   status: "PENDING",  issued_at: t(13, 8),  collected_by: "Sakshi Patel" },
  { id: "i8",  invoice_no: "INV-9817", patient_name: "Arjun Patel",   patient_reg: "VHC-1035", doctor: "Dr. Aakash Verma", branch: "Allopathy",  amount: 700,  gst: 126,  mode: "UPI",    status: "PAID",     issued_at: t(13, 46), collected_by: "Sakshi Patel" },
  { id: "i9",  invoice_no: "INV-9816", patient_name: "Sandeep Shah",  patient_reg: "VHC-1037", doctor: "Dr. Aakash Verma", branch: "Allopathy",  amount: 900,  gst: 162,  mode: "CARD",   status: "REFUNDED", issued_at: t(14, 18), collected_by: "Sakshi Patel" },
  { id: "i10", invoice_no: "INV-9815", patient_name: "Megha Joshi",   patient_reg: "VHC-1043", doctor: "Dr. R. Sharma",    branch: "Homeopathy", amount: 500,  gst: 0,    mode: "UPI",    status: "PAID",     issued_at: t(14, 52), collected_by: "Sakshi Patel" },
];

export const invoiceStatusStyles: Record<InvoiceRecord["status"], string> = {
  PAID:     "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30",
  PENDING:  "bg-amber-500/15 text-amber-700 border-amber-500/30",
  REFUNDED: "bg-destructive/15 text-destructive border-destructive/30",
};

// ---------- Staff management roster ----------

export type StaffMember = {
  id: string;
  name: string;
  role: "Doctor" | "Receptionist" | "Pharmacist" | "Owner";
  branch?: "Allopathy" | "Homeopathy" | "Both";
  email: string;
  phone: string;
  joined: string; // YYYY-MM-DD
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
};

export const staffRoster: StaffMember[] = [
  { id: "M1", name: "Dr. R. Sharma",    role: "Doctor",       branch: "Homeopathy", email: "r.sharma@vedicclinic.in",  phone: "+91 98201 11000", joined: "2021-04-12", status: "ACTIVE" },
  { id: "M2", name: "Dr. Meera Joshi",  role: "Doctor",       branch: "Allopathy",  email: "m.joshi@vedicclinic.in",   phone: "+91 98203 22000", joined: "2022-07-01", status: "ACTIVE" },
  { id: "M3", name: "Dr. Aakash Verma", role: "Doctor",       branch: "Allopathy",  email: "a.verma@vedicclinic.in",   phone: "+91 98205 33000", joined: "2024-02-18", status: "ACTIVE" },
  { id: "M4", name: "Sakshi Patel",     role: "Receptionist",                       email: "sakshi@vedicclinic.in",    phone: "+91 90011 44000", joined: "2023-01-09", status: "ACTIVE" },
  { id: "M5", name: "Vikram Rao",       role: "Pharmacist",                         email: "vikram@vedicclinic.in",    phone: "+91 90022 55000", joined: "2023-09-22", status: "ON_LEAVE" },
  { id: "M6", name: "Owner",            role: "Owner",                              email: "owner@vedicclinic.in",     phone: "+91 90099 99999", joined: "2020-01-01", status: "ACTIVE" },
];

export const staffStatusStyles: Record<StaffMember["status"], string> = {
  ACTIVE:   "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30",
  INACTIVE: "bg-muted text-muted-foreground border-border",
  ON_LEAVE: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

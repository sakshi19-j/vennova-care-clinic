export type PatientTag =
  | "chronic"
  | "follow-up"
  | "new"
  | "vip"
  | "diabetic"
  | "allergy"
  | "elderly"
  | "child"
  | "lapsed"
  | "active";

export type QueueStatus = "waiting" | "in-consult" | "billing" | "done" | "no-show" | "emergency";

export type Patient = {
  id: string;
  name: string;
  age: number;
  sex: "M" | "F";
  phone: string;
  visits: number;
  lastVisit: string;
  tags: PatientTag[];
  constitution?: string;
  miasm?: string;
  notes?: string;
};

export const patients: Patient[] = [
  { id: "P-1042", name: "Anjali Mehta", age: 34, sex: "F", phone: "+91 98200 11122", visits: 12, lastVisit: "Today", tags: ["chronic", "follow-up"], constitution: "Phosphoric", miasm: "Psoric", notes: "Anxiety, sleep issues" },
  { id: "P-1041", name: "Ravi Kumar", age: 47, sex: "M", phone: "+91 99300 22113", visits: 8, lastVisit: "2d ago", tags: ["follow-up", "diabetic"], constitution: "Sulphuric", miasm: "Sycotic" },
  { id: "P-1040", name: "Priya Singh", age: 28, sex: "F", phone: "+91 90100 33214", visits: 3, lastVisit: "5d ago", tags: ["new"], constitution: "Calcarea" },
  { id: "P-1039", name: "Mahesh Iyer", age: 52, sex: "M", phone: "+91 98765 44315", visits: 21, lastVisit: "1w ago", tags: ["chronic", "vip"], constitution: "Lycopodium", miasm: "Tubercular" },
  { id: "P-1038", name: "Neha Gupta", age: 31, sex: "F", phone: "+91 99887 55416", visits: 5, lastVisit: "2w ago", tags: ["active", "allergy"] },
  { id: "P-1037", name: "Sandeep Shah", age: 60, sex: "M", phone: "+91 98123 66517", visits: 17, lastVisit: "1mo ago", tags: ["lapsed", "elderly"] },
  { id: "P-1036", name: "Kavita Rao", age: 41, sex: "F", phone: "+91 98801 77711", visits: 9, lastVisit: "3d ago", tags: ["chronic"] },
  { id: "P-1035", name: "Arjun Patel", age: 7, sex: "M", phone: "+91 90901 11220", visits: 2, lastVisit: "1w ago", tags: ["child", "new"] },
];

export type QueueItem = {
  token: number;
  patientId: string;
  status: QueueStatus;
  type: "Follow-up" | "New" | "Emergency";
  waitingMin: number;
  consultMin?: number;
  priority?: "elderly" | "child" | "emergency" | null;
};

export const queue: QueueItem[] = [
  { token: 14, patientId: "P-1042", status: "in-consult", type: "Follow-up", waitingMin: 0, consultMin: 18 },
  { token: 15, patientId: "P-1041", status: "waiting", type: "Follow-up", waitingMin: 24 },
  { token: 16, patientId: "P-1040", status: "waiting", type: "New", waitingMin: 12 },
  { token: 17, patientId: "P-1039", status: "waiting", type: "Follow-up", waitingMin: 6, priority: "elderly" },
  { token: 18, patientId: "P-1038", status: "waiting", type: "New", waitingMin: 3 },
  { token: 19, patientId: "P-1035", status: "waiting", type: "New", waitingMin: 2, priority: "child" },
];

export const completedToday = [
  { token: 13, patientId: "P-1036", status: "done" as QueueStatus, type: "Follow-up" as const },
  { token: 12, patientId: "P-1037", status: "no-show" as QueueStatus, type: "New" as const },
  { token: 11, patientId: "P-1035", status: "done" as QueueStatus, type: "New" as const },
];

export type Appointment = {
  id: string;
  patientId: string;
  day: number; // 0..6 mon-sun
  time: string;
  type: "New" | "Follow-up";
};

export const appointments: Appointment[] = [
  { id: "A1", patientId: "P-1042", day: 0, time: "10:00", type: "Follow-up" },
  { id: "A2", patientId: "P-1041", day: 0, time: "10:30", type: "New" },
  { id: "A3", patientId: "P-1040", day: 1, time: "11:30", type: "Follow-up" },
  { id: "A4", patientId: "P-1037", day: 3, time: "09:30", type: "Follow-up" },
  { id: "A5", patientId: "P-1039", day: 5, time: "11:00", type: "Follow-up" },
  { id: "A6", patientId: "P-1038", day: 2, time: "14:00", type: "New" },
  { id: "A7", patientId: "P-1036", day: 4, time: "15:30", type: "Follow-up" },
];

export const todaySchedule = [
  { time: "10:00", patientId: "P-1042", type: "Follow-up" as const },
  { time: "10:30", patientId: "P-1041", type: "New" as const },
  { time: "11:00", patientId: "P-1040", type: "Follow-up" as const },
  { time: "14:00", patientId: "P-1039", type: "New" as const },
];

export type Prescription = {
  id: string;
  patientId: string;
  date: string;
  remedy: string;
  potency: string;
  status: "Sent" | "Generated" | "Draft";
};

export const prescriptions: Prescription[] = [
  { id: "RX-3018", patientId: "P-1042", date: "10 May", remedy: "Pulsatilla", potency: "200C", status: "Sent" },
  { id: "RX-3017", patientId: "P-1041", date: "10 May", remedy: "Nux Vomica", potency: "30C", status: "Generated" },
  { id: "RX-3016", patientId: "P-1040", date: "9 May", remedy: "Sulphur", potency: "200C", status: "Sent" },
  { id: "RX-3015", patientId: "P-1039", date: "8 May", remedy: "Lycopodium", potency: "1M", status: "Sent" },
  { id: "RX-3014", patientId: "P-1038", date: "7 May", remedy: "Apis Mellifica", potency: "30C", status: "Sent" },
];

export const invoices = [
  { id: "INV-9821", patientId: "P-1042", amount: 600, mode: "UPI", status: "Paid", date: "Today" },
  { id: "INV-9820", patientId: "P-1041", amount: 800, mode: "Cash", status: "Paid", date: "Today" },
  { id: "INV-9819", patientId: "P-1040", amount: 500, mode: "Card", status: "Pending", date: "Today" },
  { id: "INV-9818", patientId: "P-1039", amount: 1200, mode: "UPI", status: "Paid", date: "Yesterday" },
  { id: "INV-9817", patientId: "P-1038", amount: 600, mode: "Cash", status: "Paid", date: "Yesterday" },
];

export const reminders = [
  { id: "R1", patientId: "P-1042", time: "10:00", reason: "14-day follow-up", sentiment: "active" as const },
  { id: "R2", patientId: "P-1041", time: "11:00", reason: "Medicine refill", sentiment: "active" as const },
  { id: "R3", patientId: "P-1040", time: "14:00", reason: "Lab result review", sentiment: "unresponsive" as const },
  { id: "R4", patientId: "P-1039", time: "16:00", reason: "Monthly check-in", sentiment: "recovering" as const },
  { id: "R5", patientId: "P-1037", time: "17:30", reason: "Overdue follow-up (28d)", sentiment: "overdue" as const },
];

export const recentReplies = [
  { patientId: "P-1038", text: "Confirmed for tomorrow 10:30", time: "12m ago" },
  { patientId: "P-1037", text: "Need to reschedule", time: "1h ago" },
  { patientId: "P-1036", text: "Thanks doctor 🙏", time: "3h ago" },
];

export const visitTimeline = [
  { date: "10 May 2026", note: "Sleep noticeably improved. Anxiety down. Continue Pulsatilla 200C.", remedy: "Pulsatilla 200C", trend: "up" as const },
  { date: "26 Apr 2026", note: "Acidity reduced. Mood swings persist before menses.", remedy: "Pulsatilla 200C", trend: "up" as const },
  { date: "12 Apr 2026", note: "Started Pulsatilla. Reports tearful, worse in stuffy room.", remedy: "Pulsatilla 200C", trend: "flat" as const },
  { date: "29 Mar 2026", note: "Initial work-up. Constitution: Phosphoric. Miasm: Psoric.", remedy: "Sac Lac (placebo)", trend: "flat" as const },
];

export const revenue7d = [
  { day: "Mon", value: 12400 },
  { day: "Tue", value: 14100 },
  { day: "Wed", value: 13200 },
  { day: "Thu", value: 15800 },
  { day: "Fri", value: 17200 },
  { day: "Sat", value: 22100 },
  { day: "Sun", value: 27400 },
];

export const visits7d = [
  { day: "Mon", value: 18 },
  { day: "Tue", value: 22 },
  { day: "Wed", value: 16 },
  { day: "Thu", value: 28 },
  { day: "Fri", value: 30 },
  { day: "Sat", value: 36 },
  { day: "Sun", value: 12 },
];

export const revenue6m = [
  { m: "Dec", consult: 180000, medicine: 90000, procedures: 40000 },
  { m: "Jan", consult: 195000, medicine: 95000, procedures: 42000 },
  { m: "Feb", consult: 210000, medicine: 102000, procedures: 38000 },
  { m: "Mar", consult: 198000, medicine: 110000, procedures: 41000 },
  { m: "Apr", consult: 215000, medicine: 118000, procedures: 45000 },
  { m: "May", consult: 232000, medicine: 124000, procedures: 48000 },
];

export const staff = [
  { id: "S1", name: "Dr. R. Sharma", role: "Doctor (Owner)", email: "rs@vedichc.in", status: "Active" as const, initials: "RS" },
  { id: "S2", name: "Dr. Meera Joshi", role: "Doctor", email: "meera@vedichc.in", status: "Active" as const, initials: "MJ" },
  { id: "S3", name: "Sakshi Patel", role: "Receptionist", email: "sakshi@vedichc.in", status: "Active" as const, initials: "SP" },
  { id: "S4", name: "Vikram Rao", role: "Pharmacist", email: "vikram@vedichc.in", status: "Inactive" as const, initials: "VR" },
];

export function getPatient(id: string) {
  return patients.find((p) => p.id === id);
}

export function initials(name: string) {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

export const tagStyles: Record<PatientTag, string> = {
  chronic: "bg-[color-mix(in_oklab,var(--saffron)_18%,transparent)] text-[color-mix(in_oklab,var(--saffron)_70%,black)] border-[color-mix(in_oklab,var(--saffron)_30%,transparent)]",
  "follow-up": "bg-[color-mix(in_oklab,var(--gold)_25%,transparent)] text-[color-mix(in_oklab,var(--gold)_25%,black)] border-[color-mix(in_oklab,var(--gold)_40%,transparent)]",
  new: "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[color-mix(in_oklab,var(--success)_70%,black)] border-[color-mix(in_oklab,var(--success)_30%,transparent)]",
  vip: "bg-[color-mix(in_oklab,var(--saffron)_30%,transparent)] text-[color-mix(in_oklab,var(--saffron)_80%,black)] border-[color-mix(in_oklab,var(--saffron)_45%,transparent)]",
  diabetic: "bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)] text-[color-mix(in_oklab,var(--destructive)_70%,black)] border-[color-mix(in_oklab,var(--destructive)_25%,transparent)]",
  allergy: "bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)] text-[color-mix(in_oklab,var(--destructive)_70%,black)] border-[color-mix(in_oklab,var(--destructive)_25%,transparent)]",
  elderly: "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-[color-mix(in_oklab,var(--primary)_85%,black)] border-[color-mix(in_oklab,var(--primary)_22%,transparent)]",
  child: "bg-[color-mix(in_oklab,var(--chart-5)_18%,transparent)] text-[color-mix(in_oklab,var(--chart-5)_70%,black)] border-[color-mix(in_oklab,var(--chart-5)_30%,transparent)]",
  lapsed: "bg-[color-mix(in_oklab,var(--destructive)_10%,transparent)] text-[color-mix(in_oklab,var(--destructive)_60%,black)] border-[color-mix(in_oklab,var(--destructive)_20%,transparent)]",
  active: "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[color-mix(in_oklab,var(--success)_70%,black)] border-[color-mix(in_oklab,var(--success)_30%,transparent)]",
};

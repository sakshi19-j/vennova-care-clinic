import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, Tag, Avatar } from "@/components/clinic/PageHeader";
import { apptStatusStyles, formatTime } from "@/lib/reception-data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { RxAppointment, ClinicType } from "@/lib/reception-data";
import {
  Check, X, CalendarClock, LogIn, Search, Plus, UserPlus,
  Bell, ChevronLeft, ChevronRight, Calendar, List,
} from "lucide-react";
import { RegisterPatientModal } from "@/components/reception/RegisterPatientModal";

export const Route = createFileRoute("/reception/appointments")({
  component: AppointmentsPage,
});

type ViewMode = "day" | "all";

function AppointmentsPage() {
  const qc = useQueryClient();
  const appointmentsQ = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: () => api.get<any>("/appointments/"),
    refetchInterval: 15_000,
  });
  const appointments = useMemo(() => {
    const raw = appointmentsQ.data;
    const arr = Array.isArray(raw) ? raw : raw?.appointments ?? [];
    return arr.map((a: any) => ({
      id: a.id,
      patient_name: a.patient_name,
      patient_phone: a.patient_phone,
      scheduled_at: a.scheduled_at,
      visit_type: a.visit_type,
      status: a.status,
      chief_complaint: a.chief_complaint,
      duration_mins: a.duration_mins,
    }));
  }, [appointmentsQ.data]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [regOpen, setRegOpen] = useState(false);
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());

  // Book form state
  const [bQuery, setBQuery] = useState("");
  const [bPicked, setBPicked] = useState<{ id: string; full_name: string; reg_no: string; phone: string } | null>(null);
  const [bVisitType, setBVisitType] = useState<ClinicType>("HOMEOPATHY");
  const [bDuration, setBDuration] = useState(30);
  const [bDate, setBDate] = useState(new Date().toISOString().slice(0, 10));
  const [bTime, setBTime] = useState("10:00");
  const [bComplaint, setBComplaint] = useState("");
  const [bNotes, setBNotes] = useState("");

  const patientSearchQ = useQuery({
    queryKey: ["patients", "search", bQuery],
    queryFn: () => api.get<any>("/patients", { query: { search: bQuery } }),
    enabled: bQuery.trim().length > 1,
  });
  const bMatches = useMemo(() => {
    const raw = patientSearchQ.data;
    const arr = Array.isArray(raw) ? raw : raw?.patients ?? raw?.items ?? [];
    return arr.slice(0, 5).map((p: any) => ({
      id: p.id,
      full_name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      reg_no: p.reg_no ? `VNC-${String(p.reg_no).padStart(4, "0")}` : "",
      phone: p.phone_mobile || p.phone || "",
    }));
  }, [patientSearchQ.data]);

  const today = new Date().toISOString().slice(0, 10);

  // Navigate day
  const shiftDay = (d: number) => {
    const dt = new Date(selectedDate);
    dt.setDate(dt.getDate() + d);
    setSelectedDate(dt.toISOString().slice(0, 10));
  };

  const displayList = useMemo(() => {
    let list = [...appointments];
    if (viewMode === "day") {
      list = list.filter((a) => a.scheduled_at.slice(0, 10) === selectedDate);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((a) => a.status === statusFilter);
    } else {
      // Completed appointments are removed from the active list to keep it tidy.
      // They remain visible by selecting the "Completed" filter explicitly.
      list = list.filter((a) => a.status !== "COMPLETED");
    }
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter((a) =>
        a.patient_name.toLowerCase().includes(q) ||
        a.patient_phone.includes(q) ||
        (a.chief_complaint ?? "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [appointments, viewMode, selectedDate, statusFilter, searchQ]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of appointments) {
      if (a.scheduled_at.slice(0, 10) === today) {
        map[a.status] = (map[a.status] ?? 0) + 1;
      }
    }
    return map;
  }, [appointments, today]);

  const sendReminder = (appt: RxAppointment) => {
    setReminderSent((s) => new Set([...s, appt.id]));
    toast.success(`WhatsApp reminder sent to ${appt.patient_name}`);
  };

  const checkInAppt = async (appt: RxAppointment) => {
    try {
      await api.post(`/appointments/${encodeURIComponent(appt.id)}/checkin`);
      toast.success(`${appt.patient_name} added to queue`);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    } catch (e) {
      toast.error((e as Error).message || "Check-in failed");
    }
  };

  const updateStatus = async (id: string, status: any) => {
    try {
      await api.put(`/appointments/${encodeURIComponent(id)}`, { status });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    } catch (e) {
      toast.error((e as Error).message || "Update failed");
    }
  };

  const bookAppointment = async () => {
    if (!bPicked) return toast.error("Select a patient");
    const scheduled_at = new Date(`${bDate}T${bTime}`).toISOString();
    const isToday = bDate === today;
    try {
      await api.post("/appointments/", {
        patient_id: bPicked.id,
        scheduled_at,
        visit_type: bVisitType,
        chief_complaint: bComplaint || undefined,
        notes: bNotes || undefined,
        duration_mins: bDuration,
      });
      toast.success(
        isToday
          ? `Appointment booked for ${bPicked.full_name} today — they will appear in today's schedule`
          : `Appointment booked for ${bPicked.full_name} on ${new Date(scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      );
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setBPicked(null); setBQuery(""); setBComplaint(""); setBNotes("");
    } catch (e) {
      toast.error((e as Error).message || "Booking failed");
    }
  };

  const dateLabel = (d: string) => {
    if (d === today) return "Today";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* ── Left: Appointment list ── */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {/* Today stats strip */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Scheduled", key: "SCHEDULED", color: "bg-muted text-muted-foreground border-border" },
            { label: "Confirmed", key: "CONFIRMED", color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
            { label: "Completed", key: "COMPLETED", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
            { label: "Cancelled", key: "CANCELLED", color: "bg-destructive/10 text-destructive border-destructive/30" },
          ].map(({ label, key, color }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "ALL" : key)}
              className={[
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all",
                statusFilter === key ? color + " ring-1 ring-current/30" : "bg-card border-border text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              {label}
              <span className="tabular-nums font-mono">{counts[key] ?? 0}</span>
            </button>
          ))}
          <button
            onClick={() => setStatusFilter("ALL")}
            className={[
              "h-8 px-3 rounded-lg border text-xs font-medium ml-auto",
              statusFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-muted",
            ].join(" ")}
          >
            All
          </button>
        </div>

        <Card className="p-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b clinic-divider">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("day")}
                className={["h-8 px-3 text-xs font-medium inline-flex items-center gap-1.5", viewMode === "day" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"].join(" ")}
              >
                <Calendar className="size-3.5" /> Day view
              </button>
              <button
                onClick={() => setViewMode("all")}
                className={["h-8 px-3 text-xs font-medium inline-flex items-center gap-1.5 border-l border-border", viewMode === "all" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"].join(" ")}
              >
                <List className="size-3.5" /> All
              </button>
            </div>

            {/* Day nav */}
            {viewMode === "day" && (
              <div className="flex items-center gap-1">
                <button onClick={() => shiftDay(-1)} className="size-8 rounded-lg border border-border bg-card hover:bg-muted grid place-items-center">
                  <ChevronLeft className="size-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-card px-2 text-xs"
                />
                <button onClick={() => shiftDay(1)} className="size-8 rounded-lg border border-border bg-card hover:bg-muted grid place-items-center">
                  <ChevronRight className="size-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(today)}
                  className="h-8 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs text-muted-foreground"
                >
                  Today
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative ml-auto">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search patient…"
                className="h-8 w-48 pl-8 pr-3 rounded-lg border border-input bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <div className="text-xs text-muted-foreground shrink-0">
              {viewMode === "day" ? dateLabel(selectedDate) : "All appointments"} · {displayList.length}
            </div>
          </div>

          {/* List */}
          {displayList.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No appointments {viewMode === "day" ? `for ${dateLabel(selectedDate)}` : "found"}.
            </div>
          ) : (
            <ul className="divide-y clinic-divider">
              {displayList.map((a) => (
                <AppointmentRow
                  key={a.id}
                  appt={a}
                  showDate={viewMode === "all"}
                  reminderSent={reminderSent.has(a.id)}
                  onConfirm={() => { updateStatus(a.id, "CONFIRMED"); toast.success("Confirmed"); }}
                  onCheckIn={() => checkInAppt(a)}
                  onCancel={() => { updateStatus(a.id, "CANCELLED"); toast("Cancelled"); }}
                  onReschedule={() => toast("Reschedule — coming soon")}
                  onReminder={() => sendReminder(a)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Right: Book form ── */}
      <div className="col-span-12 lg:col-span-4">
        <Card className="sticky top-20">
          <div className="font-display text-2xl mb-1">Book appointment</div>
          <p className="text-sm text-muted-foreground mb-4">
            Same-day bookings go straight into today's queue when checked in.
          </p>

          {/* Patient search */}
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground">Patient</label>
          {bPicked ? (
            <div className="mt-1.5 flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
              <Avatar name={bPicked.full_name} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{bPicked.full_name}</div>
                <div className="text-xs text-muted-foreground">{bPicked.reg_no} · {bPicked.phone}</div>
              </div>
              <button onClick={() => setBPicked(null)} className="text-xs text-muted-foreground hover:text-foreground">change</button>
            </div>
          ) : (
            <div className="mt-1.5 relative">
              <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
              <input value={bQuery} onChange={(e) => setBQuery(e.target.value)} placeholder="Name or phone…"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
              {bMatches.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 clinic-card p-1 max-h-60 overflow-auto">
                  {bMatches.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => { setBPicked(p); setBQuery(""); }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center gap-3"
                      >
                        <Avatar name={p.full_name} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{p.full_name}</div>
                          <div className="text-[11px] text-muted-foreground">{p.phone} · {p.total_visits} visits</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setRegOpen(true)} className="mt-2 w-full h-10 rounded-lg border border-dashed border-border hover:bg-muted text-sm inline-flex items-center justify-center gap-2 text-muted-foreground">
                <UserPlus className="size-4" /> New patient
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground">Date</label>
              <input type="date" value={bDate} min={today} onChange={(e) => setBDate(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground">Time</label>
              <input type="time" value={bTime} onChange={(e) => setBTime(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
            </div>
          </div>

          {bDate === today && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 flex items-center gap-2">
              <CalendarClock className="size-3.5 shrink-0" />
              Same-day — use "Check in" on the appointment to add to today's queue.
            </div>
          )}

          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mt-4 block">Visit type</label>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            {(["HOMEOPATHY", "ALLOPATHY"] as const).map((v) => (
              <button key={v} onClick={() => setBVisitType(v)}
                className={`h-10 rounded-lg border text-xs font-medium ${bVisitType === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                {v}
              </button>
            ))}
          </div>

          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mt-4 block">Duration</label>
          <div className="grid grid-cols-4 gap-1.5 mt-1.5">
            {[15, 30, 45, 60].map((d) => (
              <button key={d} onClick={() => setBDuration(d)}
                className={`h-10 rounded-lg border text-xs font-medium ${bDuration === d ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                {d}m
              </button>
            ))}
          </div>

          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mt-4 block">Chief complaint</label>
          <input value={bComplaint} onChange={(e) => setBComplaint(e.target.value)}
            placeholder="e.g. Follow-up, fever, routine check…"
            className="mt-1.5 w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />

          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mt-4 block">Notes</label>
          <textarea value={bNotes} onChange={(e) => setBNotes(e.target.value)} rows={2}
            className="mt-1.5 w-full rounded-lg border border-input bg-card p-3 text-sm resize-none" />

          <button onClick={bookAppointment}
            className="mt-5 w-full h-11 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 inline-flex items-center justify-center gap-2">
            <Plus className="size-4" /> Book appointment
          </button>
        </Card>
      </div>

      <RegisterPatientModal
        open={regOpen}
        onOpenChange={setRegOpen}
        onRegistered={(p) => setBPicked(p)}
      />
    </div>
  );
}

function AppointmentRow({
  appt, showDate, reminderSent, onConfirm, onCheckIn, onCancel, onReschedule, onReminder,
}: {
  appt: RxAppointment;
  showDate: boolean;
  reminderSent: boolean;
  onConfirm: () => void;
  onCheckIn: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onReminder: () => void;
}) {
  const isActive = appt.status === "SCHEDULED" || appt.status === "CONFIRMED";
  return (
    <li className={["px-5 py-3 flex items-center gap-3", !isActive ? "opacity-60" : ""].join(" ")}>
      <div className="w-20 text-center shrink-0">
        {showDate && (
          <div className="text-[10px] text-muted-foreground">
            {new Date(appt.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </div>
        )}
        <div className="font-mono text-sm">{formatTime(appt.scheduled_at)}</div>
        <div className="text-[10px] text-muted-foreground">{appt.duration_mins}m</div>
      </div>
      <Avatar name={appt.patient_name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{appt.patient_name}</span>
          <Tag className="bg-card border-border text-foreground/70">{appt.visit_type}</Tag>
          <Tag className={apptStatusStyles[appt.status]}>{appt.status}</Tag>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {appt.patient_phone}
          {appt.chief_complaint && <> · {appt.chief_complaint}</>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
        {isActive && (
          <button
            onClick={onReminder}
            disabled={reminderSent}
            title="Send WhatsApp reminder"
            className={[
              "h-8 px-2.5 text-xs rounded-lg border inline-flex items-center gap-1 transition-colors",
              reminderSent
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 cursor-default"
                : "border-border hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-700",
            ].join(" ")}
          >
            <Bell className="size-3.5" />
            {reminderSent ? "Sent" : "Remind"}
          </button>
        )}
        {appt.status === "SCHEDULED" && (
          <button onClick={onConfirm}
            className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-blue-700 inline-flex items-center gap-1">
            <Check className="size-3.5" /> Confirm
          </button>
        )}
        {isActive && (
          <button onClick={onCheckIn}
            className="h-8 px-3 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1">
            <LogIn className="size-3.5" /> Check in
          </button>
        )}
        {isActive && (
          <>
            <button onClick={onReschedule} className="size-8 grid place-items-center rounded-lg border border-border hover:bg-muted" title="Reschedule">
              <CalendarClock className="size-3.5" />
            </button>
            <button onClick={onCancel} className="size-8 grid place-items-center rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive" title="Cancel">
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock, Check, Copy, LogIn, Plus, RefreshCw, Search, X, Link2, Loader2,
} from "lucide-react";
import { Card, PageHeader, Avatar, Tag } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import { RegisterPatientModal } from "@/components/reception/RegisterPatientModal";
import { AppointmentCalendar, type CalendarMode } from "@/components/clinic/AppointmentCalendar";
import { BookAppointmentPanel } from "@/components/clinic/BookAppointmentPanel";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import {
  apptDate, apptStartTime, fetchAppointments, formatSlotLabel, isWorkingDay,
  loadAppointmentSettings, loadPendingRequests, localIsoDate, markSlotConfirmed,
  releaseSlot, uiStatus, uiStatusLabel, uiStatusStyles,
  type BackendAppointment, type SlotRow,
} from "@/lib/appointments";

export const Route = createFileRoute("/reception/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — Vennova Clinic" },
      { name: "description", content: "Calendar, slot-based booking and check-in for the clinic's daily appointments." },
      { property: "og:title", content: "Appointments — Vennova Clinic" },
      { property: "og:description", content: "Calendar, slot-based booking and check-in for the clinic's daily appointments." },
      { name: "twitter:title", content: "Appointments — Vennova Clinic" },
      { name: "twitter:description", content: "Calendar, slot-based booking and check-in for the clinic's daily appointments." },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? null;

  const [mode, setMode] = useState<CalendarMode>("month");
  const [selectedDate, setSelectedDate] = useState(localIsoDate());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(false);
  const [regOpen, setRegOpen] = useState(false);

  const settingsQ = useQuery({
    queryKey: ["appointment-settings", clinicId],
    queryFn: () => loadAppointmentSettings(clinicId),
    staleTime: 60_000,
  });
  const settings = settingsQ.data;

  const apptQ = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: fetchAppointments,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const appointments = apptQ.data ?? [];

  const requestsQ = useQuery({
    queryKey: ["appointment-requests", clinicId],
    queryFn: () => loadPendingRequests(clinicId),
    enabled: !!clinicId,
    refetchInterval: 60_000,
  });
  const requests = requestsQ.data ?? [];

  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of appointments) {
      if (a.status === "CANCELLED") continue;
      const d = apptDate(a);
      map[d] = (map[d] ?? 0) + 1;
    }
    return map;
  }, [appointments]);

  const dayList = useMemo(() => {
    let list = appointments.filter((a) => apptDate(a) === selectedDate);
    if (statusFilter !== "ALL") list = list.filter((a) => uiStatus(a.status) === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.patient_name.toLowerCase().includes(q) ||
          a.patient_phone.includes(q) ||
          (a.chief_complaint ?? "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [appointments, selectedDate, statusFilter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { CONFIRMED: 0, WAITING: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const a of appointments) {
      if (apptDate(a) !== selectedDate) continue;
      map[uiStatus(a.status)] = (map[uiStatus(a.status)] ?? 0) + 1;
    }
    return map;
  }, [appointments, selectedDate]);

  const refreshAll = () => {
    void apptQ.refetch();
    void requestsQ.refetch();
    qc.invalidateQueries({ queryKey: ["appointment-slots"] });
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/appointments/${encodeURIComponent(id)}`, { status });
      toast.success("Appointment updated");
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message || "Update failed");
    }
  };

  const checkIn = async (a: BackendAppointment) => {
    try {
      await api.post(`/appointments/${encodeURIComponent(a.id)}/checkin`);
      toast.success(`${a.patient_name} checked in and added to the queue`);
    } catch {
      try {
        await api.post("/queue/add", {
          patient_id: a.patient_id,
          visit_type: a.visit_type || "HOMEOPATHY",
          priority: 0,
          notes: a.chief_complaint || null,
        });
        await api.put(`/appointments/${encodeURIComponent(a.id)}`, { status: "CHECKED_IN" });
        toast.success(`${a.patient_name} added to the queue`);
      } catch (e2) {
        return toast.error("Could not check in: " + ((e2 as Error).message || "server error"));
      }
    }
    refreshAll();
    qc.invalidateQueries({ queryKey: ["queue"] });
  };

  const bookingLink = clinicId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/book/${clinicId}`
    : "";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Front office"
        title="Appointments"
        subtitle="Calendar, slot-based booking and check-in — live from your clinic backend."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-9 rounded-full" onClick={refreshAll}>
              <RefreshCw className={["size-4", apptQ.isFetching ? "animate-spin" : ""].join(" ")} />
              <span className="ml-1 hidden sm:inline">Refresh</span>
            </Button>
            <Button className="h-9 rounded-full" onClick={() => setBooking((v) => !v)}>
              <Plus className="mr-1 size-4" /> New appointment
            </Button>
          </div>
        }
      />

      {bookingLink && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
          <Link2 className="size-4 text-primary" />
          <span className="text-muted-foreground">Public booking link</span>
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{bookingLink}</code>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(bookingLink);
              toast.success("Booking link copied");
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
          >
            <Copy className="size-3.5" /> Copy
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Calendar + booking */}
        <div className="col-span-12 space-y-4 lg:col-span-4">
          <AppointmentCalendar
            mode={mode}
            onModeChange={setMode}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            countsByDate={countsByDate}
            closedDates={(iso) => (settings ? !isWorkingDay(settings, iso) : false)}
          />

          {booking && settings && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base">New appointment</h2>
                <button onClick={() => setBooking(false)} aria-label="Close">
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>
              <BookAppointmentPanel
                clinicId={clinicId}
                settings={settings}
                appointments={appointments}
                onBooked={refreshAll}
                onRegisterPatient={() => setRegOpen(true)}
              />
            </Card>
          )}

          {requests.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 font-display text-base">
                Booking requests <span className="text-primary">({requests.length})</span>
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Booked by patients through your public link. Confirm to add them to the schedule.
              </p>
              <div className="space-y-2">
                {requests.map((r) => (
                  <RequestRow key={r.id} row={r} onDone={refreshAll} />
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Timeline */}
        <div className="col-span-12 space-y-3 lg:col-span-8">
          <div className="flex flex-wrap gap-2">
            {(["CONFIRMED", "WAITING", "COMPLETED", "CANCELLED"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter(statusFilter === k ? "ALL" : k)}
                className={[
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all",
                  statusFilter === k
                    ? uiStatusStyles[k] + " ring-1 ring-current/30"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                {uiStatusLabel[k]} <span className="font-mono tabular-nums">{counts[k] ?? 0}</span>
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient…"
                className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b clinic-divider px-4 py-3 sm:px-5">
              <h2 className="font-display text-base sm:text-lg">
                {selectedDate === localIsoDate()
                  ? "Today's appointments"
                  : new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
              </h2>
              <span className="text-xs text-muted-foreground">{dayList.length} scheduled</span>
            </div>

            {apptQ.isLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
                ))}
              </div>
            ) : dayList.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-muted">
                  <CalendarClock className="size-5" />
                </div>
                No appointments on this date.
              </div>
            ) : (
              <ul className="divide-y clinic-divider">
                {dayList.map((a) => (
                  <TimelineRow
                    key={a.id}
                    a={a}
                    onCheckIn={() => checkIn(a)}
                    onConfirm={() => updateStatus(a.id, "CONFIRMED")}
                    onCancel={() => updateStatus(a.id, "CANCELLED")}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <RegisterPatientModal open={regOpen} onClose={() => setRegOpen(false)} />
    </div>
  );
}

function TimelineRow({
  a, onCheckIn, onConfirm, onCancel,
}: {
  a: BackendAppointment;
  onCheckIn: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const st = uiStatus(a.status);
  const closed = st === "COMPLETED" || st === "CANCELLED";
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <div className="w-20 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        {formatSlotLabel(apptStartTime(a))}
      </div>
      <Avatar name={a.patient_name} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{a.patient_name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {a.chief_complaint || (a.visit_type === "ALLOPATHY" ? "Allopathy consultation" : "Homeopathy consultation")}
          {a.patient_phone && ` · ${a.patient_phone}`}
        </div>
      </div>
      <Tag className={uiStatusStyles[st]}>{uiStatusLabel[st]}</Tag>
      {!closed && (
        <div className="flex items-center gap-1.5">
          {st !== "CONFIRMED" && (
            <button
              onClick={onConfirm}
              title="Confirm"
              className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            >
              <Check className="size-4" />
            </button>
          )}
          <button
            onClick={onCheckIn}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <LogIn className="size-3.5" /> Check in
          </button>
          <button
            onClick={onCancel}
            title="Cancel"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </li>
  );
}

function RequestRow({ row, onDone }: { row: SlotRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      // Find or create the patient, then create the real appointment.
      const found = await api
        .get<any>("/patients", { query: { search: row.patient_phone || row.patient_name } })
        .catch(() => null);
      const arr = Array.isArray(found) ? found : found?.patients ?? found?.items ?? [];
      const match = arr.find(
        (p: any) => (p.phone_mobile || p.phone || "") === row.patient_phone,
      );
      let patientId = match?.id;
      if (!patientId) {
        const created = await api.post<any>("/patients", {
          full_name: row.patient_name,
          phone_mobile: row.patient_phone,
        });
        patientId = created?.id ?? created?.patient_id;
      }
      if (!patientId) throw new Error("Could not create the patient record");

      await api.post("/appointments/", {
        patient_id: String(patientId),
        scheduled_at: new Date(`${row.slot_date}T${row.start_time}:00`).toISOString(),
        visit_type: row.visit_type || "HOMEOPATHY",
        chief_complaint: row.chief_complaint || undefined,
      });
      await markSlotConfirmed(row.id!, null);
      toast.success(`${row.patient_name} confirmed`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message || "Could not confirm this request");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    await releaseSlot(row.id);
    toast.success("Request declined — the slot is free again");
    onDone();
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="text-sm font-medium">{row.patient_name}</div>
      <div className="text-xs text-muted-foreground">
        {row.patient_phone} ·{" "}
        {new Date(`${row.slot_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
        {formatSlotLabel(row.start_time)}
      </div>
      {row.chief_complaint && (
        <div className="mt-1 truncate text-xs text-muted-foreground">{row.chief_complaint}</div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          disabled={busy}
          onClick={confirm}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Confirm
        </button>
        <button
          disabled={busy}
          onClick={decline}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

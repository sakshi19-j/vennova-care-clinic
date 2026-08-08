import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import {
  formatSlotLabel,
  generateSlots,
  isPastSlot,
  isWorkingDay,
  localIsoDate,
  reserveSlot,
  SlotTakenError,
  takenTimes,
  loadSlotRows,
  type AppointmentSettings,
  type BackendAppointment,
} from "@/lib/appointments";

export type PatientLite = { id: string; full_name: string; reg_no: string; phone: string };

/** Grid of generated slots with clear availability indicators. */
export function SlotGrid({
  settings,
  isoDate,
  taken,
  value,
  onChange,
  compact,
}: {
  settings: AppointmentSettings;
  isoDate: string;
  taken: Set<string>;
  value: string | null;
  onChange: (start: string, end: string) => void;
  compact?: boolean;
}) {
  const slots = useMemo(() => generateSlots(settings, isoDate), [settings, isoDate]);

  if (!isWorkingDay(settings, isoDate)) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        The clinic is closed on this date.
      </div>
    );
  }
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No slots configured for this day.
      </div>
    );
  }

  return (
    <div className={["grid gap-2", compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"].join(" ")}>
      {slots.map((s) => {
        const unavailable = taken.has(s.start) || isPastSlot(isoDate, s.start);
        const selected = value === s.start;
        return (
          <button
            key={s.start}
            type="button"
            disabled={unavailable}
            onClick={() => onChange(s.start, s.end)}
            className={[
              "rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : unavailable
                  ? "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/50 line-through"
                  : "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5",
            ].join(" ")}
          >
            <div className="tabular-nums">{formatSlotLabel(s.start)}</div>
            <div className={["mt-0.5 text-[10px]", selected ? "opacity-80" : "text-muted-foreground"].join(" ")}>
              {unavailable ? "Unavailable" : "Available"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Receptionist booking flow: search patient → date → slot → confirm. */
export function BookAppointmentPanel({
  clinicId,
  settings,
  appointments,
  onBooked,
  onRegisterPatient,
}: {
  clinicId: string | null;
  settings: AppointmentSettings;
  appointments: BackendAppointment[];
  onBooked: () => void;
  onRegisterPatient: () => void;
}) {
  const [query, setQuery] = useState("");
  const [patient, setPatient] = useState<PatientLite | null>(null);
  const [visitType, setVisitType] = useState("HOMEOPATHY");
  const [date, setDate] = useState(localIsoDate());
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const searchQ = useQuery({
    queryKey: ["patients", "search", query],
    queryFn: () => api.get<unknown>("/patients", { query: { search: query } }),
    enabled: query.trim().length > 1,
    staleTime: 15_000,
  });

  const matches: PatientLite[] = useMemo(() => {
    const raw = searchQ.data as any;
    const arr = Array.isArray(raw) ? raw : raw?.patients ?? raw?.items ?? [];
    return arr.slice(0, 6).map((p: any) => ({
      id: String(p.id),
      full_name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      reg_no: p.reg_no ? `VNC-${String(p.reg_no).padStart(4, "0")}` : "",
      phone: p.phone_mobile || p.phone || "",
    }));
  }, [searchQ.data]);

  const slotsQ = useQuery({
    queryKey: ["appointment-slots", clinicId, date],
    queryFn: () => loadSlotRows(clinicId, date),
    enabled: !!clinicId,
    staleTime: 5_000,
  });

  const taken = useMemo(
    () => takenTimes(appointments, slotsQ.data ?? [], date),
    [appointments, slotsQ.data, date],
  );

  const confirm = async () => {
    if (!patient) return toast.error("Select a patient first");
    if (!slot) return toast.error("Select an available slot");
    if (taken.has(slot.start)) {
      setSlot(null);
      return toast.error("Sorry, this slot is no longer available. Please select another slot.");
    }
    setSaving(true);
    let reservationId: string | null = null;
    try {
      if (clinicId) {
        const row = await reserveSlot({
          clinic_id: clinicId,
          slot_date: date,
          start_time: slot.start,
          end_time: slot.end,
          patient_id: patient.id,
          patient_name: patient.full_name,
          patient_phone: patient.phone,
          visit_type: visitType,
          chief_complaint: reason || null,
          status: "CONFIRMED",
          booking_source: "receptionist",
        });
        reservationId = row?.id ?? null;
      }

      const scheduled_at = new Date(`${date}T${slot.start}:00`).toISOString();
      await api.post("/appointments/", {
        patient_id: patient.id,
        scheduled_at,
        visit_type: visitType,
        chief_complaint: reason || undefined,
        duration_mins: settings.slot_minutes,
      });

      toast.success(
        `Booked ${patient.full_name} · ${formatSlotLabel(slot.start)} on ${new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      );
      setPatient(null);
      setQuery("");
      setReason("");
      setSlot(null);
      onBooked();
      void slotsQ.refetch();
    } catch (e) {
      if (e instanceof SlotTakenError) {
        toast.error(e.message);
        setSlot(null);
        void slotsQ.refetch();
      } else {
        // Booking failed after the slot was held — release the hold.
        if (reservationId) {
          const { releaseSlot } = await import("@/lib/appointments");
          await releaseSlot(reservationId);
        }
        toast.error((e as Error).message || "Booking failed");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Step 1 — patient */}
      <div>
        <Label step={1}>Patient</Label>
        {patient ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <Avatar name={patient.full_name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{patient.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {patient.reg_no} {patient.phone && `· ${patient.phone}`}
              </div>
            </div>
            <button
              onClick={() => setPatient(null)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or phone…"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
              {searchQ.isFetching && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {query.trim().length > 1 && (
              <div className="mt-2 space-y-1">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPatient(m)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card p-2 text-left hover:border-primary"
                  >
                    <Avatar name={m.full_name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{m.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.reg_no} {m.phone && `· ${m.phone}`}
                      </div>
                    </div>
                  </button>
                ))}
                {!searchQ.isFetching && matches.length === 0 && (
                  <button
                    onClick={onRegisterPatient}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    <UserPlus className="size-4" /> No match — register a new patient
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Step 2 — stream + date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label step={2}>Consultation</Label>
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="HOMEOPATHY">Homeopathy</option>
            <option value="ALLOPATHY">Allopathy</option>
          </select>
        </div>
        <div>
          <Label step={3}>Date</Label>
          <input
            type="date"
            value={date}
            min={localIsoDate()}
            onChange={(e) => {
              setDate(e.target.value);
              setSlot(null);
            }}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Step 3 — slots */}
      <div>
        <Label step={4}>Available slots</Label>
        <SlotGrid
          settings={settings}
          isoDate={date}
          taken={taken}
          value={slot?.start ?? null}
          onChange={(start, end) => setSlot({ start, end })}
          compact
        />
      </div>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason / chief complaint (optional)"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />

      <Button
        onClick={confirm}
        disabled={saving || !patient || !slot}
        className="h-11 w-full rounded-xl"
      >
        {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Check className="mr-1 size-4" />}
        {slot ? `Confirm ${formatSlotLabel(slot.start)}` : "Confirm appointment"}
      </Button>
    </div>
  );
}

function Label({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="grid size-4 place-items-center rounded-full bg-muted text-[9px] font-semibold text-foreground">
        {step}
      </span>
      {children}
    </div>
  );
}

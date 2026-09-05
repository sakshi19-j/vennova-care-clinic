import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import {
  formatSlotLabel, generateSlots, isPastSlot, isWorkingDay, localIsoDate,
  publicBooking, SlotTakenError,
} from "@/lib/appointments";

export const Route = createFileRoute("/book/$clinicId")({
  head: () => ({
    meta: [
      { title: "Book an appointment — Vennova" },
      { name: "description", content: "Pick an available time slot and book your clinic appointment in seconds. No account needed." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Book an appointment — Vennova" },
      { property: "og:description", content: "Pick an available time slot and book your clinic appointment in seconds. No account needed." },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Book an appointment — Vennova" },
      { name: "twitter:description", content: "Pick an available time slot and book your clinic appointment in seconds. No account needed." },
    ],
  }),
  component: PublicBooking,
});

function PublicBooking() {
  const { clinicId } = Route.useParams();
  const [date, setDate] = useState(localIsoDate());
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    id: string | null;
    date: string;
    start: string;
    end: string;
    name: string;
    phone: string;
    reason: string;
  } | null>(null);

  const infoQ = useQuery({
    queryKey: ["public-booking-info", clinicId],
    queryFn: () => publicBooking.info(clinicId),
    retry: 0,
  });

  const bookedQ = useQuery({
    queryKey: ["public-booked", clinicId, date],
    queryFn: () => publicBooking.bookedTimes(clinicId, date),
    enabled: !!infoQ.data && !done,
    staleTime: 0,
    // Keep availability honest: re-check regularly and whenever the visitor
    // comes back to the tab, so busy times are never stale.
    refetchInterval: done ? false : 20_000,
    refetchOnWindowFocus: true,
  });

  const settings = infoQ.data?.settings;
  const taken = useMemo(() => new Set(bookedQ.data ?? []), [bookedQ.data]);
  const slots = useMemo(
    () => (settings ? generateSlots(settings, date) : []),
    [settings, date],
  );

  const submit = async () => {
    if (!slot) return setError("Please choose a time slot.");
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (phone.replace(/\D/g, "").length < 10) return setError("Please enter a valid phone number.");
    setError(null);
    setSaving(true);
    try {
      const res = await publicBooking.book({
        clinicId, isoDate: date, start: slot.start, end: slot.end,
        name: name.trim(), phone: phone.trim(), reason: reason.trim() || undefined,
      });
      setDone({
        id: res?.id ?? null,
        date, start: slot.start, end: slot.end,
        name: name.trim(), phone: phone.trim(), reason: reason.trim(),
      });
    } catch (e) {
      if (e instanceof SlotTakenError) {
        setError("Sorry, this slot is no longer available. Please select another slot.");
        setSlot(null);
      } else {
        setError((e as Error).message || "Something went wrong. Please try again.");
      }
      // Always refresh availability after a failure so busy times aren't stale.
      void bookedQ.refetch();
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const clinicName = infoQ.data?.clinic_name ?? "the clinic";
    const rows: Array<[string, string]> = [
      ["Clinic", clinicName],
      ["Date", new Date(`${done.date}T00:00:00`).toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })],
      ["Time", `${formatSlotLabel(done.start)} – ${formatSlotLabel(done.end)}`],
      ["Name", done.name],
      ["Phone", done.phone],
    ];
    if (done.reason) rows.push(["Reason", done.reason]);
    if (done.id) rows.push(["Reference", done.id.slice(0, 8).toUpperCase()]);
    return (
      <Shell clinic={infoQ.data?.clinic_name}>
        <div className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h1 className="mt-4 font-display text-2xl">Appointment requested</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your request has been sent to {clinicName}.
          </p>
          <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl border border-border bg-muted/30 p-4 text-left text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="break-words text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            The clinic will confirm your booking shortly on {done.phone}.
          </p>
          <button
            onClick={() => { setDone(null); setSlot(null); setName(""); setPhone(""); setReason(""); setError(null); }}
            className="mt-6 text-sm font-medium text-primary hover:underline"
          >
            Book another appointment
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell clinic={infoQ.data?.clinic_name}>
      {infoQ.isLoading ? (
        <div className="grid place-items-center p-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : infoQ.isError || !settings ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          This booking link isn't available. Please contact the clinic.
        </div>
      ) : (
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="mb-1.5 text-sm font-medium">1 · Choose a date</h2>
            <input
              type="date"
              value={date}
              min={localIsoDate()}
              onChange={(e) => { setDate(e.target.value); setSlot(null); setError(null); }}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <h2 className="mb-1.5 text-sm font-medium">2 · Pick an available slot</h2>
            {!isWorkingDay(settings, date) ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                The clinic is closed on this date.
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No slots available on this date.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => {
                  const unavailable = taken.has(s.start) || isPastSlot(date, s.start);
                  const selected = slot?.start === s.start;
                  return (
                    <button
                      key={s.start}
                      disabled={unavailable}
                      onClick={() => { setSlot({ start: s.start, end: s.end }); setError(null); }}
                      className={[
                        "rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : unavailable
                            ? "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/50 line-through"
                            : "border-border bg-card hover:border-primary hover:bg-primary/5",
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
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium">3 · Your details</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={phone}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for visit (optional)"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
            {slot ? `Book ${formatSlotLabel(slot.start)}` : "Book appointment"}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ clinic, children }: { clinic?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className="border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Book an appointment</p>
          <h1 className="font-display text-xl text-foreground">{clinic ?? "Clinic"}</h1>
        </header>
        {children}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Powered by Vennova Clinic OS</p>
    </main>
  );
}

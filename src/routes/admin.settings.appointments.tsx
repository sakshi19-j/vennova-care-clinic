import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCog, Loader2, Save, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_APPOINTMENT_SETTINGS, WEEKDAY_LABELS, formatSlotLabel, generateSlots,
  loadAppointmentSettings, localIsoDate, saveAppointmentSettings,
  type AppointmentSettings,
} from "@/lib/appointments";

export const Route = createFileRoute("/admin/settings/appointments")({
  head: () => ({
    meta: [
      { title: "Appointment settings — Vennova Clinic" },
      { name: "description", content: "Configure working days, clinic hours, slot duration, breaks and holidays for appointment booking." },
      { property: "og:title", content: "Appointment settings — Vennova Clinic" },
      { property: "og:description", content: "Configure working days, clinic hours, slot duration, breaks and holidays for appointment booking." },
      { name: "twitter:title", content: "Appointment settings — Vennova Clinic" },
      { name: "twitter:description", content: "Configure working days, clinic hours, slot duration, breaks and holidays for appointment booking." },
    ],
  }),
  component: AppointmentSettingsPage,
});

function AppointmentSettingsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [form, setForm] = useState<AppointmentSettings>(DEFAULT_APPOINTMENT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [holiday, setHoliday] = useState("");

  const q = useQuery({
    queryKey: ["appointment-settings", clinicId],
    queryFn: () => loadAppointmentSettings(clinicId),
  });

  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  const set = <K extends keyof AppointmentSettings>(k: K, v: AppointmentSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const preview = useMemo(() => {
    // Preview against the next working day so the grid is never empty.
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      if (form.working_days.includes(d.getDay())) {
        return generateSlots(form, localIsoDate(d));
      }
    }
    return [];
  }, [form]);

  const save = async () => {
    if (!clinicId) return toast.error("No clinic linked to your account");
    if (form.working_days.length === 0) return toast.error("Pick at least one working day");
    if (form.slot_minutes < 5 || form.slot_minutes > 180)
      return toast.error("Slot duration must be between 5 and 180 minutes");
    if (form.open_time >= form.close_time) return toast.error("Closing time must be after opening time");
    if (form.break_start && form.break_end && form.break_start >= form.break_end)
      return toast.error("Break end must be after break start");
    setSaving(true);
    try {
      await saveAppointmentSettings(clinicId, form);
      toast.success("Appointment settings saved");
      void q.refetch();
    } catch (e) {
      toast.error((e as Error).message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-7">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarCog className="size-5 text-primary" />
            <h2 className="font-display text-lg">Appointment schedule</h2>
          </div>

          {q.isLoading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <Label>Working days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((d, i) => {
                    const on = form.working_days.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          set(
                            "working_days",
                            on ? form.working_days.filter((x) => x !== i) : [...form.working_days, i].sort(),
                          )
                        }
                        className={[
                          "h-9 w-14 rounded-lg border text-xs font-medium transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted",
                        ].join(" ")}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Opens at">
                  <input type="time" value={form.open_time} onChange={(e) => set("open_time", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Closes at">
                  <input type="time" value={form.close_time} onChange={(e) => set("close_time", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Slot duration (min)">
                  <input
                    type="number" min={5} max={180} step={5}
                    value={form.slot_minutes}
                    onChange={(e) => set("slot_minutes", Number(e.target.value) || 20)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Break starts">
                  <input type="time" value={form.break_start ?? ""} onChange={(e) => set("break_start", e.target.value || null)} className={inputCls} />
                </Field>
                <Field label="Break ends">
                  <input type="time" value={form.break_end ?? ""} onChange={(e) => set("break_end", e.target.value || null)} className={inputCls} />
                </Field>
              </div>

              <div>
                <Label>Holidays</Label>
                <div className="flex gap-2">
                  <input type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} className={inputCls} />
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={() => {
                      if (!holiday) return;
                      if (!form.holidays.includes(holiday)) set("holidays", [...form.holidays, holiday].sort());
                      setHoliday("");
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                {form.holidays.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.holidays.map((h) => (
                      <span key={h} className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-xs">
                        {new Date(`${h}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        <button onClick={() => set("holidays", form.holidays.filter((x) => x !== h))} aria-label="Remove holiday">
                          <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={save} disabled={saving} className="h-11 rounded-xl">
                {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                Save settings
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-5">
        <Card className="p-5">
          <h2 className="font-display text-lg">Slot preview</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {preview.length} slots per working day. These are the times patients and reception can book.
          </p>
          {preview.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No slots with the current schedule.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {preview.map((s) => (
                <div key={s.start} className="rounded-lg border border-border bg-muted/40 py-1.5 text-center text-xs tabular-nums">
                  {formatSlotLabel(s.start)}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

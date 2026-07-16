import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, ArrowLeft, Send, AlertTriangle, Zap, FileText,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { loadQueue, queueActions } from "@/lib/queue-store";

type PrescriptionSearch = {
  patient_id?: string;
  queue_id?: string;
};

export const Route = createFileRoute("/prescription/$visitId")({
  validateSearch: (s: Record<string, unknown>): PrescriptionSearch => ({
    patient_id: typeof s.patient_id === "string" ? s.patient_id : undefined,
    queue_id: typeof s.queue_id === "string" ? s.queue_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Prescription — Vennova Clinic" }],
  }),
  component: PrescriptionPage,
});

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.data as { detail?: unknown; message?: unknown } | null;
    const raw = d?.detail;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) {
      const m = raw.map((x: { msg?: string }) => x?.msg || "").filter(Boolean).join(", ");
      if (m) return m;
    }
    if (typeof d?.message === "string") return d.message;
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

type Visit = {
  id?: string;
  visit_id?: string;
  patient_id?: string;
  chief_complaint?: string;
  patient?: { id?: string; full_name?: string; phone?: string; phone_mobile?: string };
  homeopathy?: { remedy?: string; potency?: string; repetition?: string };
  [k: string]: unknown;
};

type BoxItem = {
  box: string;
  remedy: string;
  potency: string;
  timing: string;
  food: "Before food" | "After food" | "With food" | "";
  days: string;
};

const POTENCIES = ["6C", "30C", "200C", "1M", "10M", "CM"];
const TIMINGS = ["OD", "BD", "TDS", "QID", "HS", "SOS"];

function PrescriptionPage() {
  const { visitId } = Route.useParams();
  const search = useSearch({ from: "/prescription/$visitId" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const visitQ = useQuery({
    queryKey: ["visit", visitId],
    queryFn: () => api.get<Visit>(`/visits/${encodeURIComponent(visitId)}`),
    retry: 1,
  });

  const visit = visitQ.data;
  const patientId = search.patient_id || visit?.patient_id || visit?.patient?.id || "";

  const [boxes, setBoxes] = useState<BoxItem[]>([
    { box: "1", remedy: "", potency: "30C", timing: "BD", food: "After food", days: "7" },
  ]);
  const [advice, setAdvice] = useState("");
  const [sending, setSending] = useState(false);

  // FOLLOW-UP PLAN — saved alongside prescription; triggers backend POST /followups
  const FOLLOWUP_PRESETS = [
    { id: "3d", label: "3 days", days: 3, backendType: "THREE_DAY" },
    { id: "7d", label: "7 days", days: 7, backendType: "SEVEN_DAY" },
    { id: "15d", label: "15 days", days: 15, backendType: "FIFTEEN_DAY" },
    { id: "1m", label: "Monthly", days: 30, backendType: "THIRTY_DAY" },
    { id: "custom", label: "Custom", days: 0, backendType: "CUSTOM" },
    { id: "none", label: "No follow-up", days: 0, backendType: "NONE" },
  ] as const;
  const [followupChoice, setFollowupChoice] = useState<string>("7d");
  const [followupCustomDate, setFollowupCustomDate] = useState<string>("");

  function computeFollowupDate(): string | null {
    if (followupChoice === "none") return null;
    if (followupChoice === "custom") return followupCustomDate || null;
    const preset = FOLLOWUP_PRESETS.find((p) => p.id === followupChoice);
    if (!preset || preset.days === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + preset.days);
    return d.toISOString().slice(0, 10);
  }

  const addBox = () =>
    setBoxes((b) => [...b, { box: String(b.length + 1), remedy: "", potency: "30C", timing: "BD", food: "After food", days: "7" }]);
  const removeBox = (i: number) => setBoxes((b) => b.filter((_, idx) => idx !== i));
  const setBox = (i: number, field: keyof BoxItem, v: string) =>
    setBoxes((b) => b.map((x, idx) => (idx === i ? { ...x, [field]: v } : x)));

  const sendPrescription = async () => {
    const valid = boxes.filter((b) => b.remedy.trim() && b.box.trim());
    if (valid.length === 0) {
      toast.error("Add at least one BOX with a remedy");
      return;
    }
    if (sending) return;
    setSending(true);
    const tid = toast.loading("Saving prescription…");
    try {
      // Persist remedy on the case (doctor-only fields). This MUST succeed.
      const primary = valid[0];
      const patientRx = valid
        .map(
          (b) =>
            `BOX ${b.box}: ${b.timing}${b.food ? `, ${b.food}` : ""} × ${b.days} day${
              Number(b.days) === 1 ? "" : "s"
            }`,
        )
        .join("\n");
      await api.post(`/visits/${encodeURIComponent(visitId)}/homeopathy`, {
        remedy: primary.remedy,
        potency: primary.potency,
        repetition: `${primary.timing} × ${primary.days} days`,
        patient_rx: patientRx + (advice ? `\n\nAdvice: ${advice}` : ""),
      });

      try {
        await api.post(`/visits/${encodeURIComponent(visitId)}/medicines`, {
          medicines: valid.map((b) => ({
            name: b.remedy,
            potency: b.potency,
            timing: b.timing,
            days: b.days,
            food_relation: b.food || "",
          })),
        });
      } catch (e) {
        console.warn("medicines save non-fatal:", e);
      }

      // FIX 1: after the primary save, PDF + WhatsApp are best-effort.
      // Failures are logged but never shown as toast errors and never block navigation.
      toast.loading("Generating prescription PDF…", { id: tid });
      try {
        await api.post(`/prescriptions/generate/${encodeURIComponent(visitId)}`);
      } catch (e) {
        console.warn("prescription PDF generation non-fatal:", e);
      }

      toast.loading("Sending to patient on WhatsApp…", { id: tid });
      try {
        await api.post(`/prescriptions/send/${encodeURIComponent(visitId)}`);
      } catch (e) {
        console.warn("prescription WhatsApp send non-fatal:", e);
      }

      toast.success("Prescription sent ✓ — sent to reception for billing", { id: tid });
      // Lifecycle: backend is the single source of truth. POST /visits/{id}/close
      // transitions queue → BILLING_PENDING, creates the billing/payment record,
      // and schedules the follow-up. Frontend no longer calls /queue/done or
      // /followups directly.
      const queueId = search.queue_id;
      if (queueId) {
        // Optimistically remove from doctor queues so the row disappears immediately.
        qc.setQueriesData<unknown[]>({ queryKey: ["queue", "today"] }, (prev) =>
          Array.isArray(prev) ? prev.filter((r: any) => r?.queue_id !== queueId && r?.id !== queueId) : prev,
        );
        try { queueActions.setStatus(queueId, "BILLING_PENDING"); } catch { /* ignore */ }
      }

      const followupDate = computeFollowupDate();
      const selectedPreset = FOLLOWUP_PRESETS.find((p) => p.id === followupChoice);
      try {
        await api.post(`/visits/${encodeURIComponent(visitId)}/close`, {
          fee: Number((visit as { fee?: unknown } | undefined)?.fee ?? 0),
          followup_date: followupDate ?? undefined,
          followup_type:
            selectedPreset?.backendType === "NONE"
              ? undefined
              : selectedPreset?.backendType,
          followup_channel: "WHATSAPP",
        });
      } catch (e) {
        console.error("[visit close] failed:", e);
        toast.error("Could not move visit to billing. Please retry.");
      }

      await qc.invalidateQueries({ queryKey: ["billing-pending"] });
      await qc.refetchQueries({ queryKey: ["billing-pending"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["queue", "today"] });
      qc.invalidateQueries({ queryKey: ["queue", "stats-today"] });
      qc.invalidateQueries({ queryKey: ["queue", "stats", "today"] });
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      void loadQueue();
      navigate({ to: "/doctor/queue" });

    } catch (e) {
      toast.error(errMsg(e), { id: tid });
    } finally {
      setSending(false);
    }
  };

  if (visitQ.isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto py-12 grid place-items-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mb-2" /> Loading visit…
      </div>
    );
  }

  if (visitQ.error || !visit) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
          <AlertTriangle className="size-4" /> Could not load visit: {errMsg(visitQ.error)}
        </div>
        <div className="mt-4">
          <Link to="/doctor/queue" className="text-primary text-sm hover:underline">← Back to queue</Link>
        </div>
      </div>
    );
  }

  const patientName = visit.patient?.full_name || "";

  return (
    <div className="max-w-[1200px] mx-auto pb-16">
      <div className="grid grid-cols-12 gap-5">
        {/* Header */}
        <div className="col-span-12 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 grid place-items-center text-white shadow">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Prescription</div>
              <div className="font-display text-2xl">{patientName}</div>
              {visit.chief_complaint && (
                <div className="text-xs text-muted-foreground mt-0.5">{visit.chief_complaint}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate({ to: "/consultation/edit/$visitId", params: { visitId } })}
              className="h-9 px-3 rounded-full border border-border text-sm hover:bg-muted inline-flex items-center gap-1"
            >
              <FileText className="size-4" /> Edit consultation
            </button>
            {patientId && (
              <button
                onClick={() => navigate({ to: "/consultation/$patientId", params: { patientId }, search: {} })}
                className="h-9 px-3 rounded-full border border-border text-sm hover:bg-muted inline-flex items-center gap-1"
              >
                <ArrowLeft className="size-4" /> Back to case paper
              </button>
            )}
          </div>
        </div>

        {/* SECTION A — Prescription (doctor) */}
        <section className="col-span-12 lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-lg">Rx — Doctor view</div>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidential</span>
            </div>

            <div className="space-y-3">
              {boxes.map((b, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-12 gap-2">
                    <Input col="2" label="BOX #" value={b.box} onChange={(v) => setBox(i, "box", v)} />
                    <Input col="4" label="Remedy" value={b.remedy} onChange={(v) => setBox(i, "remedy", v)} placeholder="e.g. Pulsatilla" />
                    <Select col="2" label="Potency" value={b.potency} onChange={(v) => setBox(i, "potency", v)} options={POTENCIES} />
                    <Select col="2" label="Timing" value={b.timing} onChange={(v) => setBox(i, "timing", v)} options={TIMINGS} />
                    <Input col="2" label="Days" value={b.days} onChange={(v) => setBox(i, "days", v)} type="number" />
                    <div className="col-span-11">
                      <Label>Food</Label>
                      <div className="flex gap-2">
                        {(["Before food", "After food", "With food"] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setBox(i, "food", b.food === f ? "" : f)}
                            className={`h-8 px-3 rounded-full border text-xs ${
                              b.food === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      {boxes.length > 1 && (
                        <button
                          onClick={() => removeBox(i)}
                          aria-label="Remove BOX"
                          className="size-9 grid place-items-center rounded-lg border border-border hover:bg-muted text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" className="rounded-full mt-3" onClick={addBox}>
              <Plus className="size-4 mr-1" /> Add BOX
            </Button>

            <div className="mt-4">
              <Label>Advice / instructions</Label>
              <textarea
                rows={3}
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                placeholder="Diet, lifestyle, do's and don'ts…"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            {/* Follow-up plan */}
            <div className="mt-5 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">Follow-up plan</div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">WhatsApp reminder</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {FOLLOWUP_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFollowupChoice(p.id)}
                    className={`h-8 px-3 rounded-full border text-xs ${
                      followupChoice === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {followupChoice === "custom" && (
                <div className="mt-3">
                  <Label>Custom follow-up date</Label>
                  <input
                    type="date"
                    value={followupCustomDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setFollowupCustomDate(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
              )}
              {followupChoice !== "none" && (
                <div className="text-[11px] text-muted-foreground mt-2">
                  Patient will receive a WhatsApp reminder on{" "}
                  <strong className="text-foreground tabular-nums">
                    {computeFollowupDate() || "—"}
                  </strong>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                disabled={sending}
                onClick={sendPrescription}
                className="h-11 px-6 rounded-full bg-teal-600 text-white font-medium text-sm inline-flex items-center gap-2 hover:bg-teal-700 disabled:opacity-60 shadow"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send Prescription
              </button>
            </div>
          </div>
        </section>

        {/* Patient PDF preview */}
        <aside className="col-span-12 lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card overflow-hidden sticky top-4">
            <div className="px-5 py-3 bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_82%,black)] text-primary-foreground">
              <div className="font-display text-lg leading-tight inline-flex items-center gap-2">
                <FileText className="size-4" /> Patient PDF preview
              </div>
              <div className="text-[11px] text-primary-foreground/80">No medicine names shown to patient</div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Patient</div>
              <div className="font-medium">{patientName}</div>

              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-3">Rx</div>
              <ul className="space-y-1.5">
                {boxes
                  .filter((b) => b.box.trim())
                  .map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">BOX {b.box}</span>
                      <span>
                        {b.timing}
                        {b.food ? `, ${b.food}` : ""} × {b.days} day{Number(b.days) === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
              </ul>

              {advice && (
                <>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-3">Advice</div>
                  <p className="text-sm whitespace-pre-line">{advice}</p>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{children}</div>;
}

function Input({
  label, value, onChange, type = "text", placeholder, col = "4",
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; col?: string }) {
  return (
    <div className={`col-span-12 md:col-span-${col}`}>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}

function Select({
  label, value, onChange, options, col = "2",
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; col?: string }) {
  return (
    <div className={`col-span-6 md:col-span-${col}`}>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

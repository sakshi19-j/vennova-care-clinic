import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowLeft, Send, Download, AlertTriangle, Zap, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

type PrescriptionSearch = {
  patient_id?: string;
  queue_id?: string;
};

export const Route = createFileRoute("/prescriptions/$visitId")({
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
  const search = useSearch({ from: "/prescriptions/$visitId" });
  const navigate = useNavigate();

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
  const [fee, setFee] = useState("500");
  const [submitting, setSubmitting] = useState(false);

  const addBox = () =>
    setBoxes((b) => [...b, { box: String(b.length + 1), remedy: "", potency: "30C", timing: "BD", food: "After food", days: "7" }]);
  const removeBox = (i: number) => setBoxes((b) => b.filter((_, idx) => idx !== i));
  const setBox = (i: number, field: keyof BoxItem, v: string) =>
    setBoxes((b) => b.map((x, idx) => (idx === i ? { ...x, [field]: v } : x)));

  const finalize = async (opts: { sendWhatsApp: boolean }) => {
    const valid = boxes.filter((b) => b.remedy.trim() && b.box.trim());
    if (valid.length === 0) {
      toast.error("Add at least one BOX with a remedy");
      return;
    }
    setSubmitting(true);
    const toastId = toast.loading("Saving prescription…");
    try {
      // 1) Persist remedy on the case (doctor-only fields)
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

      // 2) Generate PDF
      toast.loading("Generating prescription PDF…", { id: toastId });
      try {
        await api.post(`/prescriptions/generate/${encodeURIComponent(visitId)}`);
      } catch (e) {
        // non-fatal — backend may auto-generate on send
        console.warn("generate failed", e);
      }

      // 3) Send WhatsApp (optional fallback)
      if (opts.sendWhatsApp) {
        toast.loading("Sending to patient on WhatsApp…", { id: toastId });
        try {
          await api.post(`/prescriptions/send/${encodeURIComponent(visitId)}`);
        } catch (e) {
          toast.warning(`WhatsApp send failed — patient can be messaged manually. (${errMsg(e)})`);
        }
      }

      // 4) Close visit → moves to PENDING_BILLING
      toast.loading("Sending to billing…", { id: toastId });
      await api.post(`/visits/${encodeURIComponent(visitId)}/close`, {
        fee: Number(fee) || 0,
        payment_mode: null,
        disease_type: "default",
        followup_channel: "WHATSAPP",
      });

      toast.success("Prescription finalized · sent to billing", { id: toastId });
      navigate({ to: "/doctor/queue" });
    } catch (e) {
      toast.error(errMsg(e), { id: toastId });
    } finally {
      setSubmitting(false);
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

  const patientName = visit.patient?.full_name || "Patient";

  return (
    <div className="max-w-[1200px] mx-auto pb-28">
      <div className="grid grid-cols-12 gap-5">
        {/* Header / patient */}
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
          <button
            onClick={() => navigate({ to: "/consultation/$patientId", params: { patientId }, search: {} })}
            className="h-9 px-3 rounded-full border border-border text-sm hover:bg-muted inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-4" /> Back to case paper
          </button>
        </div>

        {/* Doctor view */}
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

            <div className="mt-4 grid grid-cols-2 gap-3 max-w-sm">
              <div>
                <Label>Fee (₹)</Label>
                <input
                  type="number"
                  min={0}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-lg font-display tabular-nums outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Patient view preview */}
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

      {/* Sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-2 justify-end flex-wrap">
          <button
            disabled={submitting}
            onClick={() => finalize({ sendWhatsApp: false })}
            className="h-11 px-5 rounded-full border border-border text-sm hover:bg-muted inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Download className="size-4" /> Finalize without WhatsApp
          </button>
          <button
            disabled={submitting}
            onClick={() => finalize({ sendWhatsApp: true })}
            className="h-11 px-6 rounded-full bg-teal-600 text-white font-medium text-sm inline-flex items-center gap-2 hover:bg-teal-700 disabled:opacity-60 shadow-lg"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Finalize & send WhatsApp
          </button>
        </div>
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

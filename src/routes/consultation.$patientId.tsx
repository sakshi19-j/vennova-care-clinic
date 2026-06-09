import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, AlertTriangle, CheckCircle2, Plus, Trash2, ExternalLink, ArrowLeft,
  ChevronDown, ChevronRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

type ConsultationSearch = {
  queue_id?: string;
  visit_type?: string;
};

export const Route = createFileRoute("/consultation/$patientId")({
  validateSearch: (s: Record<string, unknown>): ConsultationSearch => ({
    queue_id: typeof s.queue_id === "string" ? s.queue_id : undefined,
    visit_type: typeof s.visit_type === "string" ? s.visit_type : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Consultation — Vennova Clinic" },
      { name: "description", content: "Doctor consultation case paper: complaint, vitals, case-taking, remedy and billing." },
    ],
  }),
  component: ConsultationPage,
});

// ----- Helpers -----
function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.data as { detail?: unknown; message?: unknown } | null;
    const detail = d?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const m = detail.map((x: { msg?: string }) => x?.msg || "").filter(Boolean).join("; ");
      if (m) return m;
    }
    if (typeof d?.message === "string") return d.message;
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function pickId(o: unknown): string | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  for (const k of ["id", "visit_id", "ID"]) {
    const v = r[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

type Patient = {
  id: string;
  reg_no?: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_mobile?: string;
  patient_type?: string;
  total_visits?: number;
  last_visit?: string | null;
  [k: string]: unknown;
};

function displayName(p?: Patient | null): string {
  if (!p) return "Patient";
  if (p.full_name) return p.full_name;
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Patient";
}
function displayPhone(p?: Patient | null): string {
  if (!p) return "";
  return (p.phone || p.phone_mobile || "") as string;
}
function regFmt(p?: Patient | null): string {
  if (!p?.reg_no) return "—";
  return `VNC-${String(p.reg_no).padStart(4, "0")}`;
}

// ----- Form state -----
type Medicine = { name: string; dosage: string; frequency: string; duration: string };
const POTENCIES = ["6C", "30C", "200C", "1M", "10M", "CM", "50M"];
const MIASMS = ["Psora", "Sycosis", "Syphilis", "Tubercular"];
const THERMALS = ["Hot", "Cold", "Mixed"];

type FormState = {
  chief_complaint: string;
  // vitals
  bp_sys: string;
  bp_dia: string;
  weight: string;
  temperature: string;
  pulse: string;
  // history
  history_present: string;
  history_past: string;
  history_surgical: string;
  history_family: string;
  // generals
  thermal: string;
  appetite: string;
  thirst: string;
  sleep: string;
  dreams: string;
  mind_symptoms: string;
  // particulars
  particulars: string;
  rubrics: string[];
  rubricInput: string;
  // remedy
  remedy: string;
  potency: string;
  repetition: string;
  miasm: string;
  // allopathy
  diagnosis: string;
  medicines: Medicine[];
  advice: string;
  // billing
  fee: string;
  payment_mode: "CASH" | "UPI" | "CARD" | "ONLINE";
};

const initialForm = (): FormState => ({
  chief_complaint: "",
  bp_sys: "", bp_dia: "", weight: "", temperature: "", pulse: "",
  history_present: "", history_past: "", history_surgical: "", history_family: "",
  thermal: "", appetite: "", thirst: "", sleep: "", dreams: "", mind_symptoms: "",
  particulars: "", rubrics: [], rubricInput: "",
  remedy: "", potency: "", repetition: "", miasm: "",
  diagnosis: "", medicines: [{ name: "", dosage: "", frequency: "", duration: "" }], advice: "",
  fee: "500", payment_mode: "CASH",
});

// ----- Page -----
function ConsultationPage() {
  const { patientId } = Route.useParams();
  const search = useSearch({ from: "/consultation/$patientId" });
  const navigate = useNavigate();
  const visitType = (search.visit_type || "HOMEOPATHY").toUpperCase();
  const isAllo = visitType === "ALLOPATHY";

  const patientQ = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.get<Patient>(`/patients/${encodeURIComponent(patientId)}`),
    retry: 1,
  });
  const patient = patientQ.data;

  const [form, setForm] = useState<FormState>(initialForm);
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [open, setOpen] = useState({ vitals: true, history: false, generals: false, particulars: false, remedy: true });

  const [quickNote, setQuickNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    visitId: string;
    prescriptionUrl?: string;
    rxOk: boolean;
    whatsappOk: boolean;
    receiptOk: boolean;
  } | null>(null);

  const anyVitals = useMemo(
    () => [form.bp_sys, form.bp_dia, form.weight, form.temperature, form.pulse].some((x) => x.trim() !== ""),
    [form.bp_sys, form.bp_dia, form.weight, form.temperature, form.pulse]
  );

  const addRubric = () => {
    const r = form.rubricInput.trim();
    if (!r) return;
    setForm((f) => ({ ...f, rubrics: [...f.rubrics, r], rubricInput: "" }));
  };
  const removeRubric = (i: number) =>
    setForm((f) => ({ ...f, rubrics: f.rubrics.filter((_, idx) => idx !== i) }));

  const addMedicine = () =>
    setForm((f) => ({ ...f, medicines: [...f.medicines, { name: "", dosage: "", frequency: "", duration: "" }] }));
  const removeMedicine = (i: number) =>
    setForm((f) => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));
  const setMedicine = (i: number, field: keyof Medicine, v: string) =>
    setForm((f) => ({ ...f, medicines: f.medicines.map((m, idx) => (idx === i ? { ...m, [field]: v } : m)) }));

  const numOrNull = (s: string) => {
    const n = Number(s);
    return s.trim() === "" || !Number.isFinite(n) ? null : n;
  };

  const completeConsultation = async () => {
    if (!form.chief_complaint.trim()) {
      toast.error("Chief complaint is required");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create visit
      const visitRes = await api.post<unknown>("/visits/", {
        patient_id: patientId,
        visit_type: visitType,
        chief_complaint: form.chief_complaint,
        disease_type: "default",
      });
      const visitId = pickId(visitRes);
      if (!visitId) throw new Error("Visit was created but no ID returned");

      // 2. Vitals
      if (anyVitals) {
        try {
          await api.post(`/visits/${encodeURIComponent(visitId)}/vitals`, {
            weight_kg: numOrNull(form.weight),
            bp_systolic: numOrNull(form.bp_sys),
            bp_diastolic: numOrNull(form.bp_dia),
            temperature: numOrNull(form.temperature),
            pulse_rate: numOrNull(form.pulse),
          });
        } catch (e) {
          toast.warning(`Vitals not saved: ${errMsg(e)}`);
        }
      }

      // 3. Case data
      try {
        if (isAllo) {
          await api.post(`/visits/${encodeURIComponent(visitId)}/allopathy`, {
            diagnosis: form.diagnosis || null,
            medicines: form.medicines
              .filter((m) => m.name.trim())
              .map((m) => ({
                name: m.name,
                dosage: m.dosage || "",
                frequency: m.frequency || "",
                duration: m.duration || "",
              })),
            advice: form.advice || null,
          });
        } else {
          await api.post(`/visits/${encodeURIComponent(visitId)}/homeopathy`, {
            chief_complaint: form.chief_complaint,
            history_present: form.history_present || null,
            history_past: form.history_past || null,
            history_surgical: form.history_surgical || null,
            history_family: form.history_family || null,
            thermal_sensation: form.thermal || null,
            appetite: form.appetite || null,
            thirst: form.thirst || null,
            sleep: form.sleep || null,
            dreams: form.dreams || null,
            mind_symptoms: form.mind_symptoms || null,
            particulars: form.particulars ? { text: form.particulars } : null,
            rubrics: form.rubrics.map((r) => ({ text: r, grade: 1 })),
            remedy: form.remedy || null,
            potency: form.potency || null,
            repetition: form.repetition || null,
            miasm: form.miasm || null,
          });
        }
      } catch (e) {
        toast.warning(`Case details not saved: ${errMsg(e)}`);
      }

      // 4. Close visit + billing
      await api.post(`/visits/${encodeURIComponent(visitId)}/close`, {
        fee: Number(form.fee) || 0,
        payment_mode: form.payment_mode || "CASH",
        disease_type: "default",
        followup_channel: "WHATSAPP",
      });

      // 5. Prescription PDF
      let prescriptionUrl: string | undefined;
      let rxOk = false;
      try {
        const rx = await api.post<unknown>(`/prescriptions/generate/${encodeURIComponent(visitId)}`);
        rxOk = true;
        if (rx && typeof rx === "object") {
          const r = rx as Record<string, unknown>;
          const url = r.secure_url ?? r.url ?? r.pdf_url;
          if (typeof url === "string") prescriptionUrl = url;
        }
      } catch (e) {
        toast.warning(`Prescription PDF: ${errMsg(e)}`);
      }

      // 6. WhatsApp prescription
      let whatsappOk = false;
      try {
        await api.post(`/prescriptions/send/${encodeURIComponent(visitId)}`);
        whatsappOk = true;
      } catch (e) {
        toast.warning(`WhatsApp send: ${errMsg(e)}`);
      }

      // 7. Receipt
      let receiptOk = false;
      try {
        await api.post(`/billing/receipt/${encodeURIComponent(visitId)}`);
        receiptOk = true;
      } catch (e) {
        toast.warning(`Receipt: ${errMsg(e)}`);
      }

      setSuccess({ visitId, prescriptionUrl, rxOk, whatsappOk, receiptOk });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  // -------- Render --------
  if (patientQ.isLoading) {
    return (
      <div className="max-w-[1500px] mx-auto py-12 grid place-items-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mb-2" />
        Loading patient…
      </div>
    );
  }

  if (patientQ.error || !patient) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
          <AlertTriangle className="size-4" /> Could not load patient: {errMsg(patientQ.error)}
        </div>
        <div className="mt-4">
          <Link to="/queue" className="text-primary text-sm hover:underline">← Back to queue</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto pb-28">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate({ to: "/queue" })}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-4" /> Back to queue
        </button>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {isAllo ? "Allopathy" : "Homeopathy"} · Case paper
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* LEFT SIDEBAR */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-5 sticky top-4">
            <div className="size-14 rounded-full bg-primary/10 text-primary grid place-items-center font-display text-xl mb-3">
              {displayName(patient).charAt(0)}
            </div>
            <div className="font-display text-xl leading-tight">{displayName(patient)}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono">{regFmt(patient)}</div>
            <div className="text-sm text-muted-foreground mt-2">{displayPhone(patient) || "—"}</div>
            {patient.patient_type && (
              <span className="mt-3 inline-flex text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {patient.patient_type}
              </span>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border border-border p-2">
                <div className="font-display text-lg tabular-nums">{patient.total_visits ?? 0}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Visits</div>
              </div>
              <div className="rounded-lg border border-border p-2">
                <div className="text-xs tabular-nums">
                  {patient.last_visit
                    ? new Date(patient.last_visit).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                    : "—"}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Last visit</div>
              </div>
            </div>
            <Link
              to="/patients/$patientId"
              params={{ patientId }}
              className="mt-4 block text-center h-9 leading-9 rounded-full border border-border text-sm hover:bg-muted"
            >
              View full profile
            </Link>
          </div>
        </aside>

        {/* CENTER */}
        <section className="col-span-12 lg:col-span-6 space-y-4">
          <div className="font-display text-2xl">{isAllo ? "Consultation" : "Homeopathy Case Paper"}</div>

          {/* Chief complaint */}
          <Block title="Chief Complaint *">
            <textarea
              value={form.chief_complaint}
              onChange={(e) => setField("chief_complaint", e.target.value)}
              rows={3}
              required
              placeholder="What is the patient's main concern today?"
              className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Block>

          {/* Vitals */}
          <Collapsible
            title="Vitals"
            open={open.vitals}
            onToggle={() => setOpen((o) => ({ ...o, vitals: !o.vitals }))}
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Field label="BP Sys" value={form.bp_sys} onChange={(v) => setField("bp_sys", v)} type="number" />
              <Field label="BP Dia" value={form.bp_dia} onChange={(v) => setField("bp_dia", v)} type="number" />
              <Field label="Weight (kg)" value={form.weight} onChange={(v) => setField("weight", v)} type="number" />
              <Field label="Temp (°F)" value={form.temperature} onChange={(v) => setField("temperature", v)} type="number" />
              <Field label="Pulse" value={form.pulse} onChange={(v) => setField("pulse", v)} type="number" />
            </div>
          </Collapsible>

          {!isAllo && (
            <>
              {/* History */}
              <Collapsible
                title="History"
                open={open.history}
                onToggle={() => setOpen((o) => ({ ...o, history: !o.history }))}
              >
                <TextArea label="Present illness" value={form.history_present} onChange={(v) => setField("history_present", v)} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <TextArea label="Past" rows={3} value={form.history_past} onChange={(v) => setField("history_past", v)} />
                  <TextArea label="Surgical" rows={3} value={form.history_surgical} onChange={(v) => setField("history_surgical", v)} />
                  <TextArea label="Family" rows={3} value={form.history_family} onChange={(v) => setField("history_family", v)} />
                </div>
              </Collapsible>

              {/* Generals */}
              <Collapsible
                title="Generals"
                open={open.generals}
                onToggle={() => setOpen((o) => ({ ...o, generals: !o.generals }))}
              >
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Thermal</div>
                  <Pills options={THERMALS} value={form.thermal} onChange={(v) => setField("thermal", v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TextArea label="Appetite" rows={2} value={form.appetite} onChange={(v) => setField("appetite", v)} />
                  <TextArea label="Thirst" rows={2} value={form.thirst} onChange={(v) => setField("thirst", v)} />
                  <TextArea label="Sleep" rows={2} value={form.sleep} onChange={(v) => setField("sleep", v)} />
                  <TextArea label="Dreams" rows={2} value={form.dreams} onChange={(v) => setField("dreams", v)} />
                </div>
                <div className="mt-3">
                  <TextArea label="Mind symptoms" rows={3} value={form.mind_symptoms} onChange={(v) => setField("mind_symptoms", v)} />
                </div>
              </Collapsible>

              {/* Particulars & Rubrics */}
              <Collapsible
                title="Particulars & Rubrics"
                open={open.particulars}
                onToggle={() => setOpen((o) => ({ ...o, particulars: !o.particulars }))}
              >
                <TextArea label="Particulars" rows={3} value={form.particulars} onChange={(v) => setField("particulars", v)} />
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Rubrics</div>
                  <div className="flex gap-2">
                    <input
                      value={form.rubricInput}
                      onChange={(e) => setField("rubricInput", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRubric();
                        }
                      }}
                      placeholder="Type a rubric, press Enter…"
                      className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    <Button type="button" variant="outline" className="rounded-lg" onClick={addRubric}>
                      Add
                    </Button>
                  </div>
                  {form.rubrics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.rubrics.map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {r}
                          <button onClick={() => removeRubric(i)} className="hover:text-destructive" aria-label="Remove">
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Collapsible>

              {/* Remedy */}
              <Collapsible
                title="Remedy"
                open={open.remedy}
                onToggle={() => setOpen((o) => ({ ...o, remedy: !o.remedy }))}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Remedy" value={form.remedy} onChange={(v) => setField("remedy", v)} />
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Potency</div>
                    <select
                      value={form.potency}
                      onChange={(e) => setField("potency", e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      <option value="">—</option>
                      {POTENCIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <Field label="Repetition" value={form.repetition} onChange={(v) => setField("repetition", v)} placeholder="e.g. BD x 7 days" />
                </div>
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Miasm</div>
                  <Pills options={MIASMS} value={form.miasm} onChange={(v) => setField("miasm", v)} />
                </div>
              </Collapsible>
            </>
          )}

          {isAllo && (
            <Block title="Diagnosis & Medicines">
              <Field label="Diagnosis" value={form.diagnosis} onChange={(v) => setField("diagnosis", v)} />
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Medicines</div>
                <div className="space-y-2">
                  {form.medicines.map((m, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder="Name" value={m.name} onChange={(e) => setMedicine(i, "name", e.target.value)}
                        className="col-span-12 md:col-span-4 h-9 rounded-lg border border-border bg-background px-3 text-sm"
                      />
                      <input
                        placeholder="Dosage" value={m.dosage} onChange={(e) => setMedicine(i, "dosage", e.target.value)}
                        className="col-span-4 md:col-span-2 h-9 rounded-lg border border-border bg-background px-3 text-sm"
                      />
                      <input
                        placeholder="Frequency" value={m.frequency} onChange={(e) => setMedicine(i, "frequency", e.target.value)}
                        className="col-span-4 md:col-span-3 h-9 rounded-lg border border-border bg-background px-3 text-sm"
                      />
                      <input
                        placeholder="Duration" value={m.duration} onChange={(e) => setMedicine(i, "duration", e.target.value)}
                        className="col-span-3 md:col-span-2 h-9 rounded-lg border border-border bg-background px-3 text-sm"
                      />
                      <button
                        onClick={() => removeMedicine(i)} aria-label="Remove"
                        className="col-span-1 size-9 grid place-items-center rounded-lg border border-border hover:bg-muted"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" className="rounded-full mt-3" onClick={addMedicine}>
                  <Plus className="size-4 mr-1" /> Add medicine
                </Button>
              </div>
              <div className="mt-3">
                <TextArea label="Advice" rows={3} value={form.advice} onChange={(v) => setField("advice", v)} />
              </div>
            </Block>
          )}

          {/* Billing */}
          <Block title="Billing">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Fee (₹)</div>
                <input
                  type="number" min={0} value={form.fee} onChange={(e) => setField("fee", e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Payment mode</div>
                <Pills
                  options={["CASH", "UPI", "CARD", "ONLINE"]}
                  value={form.payment_mode}
                  onChange={(v) => setField("payment_mode", v as FormState["payment_mode"])}
                />
              </div>
            </div>
          </Block>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="col-span-12 lg:col-span-3 hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-5 sticky top-4 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Previous remedy</div>
              <div className="text-sm text-muted-foreground">
                {patient.last_visit ? "Check full profile for history" : "No previous visits"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Quick notes</div>
              <textarea
                rows={6}
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="Scratchpad (not saved)…"
                className="w-full rounded-lg border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-[1500px] mx-auto px-4 py-3 flex items-center gap-3 justify-end">
          <div className="text-sm text-muted-foreground hidden md:block">
            ₹{Number(form.fee) || 0} · {form.payment_mode}
          </div>
          <button
            disabled={submitting || !form.chief_complaint.trim()}
            onClick={completeConsultation}
            className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium text-sm inline-flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {submitting ? "Completing…" : "Complete Consultation"}
          </button>
        </div>
      </div>

      {/* Success modal */}
      {success && (
        <SuccessModal
          patientName={displayName(patient)}
          phone={displayPhone(patient)}
          info={success}
          onNext={() => navigate({ to: "/queue" })}
          onClose={() => setSuccess(null)}
        />
      )}
    </div>
  );
}

// ----- Subcomponents -----

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-display text-lg mb-3">{title}</div>
      {children}
    </div>
  );
}

function Collapsible({
  title, open, onToggle, children,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30"
      >
        <span className="font-display text-lg">{title}</span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
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

function TextArea({
  label, value, onChange, rows = 4,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}

function Pills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? "" : o)}
          className={`h-9 px-4 rounded-full border text-sm transition ${
            value === o
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border hover:bg-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SuccessModal({
  patientName, phone, info, onNext, onClose,
}: {
  patientName: string;
  phone: string;
  info: { visitId: string; prescriptionUrl?: string; rxOk: boolean; whatsappOk: boolean; receiptOk: boolean };
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="size-14 rounded-full bg-success/10 text-success grid place-items-center mx-auto mb-3">
          <CheckCircle2 className="size-8" />
        </div>
        <div className="text-center font-display text-2xl">Consultation Complete</div>
        <div className="text-center text-sm text-muted-foreground mt-1">for {patientName}</div>

        <ul className="mt-5 space-y-2 text-sm">
          <li className={info.rxOk ? "text-foreground" : "text-muted-foreground"}>
            {info.rxOk ? "✓" : "·"} Prescription PDF {info.rxOk ? "generated" : "skipped"}
          </li>
          <li className={info.whatsappOk ? "text-foreground" : "text-muted-foreground"}>
            {info.whatsappOk ? "✓" : "·"} WhatsApp sent{phone ? ` to ${phone}` : ""}
          </li>
          <li className={info.receiptOk ? "text-foreground" : "text-muted-foreground"}>
            {info.receiptOk ? "✓" : "·"} Receipt {info.receiptOk ? "generated" : "skipped"}
          </li>
          <li className="text-foreground">✓ Followup reminders scheduled</li>
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={onNext} className="h-11 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Next patient
          </button>
          {info.prescriptionUrl ? (
            <a
              href={info.prescriptionUrl} target="_blank" rel="noopener noreferrer"
              className="h-11 rounded-full border border-border text-sm font-medium hover:bg-muted inline-flex items-center justify-center gap-1"
            >
              View prescription <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <button onClick={onClose} className="h-11 rounded-full border border-border text-sm font-medium hover:bg-muted">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

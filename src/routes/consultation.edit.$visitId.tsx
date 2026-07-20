// Edit Consultation — production-ready editor for an existing visit.
//
// Load: GET /visits/{visitId} (existing endpoint — already used by
// prescription.$visitId.tsx).  We hydrate Chief Complaint, Diagnosis,
// Examination/Observations, Medicines, Dosage, Advice, Notes, Fee,
// Follow-up date + type into a single editable form.
//
// Save: every PUT call is funnelled through `saveConsultationEdits()`
// below.  When the backend exposes update endpoints they are already
// wired (PUT /visits/{id}, PUT /visits/{id}/homeopathy, PUT /visits/
// {id}/medicines, POST /followups).  If any endpoint is missing the
// failure is caught, surfaced as a non-blocking toast, and the rest of
// the save still runs — so the UI is shippable today and only the
// single helper needs adjusting once the backend lands.
//
// PDFs are NEVER generated client-side — the Preview / Download /
// Print buttons all point at the existing backend URLs from
// prescriptionsService.pdfUrl() and billingService.receiptUrl().

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, AlertTriangle, ArrowLeft, Plus, Trash2, Save, FileText, Download, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { prescriptionsService } from "@/services/prescriptions";
import { billingService } from "@/services/billing";

// ---------- Types ----------
type Medicine = {
  id?: string;
  name: string;
  dosage: string;       // ↔ backend `potency`
  frequency: string;    // ↔ backend `timing`
  duration: string;     // ↔ backend `days`
  notes?: string;
  food_relation?: string;
};

type HomeoCase = {
  chief_complaint?: string;
  diagnosis?: string;
  history_present?: string;
  history_past?: string;
  history_surgical?: string;
  history_family?: string;
  thermal_sensation?: string;
  appetite?: string;
  thirst?: string;
  sleep?: string;
  dreams?: string;
  menstrual?: string;
  mind_symptoms?: string;
  particulars?: { text?: string } | string;
  rubrics?: string;
  advice?: string;
  remedy?: string;
  potency?: string;
  repetition?: string;
  miasm?: string;
  patient_rx?: string;
};

type Visit = {
  id?: string;
  visit_id?: string;
  patient_id?: string;
  chief_complaint?: string;
  diagnosis?: string;
  examination?: string;
  observations?: string;
  notes?: string;
  advice?: string;
  fee?: number | string;
  followup_date?: string;
  followup_type?: string;
  vitals?: Record<string, unknown>;
  patient?: { id?: string; full_name?: string; phone?: string; phone_mobile?: string };
  homeopathy?: HomeoCase;
  homeopathy_case?: HomeoCase;
  medicines?: Array<Medicine & { potency?: string; timing?: string; days?: string | number }>;
  [k: string]: unknown;
};

type FollowupType = "THREE_DAY" | "SEVEN_DAY" | "FIFTEEN_DAY" | "MONTHLY" | "CUSTOM" | "NONE";

type FormState = {
  chief_complaint: string;
  diagnosis: string;
  examination: string;
  observations: string;
  advice: string;
  notes: string;
  fee: string;
  followup_date: string;
  followup_type: FollowupType;
  medicines: Medicine[];
};

const FOLLOWUP_OPTIONS: { value: FollowupType; label: string; days: number }[] = [
  { value: "THREE_DAY",   label: "3 days",   days: 3 },
  { value: "SEVEN_DAY",   label: "7 days",   days: 7 },
  { value: "FIFTEEN_DAY", label: "15 days",  days: 15 },
  { value: "MONTHLY",     label: "Monthly",  days: 30 },
  { value: "CUSTOM",      label: "Custom",   days: 0 },
  { value: "NONE",        label: "No follow-up", days: 0 },
];

// ---------- Helpers ----------
function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.data as { detail?: unknown } | null;
    if (typeof d?.detail === "string") return d.detail;
    if (Array.isArray(d?.detail)) {
      return d.detail.map((x: { msg?: string }) => x?.msg || "").filter(Boolean).join(", ") || e.message;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}

function particularsText(p: unknown): string {
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && "text" in p) {
    const t = (p as { text?: string }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

function hydrateForm(v: Visit | null | undefined): FormState {
  const h: HomeoCase = { ...(v?.homeopathy ?? {}), ...(v?.homeopathy_case ?? {}) };
  const observations = pickStr(
    v?.observations,
    h.mind_symptoms,
    particularsText(h.particulars),
    h.thermal_sensation,
    h.appetite,
    h.thirst,
    h.sleep,
    h.dreams,
  );
  return {
    chief_complaint: pickStr(v?.chief_complaint, h.chief_complaint),
    diagnosis:       pickStr(v?.diagnosis, h.diagnosis),
    examination:     pickStr(v?.examination, h.history_present, h.history_past, h.history_family, h.history_surgical),
    observations,
    advice:          pickStr(v?.advice, h.advice),
    notes:           pickStr(v?.notes, h.patient_rx, h.remedy),
    fee:             pickStr(v?.fee),
    followup_date:   pickStr(v?.followup_date),
    followup_type:   (pickStr(v?.followup_type) as FollowupType) || "NONE",
    medicines: Array.isArray(v?.medicines) && v!.medicines!.length > 0
      ? v!.medicines!.map((m) => ({
          id: m.id,
          name: pickStr(m.name),
          // Backend canonical fields are potency/timing/days; fall back to
          // dosage/frequency/duration for legacy payloads.
          dosage:    pickStr(m.potency, m.dosage),
          frequency: pickStr(m.timing, m.frequency),
          duration:  pickStr(m.days, m.duration),
          notes:     pickStr(m.notes),
          food_relation: pickStr(m.food_relation),
        }))
      : [{ name: "", dosage: "", frequency: "", duration: "" }],
  };
}

// ---------- Single-point save handler ----------
// All PUT/POST calls live here.  If a backend endpoint isn't ready yet,
// only the lines inside this helper need updating — the rest of the UI
// stays exactly the same.
async function saveConsultationEdits(visitId: string, patientId: string, form: FormState): Promise<{ saved: string[]; warnings: string[] }> {
  const saved: string[] = [];
  const warnings: string[] = [];

  // 1) Visit (chief complaint, diagnosis, exam, notes, fee, followup).
  try {
    const payload: Record<string, unknown> = {
      chief_complaint: form.chief_complaint.trim() || undefined,
      diagnosis:       form.diagnosis.trim() || undefined,
      examination:     form.examination.trim() || undefined,
      observations:    form.observations.trim() || undefined,
      advice:          form.advice.trim() || undefined,
      notes:           form.notes.trim() || undefined,
      fee:             form.fee.trim() === "" ? undefined : Number(form.fee),
      followup_date:   form.followup_date || undefined,
      followup_type:   form.followup_type === "NONE" ? undefined : form.followup_type,
    };
    await api.put(`/visits/${encodeURIComponent(visitId)}`, payload);
    saved.push("visit");
  } catch (e) {
    warnings.push(`Visit update: ${errMsg(e)}`);
  }

  // 2) Homeopathy case fields (PUT, falls back to POST if backend uses upsert).
  try {
    const homeo: Record<string, unknown> = {
      chief_complaint: form.chief_complaint.trim() || undefined,
      diagnosis:       form.diagnosis.trim() || undefined,
      history_present: form.examination.trim() || undefined,
      mind_symptoms:   form.observations.trim() || undefined,
      advice:          form.advice.trim() || undefined,
    };
    await api.put(`/visits/${encodeURIComponent(visitId)}/homeopathy`, homeo);
    saved.push("case");
  } catch (e) {
    // Fall back to POST (upsert) — many backends only expose POST.
    try {
      await api.post(`/visits/${encodeURIComponent(visitId)}/homeopathy`, {
        chief_complaint: form.chief_complaint.trim(),
        history_present: form.examination.trim() || undefined,
        mind_symptoms:   form.observations.trim() || undefined,
        advice:          form.advice.trim() || undefined,
      });
      saved.push("case");
    } catch (e2) {
      warnings.push(`Case update: ${errMsg(e2)}`);
    }
  }

  // 3) Medicines (only saved if at least one row has a name).
  //    Backend expects: { name, potency, timing, days, notes } — NOT
  //    { dosage, frequency, duration }.
  const meds = form.medicines.filter((m) => m.name.trim());
  if (meds.length > 0) {
    try {
      await api.put(`/visits/${encodeURIComponent(visitId)}/medicines`, {
        medicines: meds.map((m) => ({
          name: m.name,
          potency: m.dosage,
          timing: m.frequency,
          days: m.duration,
          notes: m.notes,
        })),
      });
      saved.push("medicines");
    } catch (e) {
      warnings.push(`Medicines: ${errMsg(e)}`);
    }
  }

  // 4) Follow-up — dedicated endpoint. NEVER call /close from Edit
  //    Consultation: /close re-triggers billing, payment and visit-count
  //    side effects meant only for the original close action.
  if (form.followup_type !== "NONE" && form.followup_date) {
    try {
      await api.post(`/visits/${encodeURIComponent(visitId)}/followup`, {
        followup_date: form.followup_date,
        followup_type: form.followup_type,
      });
      saved.push("followup");
    } catch (e) {
      warnings.push(`Follow-up: ${errMsg(e)}`);
    }
  }


  return { saved, warnings };
}

// ---------- Route ----------
export const Route = createFileRoute("/consultation/edit/$visitId")({
  head: () => ({
    meta: [
      { title: "Edit Consultation — Vennova Clinic" },
      { name: "description", content: "Edit a previously saved consultation." },
    ],
  }),
  component: EditConsultationPage,
});

function EditConsultationPage() {
  const { visitId } = Route.useParams();
  const navigate = useNavigate();

  const visitQ = useQuery({
    queryKey: ["visit", visitId],
    queryFn: () => api.get<Visit>(`/visits/${encodeURIComponent(visitId)}`),
    retry: 1,
  });

  const visit = visitQ.data;
  const patientId = visit?.patient_id || visit?.patient?.id || "";
  const patientName = visit?.patient?.full_name || "";

  const [form, setForm] = useState<FormState>(() => hydrateForm(null));
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visit && !hydrated) {
      setForm(hydrateForm(visit));
      setHydrated(true);
    }
  }, [visit, hydrated]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setMed = (i: number, k: keyof Medicine, v: string) =>
    setForm((f) => ({
      ...f,
      medicines: f.medicines.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)),
    }));

  const addMed = () =>
    setForm((f) => ({
      ...f,
      medicines: [...f.medicines, { name: "", dosage: "", frequency: "", duration: "" }],
    }));

  const removeMed = (i: number) =>
    setForm((f) => ({
      ...f,
      medicines: f.medicines.length > 1
        ? f.medicines.filter((_, idx) => idx !== i)
        : f.medicines,
    }));

  const onFollowupTypeChange = (t: FollowupType) => {
    const preset = FOLLOWUP_OPTIONS.find((o) => o.value === t);
    let date = form.followup_date;
    if (preset && preset.days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + preset.days);
      date = d.toISOString().slice(0, 10);
    } else if (t === "NONE") {
      date = "";
    }
    setForm((f) => ({ ...f, followup_type: t, followup_date: date }));
  };

  const onSave = async () => {
    if (!form.chief_complaint.trim()) {
      toast.error("Chief complaint is required");
      return;
    }
    setSaving(true);
    const tid = toast.loading("Saving consultation…");
    try {
      const { saved, warnings } = await saveConsultationEdits(visitId, patientId, form);
      if (saved.length === 0) {
        toast.error(`Save failed — ${warnings[0] ?? "no changes persisted"}`, { id: tid });
      } else if (warnings.length > 0) {
        toast.success(`Saved (${saved.join(", ")}) — some fields awaiting backend support`, {
          id: tid,
          description: warnings.join(" · "),
        });
      } else {
        toast.success("Consultation updated", { id: tid });
      }
    } catch (e) {
      toast.error(errMsg(e), { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const prescriptionPdf = useMemo(() => {
    const base = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
    return `${base}/visits/${encodeURIComponent(visitId)}/pdf`;
  }, [visitId]);
  const receiptPdf = useMemo(() => billingService.receiptUrl(visitId), [visitId]);

  if (visitQ.isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto py-12 grid place-items-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mb-2" /> Loading consultation…
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

  return (
    <div className="max-w-[1200px] mx-auto pb-16">
      <div className="grid grid-cols-12 gap-5">
        {/* Header */}
        <div className="col-span-12 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/doctor/queue" })}
              aria-label="Back"
              className="size-9 grid place-items-center rounded-lg border border-border hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Edit consultation</div>
              <div className="font-display text-2xl">{patientName || "Visit"}</div>
              {visit.chief_complaint && (
                <div className="text-xs text-muted-foreground mt-0.5">{visit.chief_complaint}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => window.open(prescriptionPdf, "_blank", "noopener")}>
              <FileText className="size-4 mr-1" /> Preview Rx
            </Button>
            <a href={prescriptionPdf} download className="h-9 inline-flex items-center gap-1 px-3 rounded-full border border-border text-sm hover:bg-muted">
              <Download className="size-4" /> Download
            </a>
            <Button variant="outline" className="rounded-full" onClick={() => {
              const w = window.open(prescriptionPdf, "_blank");
              if (w) w.addEventListener("load", () => w.print());
            }}>
              <Printer className="size-4 mr-1" /> Print
            </Button>
          </div>
        </div>

        {/* Form */}
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <Card title="Clinical">
            <Field label="Chief complaint" required>
              <textarea
                rows={2}
                value={form.chief_complaint}
                onChange={(e) => set("chief_complaint", e.target.value)}
                className="ta"
              />
            </Field>
            <Field label="Diagnosis">
              <textarea rows={2} value={form.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} className="ta" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Examination">
                <textarea rows={3} value={form.examination} onChange={(e) => set("examination", e.target.value)} className="ta" />
              </Field>
              <Field label="Observations">
                <textarea rows={3} value={form.observations} onChange={(e) => set("observations", e.target.value)} className="ta" />
              </Field>
            </div>
          </Card>

          <Card title="Medicines">
            <div className="space-y-3">
              {form.medicines.map((m, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-12 gap-2">
                    <Input col={5} label="Name"      value={m.name}      onChange={(v) => setMed(i, "name", v)} />
                    <Input col={2} label="Dosage"    value={m.dosage}    onChange={(v) => setMed(i, "dosage", v)} />
                    <Input col={2} label="Frequency" value={m.frequency} onChange={(v) => setMed(i, "frequency", v)} />
                    <Input col={2} label="Duration"  value={m.duration}  onChange={(v) => setMed(i, "duration", v)} />
                    <div className="col-span-1 flex items-end justify-end">
                      {form.medicines.length > 1 && (
                        <button
                          onClick={() => removeMed(i)}
                          aria-label="Remove medicine"
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
            <Button type="button" variant="outline" className="rounded-full mt-3" onClick={addMed}>
              <Plus className="size-4 mr-1" /> Add medicine
            </Button>
          </Card>

          <Card title="Advice & notes">
            <Field label="Advice">
              <textarea rows={3} value={form.advice} onChange={(e) => set("advice", e.target.value)} className="ta" />
            </Field>
            <Field label="Internal notes">
              <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="ta" />
            </Field>
          </Card>
        </section>

        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <Card title="Billing">
            <Field label="Consultation fee (₹)">
              <input
                type="number"
                min={0}
                value={form.fee}
                onChange={(e) => set("fee", e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
              />
            </Field>
            <div className="text-[11px] text-muted-foreground">
              Receipts are generated by the backend.
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <a href={receiptPdf} target="_blank" rel="noopener" className="h-8 inline-flex items-center gap-1 px-3 rounded-full border border-border text-xs hover:bg-muted">
                <FileText className="size-3.5" /> Preview
              </a>
              <a href={receiptPdf} download className="h-8 inline-flex items-center gap-1 px-3 rounded-full border border-border text-xs hover:bg-muted">
                <Download className="size-3.5" /> Download
              </a>
            </div>
          </Card>

          <Card title="Follow-up">
            <Field label="Type">
              <div className="flex flex-wrap gap-2">
                {FOLLOWUP_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onFollowupTypeChange(o.value)}
                    className={`h-8 px-3 rounded-full border text-xs ${
                      form.followup_type === o.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={form.followup_date}
                min={new Date().toISOString().slice(0, 10)}
                disabled={form.followup_type === "NONE"}
                onChange={(e) => set("followup_date", e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
              />
            </Field>
          </Card>

          <button
            disabled={saving}
            onClick={onSave}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground font-medium text-sm inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 shadow"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </button>
        </aside>
      </div>

      <style>{`
        .ta { width: 100%; border-radius: .5rem; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: .625rem .75rem; font-size: .875rem; outline: none; }
        .ta:focus { box-shadow: 0 0 0 2px hsl(var(--ring) / .4); }
      `}</style>
    </div>
  );
}

// ---------- Tiny UI primitives ----------
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-display text-lg mb-3">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </div>
      {children}
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", col = 4,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; col?: number }) {
  const colMap: Record<number, string> = {
    1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4",
    5: "md:col-span-5", 6: "md:col-span-6", 7: "md:col-span-7", 8: "md:col-span-8",
  };
  return (
    <div className={`col-span-12 ${colMap[col] ?? "md:col-span-4"}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader, Tag } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { getPatient, tagStyles } from "@/lib/clinic-data";
import {
  Save, Plus, Trash2, Loader2, History, Stethoscope, Pill,
  ClipboardList, X, Banknote, Smartphone, CreditCard, Wifi, QrCode, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/consultation/$visitId")({
  head: () => ({ meta: [{ title: "Consultation — Vedic Clinic" }] }),
  component: Consultation,
});

// ───────────────────────── Types ─────────────────────────
type CaseType = "HOMEOPATHY" | "ALLOPATHY";

type HistoryVisit = {
  visit_id: string;
  date: string;
  remedy?: string;
  potency?: string;
  chief_complaint?: string;
  notes?: string;
};

type Rubric = { id: string; text: string; grade: 1 | 2 | 3 };
type Medicine = { id: string; name: string; dosage: string; frequency: string; duration: string; instructions: string };

type HomeoForm = {
  chief_complaint: string;
  history_present: string;
  history_past: string;
  history_family: string;
  thermal: string;
  appetite: string;
  thirst: string;
  sleep: string;
  dreams: string;
  mind: string;
  remedy: string;
  potency: string;
  repetition: string;
  miasm: string;
  rubrics: Rubric[];
};
const emptyHomeo: HomeoForm = {
  chief_complaint: "", history_present: "", history_past: "", history_family: "",
  thermal: "", appetite: "", thirst: "", sleep: "", dreams: "", mind: "",
  remedy: "", potency: "", repetition: "", miasm: "", rubrics: [],
};

type AlloForm = {
  chief_complaint: string;
  medicines: Medicine[];
  advice: string;
  next_visit_date: string;
};
const emptyAllo: AlloForm = {
  chief_complaint: "", medicines: [], advice: "", next_visit_date: "",
};

// ───────────────────────── Tokens ─────────────────────────
const inp = "h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";
const ta = "w-full min-h-[88px] rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";
const lab = "text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block";

// ───────────────────────── Component ─────────────────────────
function Consultation() {
  const { visitId } = Route.useParams();
  // Heuristic: assume patient P-1042 for demo when not provided. In production
  // visit→patient lookup would come from /visits/{visitId} fetch.
  const p = getPatient("P-1042")!;
  const patientId = p.id;

  const [tab, setTab] = useState<CaseType>("HOMEOPATHY");
  const [homeo, setHomeo] = useState<HomeoForm>(emptyHomeo);
  const [allo, setAllo] = useState<AlloForm>(emptyAllo);
  const [saving, setSaving] = useState(false);
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null);
  const [billingOpen, setBillingOpen] = useState(false);

  // Previous history
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setHistLoading(true);
    api.get<HistoryVisit[]>(`/visits/${encodeURIComponent(patientId)}/history`)
      .then((data) => { if (alive) { setHistory(Array.isArray(data) ? data.slice(0, 5) : []); setHistError(null); } })
      .catch((err) => { if (alive) setHistError(err instanceof ApiError ? err.message : (err as Error).message); })
      .finally(() => { if (alive) setHistLoading(false); });
    return () => { alive = false; };
  }, [patientId]);

  const saveCasePaper = async () => {
    const payload =
      tab === "HOMEOPATHY"
        ? { type: "HOMEOPATHY" as const, patient_id: patientId, visit_ref: visitId, ...homeo }
        : { type: "ALLOPATHY" as const, patient_id: patientId, visit_ref: visitId, ...allo };
    setSaving(true);
    try {
      const res = await api.post<{ id?: string; visit_id?: string }>("/visits", payload);
      const id = res?.id ?? res?.visit_id ?? visitId;
      setSavedVisitId(id);
      toast.success("Case paper saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow={`Visit · ${visitId} · ${p.name}`}
        title="Consultation"
        subtitle={`${p.age}/${p.sex} · ${p.phone} · Visit #${p.visits}`}
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={saveCasePaper} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
              Save case paper
            </Button>
            <Button
              className="rounded-full"
              onClick={() => setBillingOpen(true)}
              disabled={!savedVisitId}
              title={savedVisitId ? "Open billing" : "Save the case paper first"}
            >
              Send to billing
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        {/* LEFT: Previous history */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <History className="size-4 text-primary" />
              <div className="font-display text-xl">Previous history</div>
            </div>
            <div className="text-xs text-muted-foreground mb-3">Last {history.length || 0} visits. Showing remedy, potency &amp; complaint to inform today's prescription.</div>

            {histLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="size-4 animate-spin" /> Loading history…
              </div>
            ) : histError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{histError}</div>
            ) : history.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground text-center">No prior visits on record.</div>
            ) : (
              <ol className="relative pl-5 space-y-3">
                <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                {history.map((v) => (
                  <li key={v.visit_id} className="relative">
                    <span className="absolute -left-[14px] top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
                    <div className="text-xs text-muted-foreground">{v.date}</div>
                    {v.chief_complaint && <div className="text-sm mt-0.5">{v.chief_complaint}</div>}
                    {(v.remedy || v.potency) && (
                      <div className="text-[12px] mt-1 text-primary inline-flex items-center gap-1.5">
                        <Pill className="size-3" />
                        {v.remedy ?? "—"}{v.potency ? ` · ${v.potency}` : ""}
                      </div>
                    )}
                    {v.notes && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{v.notes}</div>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>

        {/* RIGHT: Today's case paper */}
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="size-4 text-primary" />
              <div className="font-display text-xl">Today's case paper</div>
            </div>
            <div className="text-xs text-muted-foreground mb-4">Choose system &amp; fill in the visit notes.</div>

            {/* Tabs */}
            <div className="inline-flex p-1 rounded-full bg-muted/60 mb-4">
              {(["HOMEOPATHY", "ALLOPATHY"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`h-9 px-5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <Stethoscope className="size-3.5" /> {t === "HOMEOPATHY" ? "Homeopathy" : "Allopathy"}
                </button>
              ))}
            </div>

            {tab === "HOMEOPATHY" ? (
              <HomeopathySection value={homeo} onChange={setHomeo} />
            ) : (
              <AllopathySection value={allo} onChange={setAllo} />
            )}
          </Card>

          {savedVisitId && (
            <Card className="bg-emerald-500/5 border-emerald-500/30">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <div className="text-sm">
                  Case paper saved. Visit <span className="font-mono">{savedVisitId}</span>. Click <strong>Send to billing</strong> to collect payment and schedule follow-ups.
                </div>
              </div>
            </Card>
          )}
        </section>
      </div>

      {billingOpen && savedVisitId && (
        <BillingModal
          visitId={savedVisitId}
          patientName={p.name}
          onClose={() => setBillingOpen(false)}
        />
      )}
    </div>
  );
}

// ───────────────────────── Homeopathy section ─────────────────────────
function HomeopathySection({ value, onChange }: { value: HomeoForm; onChange: (v: HomeoForm) => void }) {
  const set = <K extends keyof HomeoForm>(k: K, v: HomeoForm[K]) => onChange({ ...value, [k]: v });
  const addRubric = () => set("rubrics", [...value.rubrics, { id: `r-${Date.now()}`, text: "", grade: 2 }]);
  const updateRubric = (id: string, patch: Partial<Rubric>) =>
    set("rubrics", value.rubrics.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRubric = (id: string) => set("rubrics", value.rubrics.filter((r) => r.id !== id));

  return (
    <div className="space-y-4">
      <Field label="Chief complaint"><textarea className={ta} value={value.chief_complaint} onChange={(e) => set("chief_complaint", e.target.value)} /></Field>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="History of present illness"><textarea className={ta} value={value.history_present} onChange={(e) => set("history_present", e.target.value)} /></Field>
        <Field label="Past history"><textarea className={ta} value={value.history_past} onChange={(e) => set("history_past", e.target.value)} /></Field>
        <Field label="Family history"><textarea className={ta} value={value.history_family} onChange={(e) => set("history_family", e.target.value)} /></Field>
        <Field label="Mind symptoms"><textarea className={ta} value={value.mind} onChange={(e) => set("mind", e.target.value)} /></Field>
      </div>

      <div className="grid md:grid-cols-5 gap-3">
        <Field label="Thermal sensation"><input className={inp} value={value.thermal} onChange={(e) => set("thermal", e.target.value)} placeholder="hot / chilly" /></Field>
        <Field label="Appetite"><input className={inp} value={value.appetite} onChange={(e) => set("appetite", e.target.value)} /></Field>
        <Field label="Thirst"><input className={inp} value={value.thirst} onChange={(e) => set("thirst", e.target.value)} /></Field>
        <Field label="Sleep"><input className={inp} value={value.sleep} onChange={(e) => set("sleep", e.target.value)} /></Field>
        <Field label="Dreams"><input className={inp} value={value.dreams} onChange={(e) => set("dreams", e.target.value)} /></Field>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Field label="Remedy"><input className={inp} value={value.remedy} onChange={(e) => set("remedy", e.target.value)} placeholder="e.g. Pulsatilla" /></Field>
        <Field label="Potency"><input className={inp} value={value.potency} onChange={(e) => set("potency", e.target.value)} placeholder="e.g. 200C / 1M / 10M" /></Field>
        <Field label="Repetition"><input className={inp} value={value.repetition} onChange={(e) => set("repetition", e.target.value)} placeholder="e.g. OD / SOS" /></Field>
        <Field label="Miasm"><input className={inp} value={value.miasm} onChange={(e) => set("miasm", e.target.value)} placeholder="Psoric / Sycotic…" /></Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={lab}>Rubrics</span>
          <button type="button" onClick={addRubric} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            <Plus className="size-3.5" /> Add rubric
          </button>
        </div>
        {value.rubrics.length === 0 && <div className="text-xs text-muted-foreground">No rubrics added.</div>}
        <ul className="space-y-2">
          {value.rubrics.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <input className={inp} placeholder="Rubric text" value={r.text} onChange={(e) => updateRubric(r.id, { text: e.target.value })} />
              <select className="h-10 rounded-lg border border-input bg-background/60 px-2 text-sm" value={r.grade} onChange={(e) => updateRubric(r.id, { grade: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>Grade 1</option><option value={2}>Grade 2</option><option value={3}>Grade 3</option>
              </select>
              <button type="button" onClick={() => removeRubric(r.id)} className="size-9 rounded-lg hover:bg-destructive/10 text-destructive grid place-items-center">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ───────────────────────── Allopathy section ─────────────────────────
function AllopathySection({ value, onChange }: { value: AlloForm; onChange: (v: AlloForm) => void }) {
  const set = <K extends keyof AlloForm>(k: K, v: AlloForm[K]) => onChange({ ...value, [k]: v });
  const addMed = () => set("medicines", [...value.medicines, { id: `m-${Date.now()}`, name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const updateMed = (id: string, patch: Partial<Medicine>) => set("medicines", value.medicines.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMed = (id: string) => set("medicines", value.medicines.filter((m) => m.id !== id));

  return (
    <div className="space-y-4">
      <Field label="Chief complaint"><textarea className={ta} value={value.chief_complaint} onChange={(e) => set("chief_complaint", e.target.value)} /></Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={lab}>Medicines</span>
          <button type="button" onClick={addMed} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            <Plus className="size-3.5" /> Add medicine
          </button>
        </div>
        {value.medicines.length === 0 && <div className="text-xs text-muted-foreground">No medicines added.</div>}
        <ul className="space-y-2">
          {value.medicines.map((m) => (
            <li key={m.id} className="rounded-xl border border-border p-3 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 md:col-span-3"><label className={lab}>Name</label><input className={inp} value={m.name} onChange={(e) => updateMed(m.id, { name: e.target.value })} /></div>
              <div className="col-span-6 md:col-span-2"><label className={lab}>Dosage</label><input className={inp} value={m.dosage} onChange={(e) => updateMed(m.id, { dosage: e.target.value })} placeholder="500mg" /></div>
              <div className="col-span-6 md:col-span-2"><label className={lab}>Frequency</label><input className={inp} value={m.frequency} onChange={(e) => updateMed(m.id, { frequency: e.target.value })} placeholder="TDS" /></div>
              <div className="col-span-6 md:col-span-2"><label className={lab}>Duration</label><input className={inp} value={m.duration} onChange={(e) => updateMed(m.id, { duration: e.target.value })} placeholder="5 days" /></div>
              <div className="col-span-6 md:col-span-2"><label className={lab}>Instructions</label><input className={inp} value={m.instructions} onChange={(e) => updateMed(m.id, { instructions: e.target.value })} placeholder="After food" /></div>
              <div className="col-span-12 md:col-span-1 flex md:justify-end">
                <button type="button" onClick={() => removeMed(m.id)} className="size-9 rounded-lg hover:bg-destructive/10 text-destructive grid place-items-center"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Advice"><textarea className={ta} value={value.advice} onChange={(e) => set("advice", e.target.value)} /></Field>
        <Field label="Next visit date"><input type="date" className={inp} value={value.next_visit_date} onChange={(e) => set("next_visit_date", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lab}>{label}</label>
      {children}
    </div>
  );
}

// ───────────────────────── Billing modal ─────────────────────────
function BillingModal({ visitId, patientName, onClose }: { visitId: string; patientName: string; onClose: () => void }) {
  const [fee, setFee] = useState<string>("");
  const [mode, setMode] = useState<"CASH" | "UPI" | "CARD" | "ONLINE">("UPI");
  const [closing, setClosing] = useState(false);

  // Razorpay QR — generated dynamically from fee for the UPI option
  const qrSrc = useMemo(() => {
    const amount = Number(fee || 0);
    const upi = `upi://pay?pa=vedichomeopathic@razorpay&pn=${encodeURIComponent("Vedic Homeopathic Clinic")}&am=${amount}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(upi)}`;
  }, [fee]);

  const close = async () => {
    const amt = Number(fee);
    if (!amt || amt <= 0) return toast.error("Enter the fee amount");
    setClosing(true);
    try {
      await api.post(`/visits/${encodeURIComponent(visitId)}/close`, { fee: amt, payment_mode: mode });
      toast.success("Payment collected. Follow-ups scheduled.");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message ?? "Failed to close visit");
    } finally {
      setClosing(false);
    }
  };

  const modes: Array<{ k: typeof mode; label: string; icon: React.ReactNode }> = [
    { k: "CASH", label: "Cash", icon: <Banknote className="size-4" /> },
    { k: "UPI", label: "UPI / QR", icon: <Smartphone className="size-4" /> },
    { k: "CARD", label: "Card", icon: <CreditCard className="size-4" /> },
    { k: "ONLINE", label: "Online", icon: <Wifi className="size-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4" onClick={() => !closing && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg clinic-card p-6 bg-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Close visit</div>
            <h2 className="font-display text-2xl">Collect payment</h2>
            <div className="text-xs text-muted-foreground mt-0.5">{patientName} · <span className="font-mono">{visitId}</span></div>
          </div>
          <button onClick={onClose} className="size-9 rounded-full hover:bg-muted grid place-items-center"><X className="size-4" /></button>
        </div>

        <label className={lab}>Fee amount (₹)</label>
        <input autoFocus type="number" inputMode="numeric" placeholder="0" value={fee} onChange={(e) => setFee(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-card px-3 text-xl font-display focus:outline-none focus:ring-2 focus:ring-ring/40" />

        <div className={`${lab} mt-4`}>Payment mode</div>
        <div className="grid grid-cols-2 gap-2">
          {modes.map((m) => (
            <button key={m.k} type="button" onClick={() => setMode(m.k)}
              className={`h-11 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-2 transition ${mode === m.k ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-muted"}`}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {mode === "UPI" && Number(fee) > 0 && (
          <div className="mt-4 rounded-xl border border-border p-4 bg-muted/30 flex items-center gap-4">
            <img src={qrSrc} alt="Razorpay UPI QR" width={120} height={120} className="rounded-md bg-white p-1 border border-border" />
            <div className="text-xs">
              <div className="inline-flex items-center gap-1.5 text-primary font-semibold"><QrCode className="size-3.5" /> Scan to pay ₹{Number(fee).toLocaleString("en-IN")}</div>
              <div className="text-muted-foreground mt-1">Patient scans with any UPI app. Once paid, click the button below.</div>
            </div>
          </div>
        )}

        <button onClick={close} disabled={closing} className="mt-5 w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {closing && <Loader2 className="size-4 animate-spin" />}
          {closing ? "Closing visit…" : "Close visit & collect payment"}
        </button>
        <div className="text-[11px] text-muted-foreground text-center mt-2">
          3-day, 7-day &amp; 15-day follow-ups will be scheduled automatically.
        </div>
      </div>
    </div>
  );
}

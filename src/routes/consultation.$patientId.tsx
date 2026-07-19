import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, X,
  Sparkles, RotateCw, Zap, Plus, Save, GripVertical, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

// ---------- Custom parameters (local-only, no backend) ----------
type CustomFieldKind = "text" | "textarea" | "number" | "dropdown";
type CustomField = {
  id: string;
  label: string;
  kind: CustomFieldKind;
  options?: string[]; // for dropdown
};
const CUSTOM_PARAMS_KEY = "vennova:consultation:custom-params:v1";
const TIMING_PRESETS = ["OD", "BD", "TDS", "QID", "SOS", "HS", "Weekly", "Monthly"];
const draftKey = (patientId: string) => `vennova:consultation:draft:${patientId}:v1`;

type ConsultationSearch = {
  queue_id?: string;
  visit_type?: string;
  mode?: "new" | "followup";
};

export const Route = createFileRoute("/consultation/$patientId")({
  validateSearch: (s: Record<string, unknown>): ConsultationSearch => ({
    queue_id: typeof s.queue_id === "string" ? s.queue_id : undefined,
    visit_type: typeof s.visit_type === "string" ? s.visit_type : undefined,
    mode: s.mode === "new" || s.mode === "followup" ? s.mode : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Consultation — Vennova Clinic" },
      { name: "description", content: "Doctor consultation case paper." },
    ],
  }),
  component: ConsultationPage,
});

// ---------- Helpers ----------
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
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function pickId(o: unknown): string | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  for (const k of ["visit_id", "id", "ID"]) {
    const v = r[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "visits"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

type Patient = {
  id: string;
  reg_no?: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_mobile?: string;
  city?: string;
  patient_type?: string;
  total_visits?: number;
  last_visit?: string | null;
  [k: string]: unknown;
};

type BackendMedicine = {
  name?: string;
  potency?: string;
  timing?: string;
  days?: string | number;
  food_relation?: string;
  notes?: string;
  // Legacy fallbacks
  dosage?: string;
  frequency?: string;
  duration?: string | number;
};

type BackendVitals = {
  bp_systolic?: number | string;
  bp_diastolic?: number | string;
  pulse_rate?: number | string;
  weight_kg?: number | string;
  temperature?: number | string;
};

type LastVisit = {
  id?: string;
  visit_id?: string;
  visit_date?: string;
  created_at?: string;
  chief_complaint?: string;
  diagnosis?: string;
  notes?: string;
  advice?: string;
  fee?: number | string;
  followup_date?: string;
  followup_type?: string;
  homeopathy?: {
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
    mind_symptoms?: string;
    particulars?: { text?: string } | string;
    rubrics?: Array<{ text?: string } | string>;
    patient_rx?: string;
    remedy?: string;
    potency?: string;
    repetition?: string;
    miasm?: string;
    advice?: string;
  };
  medicines?: BackendMedicine[];
  vitals?: BackendVitals;
  [k: string]: unknown;
};


function displayName(p?: Patient | null): string {
  if (!p) return "";
  if (p.full_name) return p.full_name;
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "";
}
function displayPhone(p?: Patient | null): string {
  if (!p) return "";
  return (p.phone || p.phone_mobile || "") as string;
}
function regFmt(p?: Patient | null): string {
  if (!p?.reg_no) return "—";
  return `VNC-${String(p.reg_no).padStart(4, "0")}`;
}
function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------- Form ----------
type Medicine = { name: string; dosage: string; frequency: string; duration: string };
const POTENCIES = ["6C", "30C", "200C", "1M", "10M", "CM", "50M"];
const MIASMS = ["Psora", "Sycosis", "Syphilis", "Tubercular"];
const THERMALS = ["Hot", "Cold", "Mixed"];

type FormState = {
  chief_complaint: string;
  bp_sys: string; bp_dia: string; weight: string; temperature: string; pulse: string;
  history_present: string; history_past: string; history_surgical: string; history_family: string;
  thermal: string; appetite: string; thirst: string; sleep: string; dreams: string; mind_symptoms: string;
  particulars: string; rubrics: string[]; rubricInput: string;
  remedy: string; potency: string; repetition: string; miasm: string;
  diagnosis: string; medicines: Medicine[]; advice: string;
  fee: string;
};

const initialForm = (): FormState => ({
  chief_complaint: "",
  bp_sys: "", bp_dia: "", weight: "", temperature: "", pulse: "",
  history_present: "", history_past: "", history_surgical: "", history_family: "",
  thermal: "", appetite: "", thirst: "", sleep: "", dreams: "", mind_symptoms: "",
  particulars: "", rubrics: [], rubricInput: "",
  remedy: "", potency: "", repetition: "", miasm: "",
  diagnosis: "", medicines: [{ name: "", dosage: "", frequency: "", duration: "" }], advice: "",
  fee: "500",
});

// ---------- Page ----------
function ConsultationPage() {
  const { patientId } = Route.useParams();
  const search = useSearch({ from: "/consultation/$patientId" });
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const patientQ = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.get<Patient>(`/patients/${encodeURIComponent(patientId)}`),
    retry: 1,
  });

  const explicitMode = search.mode;
  const lastVisitQ = useQuery({
    queryKey: ["last-visit", patientId],
    queryFn: async () => {
      // Get the most recent visit summary…
      const raw = await api.get<unknown>(`/visits/patient/${encodeURIComponent(patientId)}`, { query: { limit: 1 } });
      const arr = asArray<LastVisit>(raw);
      const head = arr.length > 0 ? arr[0] : null;
      if (!head) return null;
      // …then fetch the full detail so nested homeopathy / medicines / vitals
      // fields are guaranteed to be present regardless of what the list
      // endpoint chooses to include.
      const id = head.id || head.visit_id;
      if (!id) return head;
      try {
        const full = await api.get<LastVisit>(`/visits/${encodeURIComponent(id)}`);
        return { ...head, ...full } as LastVisit;
      } catch {
        return head;
      }
    },
    retry: 1,
    enabled: explicitMode !== "new",
  });

  // Guard: if patient has no ACTIVE queue row (WAITING/IN_TREATMENT), redirect
  // to the read-only Patient Workspace. Consultation editor is for active visits only.
  useEffect(() => {
    if (!search.queue_id && explicitMode !== "new") {
      // No queue context AND not a fresh new-case session → workspace
      navigate({ to: "/patients/$patientId/workspace", params: { patientId }, replace: true });
    }
  }, [search.queue_id, explicitMode, patientId, navigate]);

  const patient = patientQ.data;
  const lastVisit = lastVisitQ.data ?? null;
  const isFollowup = explicitMode ? explicitMode === "followup" : !!lastVisit;

  // Backend VisitType enum ONLY accepts: HOMEOPATHY | ALLOPATHY | AYURVEDIC.
  // Queue rows carry their own non-medical visit_type values (WALKIN /
  // APPOINTMENT / WAITING / IN_TREATMENT / BOOKED) — those MUST NEVER reach
  // POST /visits. We always coerce to a valid medical enum here.
  const ALLOWED_VISIT_TYPES = ["HOMEOPATHY", "ALLOPATHY", "AYURVEDIC"] as const;
  const rawVisitType = (
    search.visit_type ||
    (patient?.patient_type as string | undefined) ||
    "HOMEOPATHY"
  ).toUpperCase();
  const visitType = (ALLOWED_VISIT_TYPES as readonly string[]).includes(rawVisitType)
    ? rawVisitType
    : "HOMEOPATHY";
  const isAllo = visitType === "ALLOPATHY";

  // FIX 3: ALWAYS start from a fresh blank form. Keyed on patientId + mode so
  // navigating from one patient to another (or new vs followup) wipes state.
  const [form, setForm] = useState<FormState>(() => initialForm());
  const [chiefError, setChiefError] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    setForm(initialForm());
    setPrefilled(false);
    setChiefError(false);
  }, [patientId, explicitMode]);

  // Pre-fill from last visit — ONLY when this is explicitly a follow-up (or
  // the patient has prior history and we haven't been told this is a new case).
  // Restore EVERY field the backend has. Do NOT clobber a value the user has
  // already typed: only overwrite when the current form field is still empty.
  useEffect(() => {
    if (explicitMode === "new") return; // never prefill on a fresh new case
    if (!lastVisit || prefilled) return;

    const homeo = lastVisit.homeopathy || {};
    const vit = lastVisit.vitals || {};
    const rubrics = Array.isArray(homeo.rubrics)
      ? homeo.rubrics.map((r) => (typeof r === "string" ? r : r?.text || "")).filter(Boolean)
      : [];
    const particularsStr =
      typeof homeo.particulars === "string"
        ? homeo.particulars
        : (homeo.particulars && typeof homeo.particulars === "object" && homeo.particulars.text) || "";

    const meds: Medicine[] = Array.isArray(lastVisit.medicines) && lastVisit.medicines.length > 0
      ? lastVisit.medicines.map((m) => ({
          name: (m.name || "").toString(),
          dosage: (m.potency ?? m.dosage ?? "").toString(),
          frequency: (m.timing ?? m.frequency ?? "").toString(),
          duration: (m.days ?? m.duration ?? "").toString(),
        }))
      : [];

    const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
    const keep = (cur: string, next: string) => (cur && cur.trim() ? cur : next);

    setForm((f) => ({
      ...f,
      chief_complaint: keep(f.chief_complaint, s(lastVisit.chief_complaint || homeo.chief_complaint)),
      diagnosis:       keep(f.diagnosis,       s(lastVisit.diagnosis || homeo.diagnosis)),
      fee:             keep(f.fee,             s(lastVisit.fee ?? "")) || f.fee,
      // History
      history_present:  keep(f.history_present,  s(homeo.history_present)),
      history_past:     keep(f.history_past,     s(homeo.history_past)),
      history_surgical: keep(f.history_surgical, s(homeo.history_surgical)),
      history_family:   keep(f.history_family,   s(homeo.history_family)),
      // Generals
      thermal:      keep(f.thermal,      s(homeo.thermal_sensation)),
      appetite:     keep(f.appetite,     s(homeo.appetite)),
      thirst:       keep(f.thirst,       s(homeo.thirst)),
      sleep:        keep(f.sleep,        s(homeo.sleep)),
      dreams:       keep(f.dreams,       s(homeo.dreams)),
      mind_symptoms: keep(f.mind_symptoms, s(homeo.mind_symptoms)),
      // Particulars & rubrics
      particulars:  keep(f.particulars,  s(particularsStr)),
      rubrics:      f.rubrics.length > 0 ? f.rubrics : rubrics,
      // Analysis
      remedy:     keep(f.remedy,     s(homeo.remedy)),
      potency:    keep(f.potency,    s(homeo.potency)),
      repetition: keep(f.repetition, s(homeo.repetition)),
      miasm:      keep(f.miasm,      s(homeo.miasm)),
      // Notes / advice
      advice: keep(f.advice, s(lastVisit.advice || homeo.advice || lastVisit.notes)),
      // Medicines
      medicines: f.medicines.some((m) => m.name.trim()) || meds.length === 0 ? f.medicines : meds,
      // Vitals
      bp_sys:      keep(f.bp_sys,      s(vit.bp_systolic)),
      bp_dia:      keep(f.bp_dia,      s(vit.bp_diastolic)),
      pulse:       keep(f.pulse,       s(vit.pulse_rate)),
      weight:      keep(f.weight,      s(vit.weight_kg)),
      temperature: keep(f.temperature, s(vit.temperature)),
    }));
    setPrefilled(true);
  }, [lastVisit, prefilled, explicitMode]);


  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [open, setOpen] = useState({ vitals: true, history: false, generals: false, particulars: false, remedy: true });

  const [submitting, setSubmitting] = useState(false);

  // ---- Custom parameters (local-only) ----
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(CUSTOM_PARAMS_KEY);
      return raw ? (JSON.parse(raw) as CustomField[]) : [];
    } catch { return []; }
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  useEffect(() => {
    try { window.localStorage.setItem(CUSTOM_PARAMS_KEY, JSON.stringify(customFields)); } catch { /* noop */ }
  }, [customFields]);

  const [paramDialogOpen, setParamDialogOpen] = useState(false);
  const [newParam, setNewParam] = useState<{ label: string; kind: CustomFieldKind; options: string }>({
    label: "", kind: "text", options: "",
  });
  const addCustomField = () => {
    const label = newParam.label.trim();
    if (!label) { toast.error("Parameter name is required"); return; }
    const field: CustomField = {
      id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label,
      kind: newParam.kind,
      options: newParam.kind === "dropdown"
        ? newParam.options.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    };
    if (field.kind === "dropdown" && (!field.options || field.options.length === 0)) {
      toast.error("Add at least one dropdown option (comma-separated)");
      return;
    }
    setCustomFields((arr) => [...arr, field]);
    setNewParam({ label: "", kind: "text", options: "" });
    setParamDialogOpen(false);
    toast.success(`Added "${label}"`);
  };
  const removeCustomField = (id: string) => {
    setCustomFields((arr) => arr.filter((f) => f.id !== id));
    setCustomValues((v) => { const c = { ...v }; delete c[id]; return c; });
  };
  const [dragId, setDragId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (overId: string) => {
    if (!dragId || dragId === overId) return;
    setCustomFields((arr) => {
      const from = arr.findIndex((f) => f.id === dragId);
      const to = arr.findIndex((f) => f.id === overId);
      if (from < 0 || to < 0) return arr;
      const next = arr.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
    setDragId(null);
  };

  // ---- Draft (local-only) ----
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    if (draftRestored || explicitMode === "new") return;
    try {
      const raw = window.localStorage.getItem(draftKey(patientId));
      if (!raw) return;
      const d = JSON.parse(raw) as { form?: Partial<FormState>; customValues?: Record<string, string> };
      if (d.form) setForm((f) => ({ ...f, ...d.form }));
      if (d.customValues) setCustomValues(d.customValues);
      setDraftRestored(true);
      toast.message("Draft restored", { description: "Continuing your saved consultation" });
    } catch { /* noop */ }
  }, [patientId, explicitMode, draftRestored]);

  const saveDraft = () => {
    try {
      window.localStorage.setItem(
        draftKey(patientId),
        JSON.stringify({ form, customValues, savedAt: new Date().toISOString() }),
      );
      toast.success("Draft saved locally");
    } catch (e) {
      toast.error("Could not save draft", { description: errMsg(e) });
    }
  };
  const clearDraft = () => {
    try { window.localStorage.removeItem(draftKey(patientId)); } catch { /* noop */ }
  };

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

  const markCaseDone = async () => {
    if (submitting) return; // prevent double-submit
    if (!form.chief_complaint.trim()) {
      setChiefError(true);
      toast.error("Chief complaint is required");
      return;
    }
    setChiefError(false);
    setSubmitting(true);

    const toastId = toast.loading("Creating visit…");
    let stage: "visit" | "vitals" | "homeopathy" = "visit";
    try {
      if (!user?.id) {
        throw new Error("Not signed in. Please log in again.");
      }

      // ---- 1) Create visit. Backend VisitCreate schema (required):
      //   patient_id, doctor_id, type   (+ optional chief_complaint, notes)
      // doctor_id is derived from the signed-in Supabase user (auth.users.id);
      // backend resolves the clinic via the bearer.
      const doctorId = profile?.id || user.id;
      if (!doctorId) {
        throw new Error("Doctor profile not loaded. Please sign in again.");
      }
      const visitPayload = {
        patient_id: patientId,
        doctor_id: doctorId,
        type: visitType || "HOMEOPATHY",
        chief_complaint: form.chief_complaint.trim(),
        fee: Number(form.fee) || 0,
      };
      console.log("VISIT PAYLOAD", visitPayload);


      const visitRes = await api.post<unknown>("/visits/", visitPayload, {
        timeoutMs: 30000,
      });
      console.log("[consultation] VISIT RESPONSE", visitRes);
      const visitId = pickId(visitRes);
      if (!visitId) throw new Error("Visit ID missing in backend response");

      // ---- 2) Vitals (only when at least one field is filled; non-fatal).
      if (anyVitals) {
        stage = "vitals";
        toast.loading("Saving vitals…", { id: toastId });
        try {
          const vitalsPayload: Record<string, number> = {};
          const w = numOrNull(form.weight);
          const bs = numOrNull(form.bp_sys);
          const bd = numOrNull(form.bp_dia);
          const t = numOrNull(form.temperature);
          const p = numOrNull(form.pulse);
          if (w !== null) vitalsPayload.weight_kg = w;
          if (bs !== null) vitalsPayload.bp_systolic = bs;
          if (bd !== null) vitalsPayload.bp_diastolic = bd;
          if (t !== null) vitalsPayload.temperature = t;
          if (p !== null) vitalsPayload.pulse_rate = p;
          console.log("[consultation] VITALS PAYLOAD", vitalsPayload);
          await api.post(
            `/visits/${encodeURIComponent(visitId)}/vitals`,
            vitalsPayload,
            { timeoutMs: 20000 },
          );
        } catch (e) {
          console.warn("[consultation] vitals save non-fatal:", e);
          toast.message("Vitals could not be saved — continuing", {
            description: errMsg(e),
          });
        }
      }

      // ---- 3) Homeopathy case — strictly the backend HomeopathyCaseCreate
      // schema. No `analysis`, no `advice` (those don't exist server-side).
      stage = "homeopathy";
      toast.loading("Saving case…", { id: toastId });
      const homeoPayload: Record<string, unknown> = {
        chief_complaint: form.chief_complaint.trim(),
      };
      const setIf = (k: string, v: string) => {
        const s = v.trim();
        if (s) homeoPayload[k] = s;
      };
      setIf("history_present", form.history_present);
      setIf("history_past", form.history_past);
      setIf("history_surgical", form.history_surgical);
      setIf("history_family", form.history_family);
      setIf("thermal_sensation", form.thermal);
      setIf("appetite", form.appetite);
      setIf("thirst", form.thirst);
      setIf("sleep", form.sleep);
      setIf("dreams", form.dreams);
      setIf("mind_symptoms", form.mind_symptoms);
      setIf("remedy", form.remedy);
      setIf("potency", form.potency);
      setIf("repetition", form.repetition);
      setIf("miasm", form.miasm);
      if (form.particulars.trim()) {
        homeoPayload.particulars = { text: form.particulars.trim() };
      }
      if (form.rubrics.length > 0) {
        homeoPayload.rubrics = form.rubrics.map((r) => ({ text: r, grade: 1 }));
      }
      console.log("[consultation] HOMEOPATHY PAYLOAD", homeoPayload);
      await api.post(
        `/visits/${encodeURIComponent(visitId)}/homeopathy`,
        homeoPayload,
        { timeoutMs: 30000 },
      );

      clearDraft();
      toast.success("Consultation saved", { id: toastId });
      navigate({
        to: "/prescription/$visitId",
        params: { visitId },
        search: { patient_id: patientId, queue_id: search.queue_id },
      });
    } catch (e) {
      console.error(`CONSULTATION_SAVE_ERROR [stage=${stage}]`, e);
      const stageLabel =
        stage === "visit" ? "Visit save failed"
        : stage === "vitals" ? "Vitals save failed"
        : "Case save failed";
      toast.error(`${stageLabel}: ${errMsg(e) || "Unknown error"}`, { id: toastId });
      return;
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render ----------
  if (patientQ.isLoading || lastVisitQ.isLoading) {
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
          <Link to="/doctor/queue" className="text-primary text-sm hover:underline">← Back to queue</Link>
        </div>
      </div>
    );
  }

  const ptype = (patient.patient_type || visitType).toUpperCase();
  const typeBadgeClass =
    ptype === "ALLOPATHY"
      ? "bg-blue-100 text-blue-800 border-blue-300"
      : "bg-teal-100 text-teal-800 border-teal-300";

  return (
    <div className="max-w-[1500px] mx-auto pb-28">
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT SIDEBAR */}
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5 sticky top-4">
            <div className="size-12 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 grid place-items-center text-white font-display text-xl mb-3 shadow">
              <Zap className="size-6" />
            </div>
            <div className="font-display text-xl leading-tight">{displayName(patient)}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono">{regFmt(patient)}</div>
            <div className="text-sm text-muted-foreground mt-2 whitespace-nowrap tabular-nums break-keep">{displayPhone(patient) || "—"}</div>
            {patient.city && <div className="text-xs text-muted-foreground mt-0.5">{patient.city}</div>}
            <span className={`mt-3 inline-flex text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${typeBadgeClass}`}>
              {ptype}
            </span>
            <div className="mt-4 space-y-2">
              <div className="rounded-lg border border-border p-2 text-center">
                <div className="font-display text-lg tabular-nums">{patient.total_visits ?? 0}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Visits</div>
              </div>
              <div className="rounded-lg border border-border p-2 text-center">
                <div className="text-xs tabular-nums">
                  {patient.last_visit ? fmtDate(patient.last_visit) : "New Patient"}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Last visit</div>
              </div>
            </div>
            <button
              onClick={() => navigate({ to: "/doctor/queue" })}
              className="mt-4 w-full h-9 rounded-full border border-border text-sm hover:bg-muted inline-flex items-center justify-center gap-1"
            >
              <ArrowLeft className="size-4" /> Back to Queue
            </button>
          </div>
        </aside>

        {/* CENTER */}
        <section className="col-span-12 lg:col-span-6 xl:col-span-7 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {isFollowup ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                <RotateCw className="size-3.5" /> Follow-up
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Sparkles className="size-3.5" /> New Patient
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5" onClick={saveDraft}>
                <Save className="size-3.5" /> Save Draft
              </Button>
              {lastVisit?.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1.5"
                  onClick={() => navigate({ to: "/consultation/edit/$visitId", params: { visitId: lastVisit.id as string } })}
                >
                  <Pencil className="size-3.5" /> Edit Consultation
                </Button>
              )}
            </div>
          </div>
          <div className="font-display text-2xl">{isAllo ? "Allopathy Case Paper" : "Homeopathy Case Paper"}</div>

          {/* Chief complaint */}
          <Block title={<>Chief Complaint <span className="text-destructive">*</span></>}>
            <textarea
              value={form.chief_complaint}
              onChange={(e) => { setField("chief_complaint", e.target.value); if (chiefError) setChiefError(false); }}
              rows={3}
              required
              placeholder="Describe the chief complaint..."
              className={`w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${
                chiefError ? "border-destructive ring-2 ring-destructive/30" : "border-border"
              }`}
            />
            {chiefError && (
              <div className="text-xs text-destructive mt-1">Chief complaint is required</div>
            )}
          </Block>

          {/* Vitals */}
          <Collapsible
            title="Vitals"
            open={open.vitals}
            onToggle={() => setOpen((o) => ({ ...o, vitals: !o.vitals }))}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="BP Systolic" value={form.bp_sys} onChange={(v) => setField("bp_sys", v)} type="number" />
              <Field label="BP Diastolic" value={form.bp_dia} onChange={(v) => setField("bp_dia", v)} type="number" />
              <Field label="Pulse Rate" value={form.pulse} onChange={(v) => setField("pulse", v)} type="number" />
              <Field label="Weight (kg)" value={form.weight} onChange={(v) => setField("weight", v)} type="number" />
              <Field label="Temperature (°F)" value={form.temperature} onChange={(v) => setField("temperature", v)} type="number" />
            </div>
          </Collapsible>

          {!isAllo && (
            <>
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

              <Collapsible
                title="Generals"
                open={open.generals}
                onToggle={() => setOpen((o) => ({ ...o, generals: !o.generals }))}
              >
                <div className="mb-3">
                  <Label>Thermal</Label>
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

              <Collapsible
                title="Particulars & Rubrics"
                open={open.particulars}
                onToggle={() => setOpen((o) => ({ ...o, particulars: !o.particulars }))}
              >
                <TextArea label="Particulars" rows={3} value={form.particulars} onChange={(v) => setField("particulars", v)} />
                <div className="mt-3">
                  <Label>Rubrics</Label>
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
                      placeholder="Type a rubric and press Enter…"
                      className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    <Button type="button" variant="outline" className="rounded-lg" onClick={addRubric}>Add</Button>
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

              <Collapsible
                title="Analysis & Notes"
                open={open.remedy}
                onToggle={() => setOpen((o) => ({ ...o, remedy: !o.remedy }))}
              >
                <div className="mt-1">
                  <Label>Miasm</Label>
                  <Pills options={MIASMS} value={form.miasm} onChange={(v) => setField("miasm", v)} />
                </div>
              </Collapsible>
            </>
          )}

          {isAllo && (
            <Block title="Diagnosis & Notes">
              <Field label="Diagnosis" value={form.diagnosis} onChange={(v) => setField("diagnosis", v)} />
              <div className="mt-3">
                <TextArea label="Notes" rows={3} value={form.advice} onChange={(v) => setField("advice", v)} />
              </div>
            </Block>
          )}

          {/* Medicines (free-form list — saved with the prescription) */}
          <Block title="Medicines">
            <div className="space-y-3">
              {form.medicines.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-4">
                    <Label>Name</Label>
                    <input
                      value={m.name}
                      onChange={(e) => setMedicine(i, "name", e.target.value)}
                      placeholder="e.g. Pulsatilla / Paracetamol"
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label>Dosage</Label>
                    <input
                      value={m.dosage}
                      onChange={(e) => setMedicine(i, "dosage", e.target.value)}
                      placeholder="30C / 500mg"
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label>Timing</Label>
                    <input
                      value={m.frequency}
                      onChange={(e) => setMedicine(i, "frequency", e.target.value)}
                      placeholder="BD / TDS or custom"
                      list="vennova-timing-presets"
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <Label>Days</Label>
                    <input
                      type="number"
                      min={0}
                      value={m.duration}
                      onChange={(e) => setMedicine(i, "duration", e.target.value)}
                      placeholder="7"
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2 flex justify-end">
                    {form.medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicine(i)}
                        className="size-9 grid place-items-center rounded-lg border border-border hover:bg-muted text-destructive"
                        aria-label="Remove medicine"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="rounded-full" onClick={addMedicine}>
                + Add medicine
              </Button>
              <div className="text-xs text-muted-foreground">
                Detailed BOX-style prescription is finalized on the next screen.
              </div>
            </div>
          </Block>

          {/* Datalist of timing presets — shared by all medicine rows */}
          <datalist id="vennova-timing-presets">
            {TIMING_PRESETS.map((t) => <option key={t} value={t} />)}
          </datalist>

          {/* Custom parameters (local-only) */}
          <Block
            title={
              <div className="flex items-center justify-between gap-2">
                <span>Additional Parameters</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1.5"
                  onClick={() => setParamDialogOpen(true)}
                >
                  <Plus className="size-3.5" /> Add Parameter
                </Button>
              </div>
            }
          >
            {customFields.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No custom parameters yet. Add fields like Sleep, Appetite, Tongue, Modalities, etc.
              </div>
            ) : (
              <div className="space-y-3">
                {customFields.map((cf) => (
                  <div
                    key={cf.id}
                    draggable
                    onDragStart={() => onDragStart(cf.id)}
                    onDragOver={onDragOver}
                    onDrop={() => onDrop(cf.id)}
                    className="grid grid-cols-12 gap-2 items-start rounded-lg border border-border bg-background/40 p-2"
                  >
                    <div className="col-span-1 flex items-center justify-center pt-2 text-muted-foreground cursor-grab">
                      <GripVertical className="size-4" />
                    </div>
                    <div className="col-span-10">
                      <Label>{cf.label}</Label>
                      {cf.kind === "textarea" ? (
                        <textarea
                          rows={3}
                          value={customValues[cf.id] || ""}
                          onChange={(e) => setCustomValues((v) => ({ ...v, [cf.id]: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      ) : cf.kind === "dropdown" ? (
                        <select
                          value={customValues[cf.id] || ""}
                          onChange={(e) => setCustomValues((v) => ({ ...v, [cf.id]: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                        >
                          <option value="">— Select —</option>
                          {(cf.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={cf.kind === "number" ? "number" : "text"}
                          value={customValues[cf.id] || ""}
                          onChange={(e) => setCustomValues((v) => ({ ...v, [cf.id]: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      )}
                    </div>
                    <div className="col-span-1 flex items-start justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => removeCustomField(cf.id)}
                        className="size-8 grid place-items-center rounded-lg border border-border hover:bg-muted text-destructive"
                        aria-label={`Remove ${cf.label}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">
                  Drag the handle to reorder. Custom parameters and values are saved on this device only.
                </div>
              </div>
            )}
          </Block>

          {/* Add-parameter dialog */}
          {paramDialogOpen && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setParamDialogOpen(false)}>
              <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-display text-lg">Add Parameter</div>
                  <button onClick={() => setParamDialogOpen(false)} className="size-8 grid place-items-center rounded-lg hover:bg-muted" aria-label="Close">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Parameter name</Label>
                    <input
                      autoFocus
                      value={newParam.label}
                      onChange={(e) => setNewParam((p) => ({ ...p, label: e.target.value }))}
                      placeholder="e.g. Sleep, Appetite, Tongue, Modalities"
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    />
                  </div>
                  <div>
                    <Label>Field type</Label>
                    <select
                      value={newParam.kind}
                      onChange={(e) => setNewParam((p) => ({ ...p, kind: e.target.value as CustomFieldKind }))}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      <option value="text">Text (single line)</option>
                      <option value="textarea">Textarea (multi-line)</option>
                      <option value="number">Number</option>
                      <option value="dropdown">Dropdown</option>
                    </select>
                  </div>
                  {newParam.kind === "dropdown" && (
                    <div>
                      <Label>Options (comma-separated)</Label>
                      <input
                        value={newParam.options}
                        onChange={(e) => setNewParam((p) => ({ ...p, options: e.target.value }))}
                        placeholder="Hot, Cold, Mixed"
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setParamDialogOpen(false)}>Cancel</Button>
                  <Button type="button" onClick={addCustomField}>Add</Button>
                </div>
              </div>
            </div>
          )}

          {/* Consultation fee — receptionist will choose payment mode later */}
          <Block title="Consultation Fee">
            <div className="max-w-xs">
              <Label>Fee (₹)</Label>
              <input
                type="number" min={0} value={form.fee} onChange={(e) => setField("fee", e.target.value)}
                className="w-full h-12 rounded-lg border border-border bg-background px-3 text-lg font-display tabular-nums outline-none focus:ring-2 focus:ring-ring/40"
              />
              <div className="text-xs text-muted-foreground mt-1.5">
                Payment mode is selected by reception at billing.
              </div>
            </div>
          </Block>

          {/* Desktop submit */}
          <div className="hidden md:flex justify-end pt-2">
            <button
              disabled={submitting}
              onClick={markCaseDone}
              className="h-12 px-8 rounded-full bg-teal-600 text-white font-medium text-sm inline-flex items-center gap-2 hover:bg-teal-700 disabled:opacity-60 shadow-lg"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Mark Case Done →
            </button>
          </div>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="col-span-12 lg:col-span-3 hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-5 sticky top-4">
            {isFollowup && lastVisit ? (
              <>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Previous Visit</div>
                <div className="text-sm font-medium">{fmtDate(lastVisit.visit_date || lastVisit.created_at)}</div>
                <div className="mt-3 space-y-2 text-sm">
                  {lastVisit.homeopathy?.remedy && (
                    <div>
                      <span className="text-muted-foreground">Remedy: </span>
                      <span className="font-medium">
                        {lastVisit.homeopathy.remedy}
                        {lastVisit.homeopathy.potency ? ` ${lastVisit.homeopathy.potency}` : ""}
                      </span>
                    </div>
                  )}
                  {lastVisit.chief_complaint && (
                    <div>
                      <div className="text-muted-foreground text-xs">Complaint</div>
                      <div className="text-sm">{lastVisit.chief_complaint}</div>
                    </div>
                  )}
                  {Array.isArray(lastVisit.homeopathy?.rubrics) && lastVisit.homeopathy!.rubrics!.length > 0 && (
                    <div>
                      <div className="text-muted-foreground text-xs">Rubrics</div>
                      <div className="text-sm">
                        {lastVisit
                          .homeopathy!.rubrics!.map((r) => (typeof r === "string" ? r : r?.text || ""))
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Previous Visit</div>
                <div className="text-sm text-muted-foreground">No previous visits</div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="px-4 py-3 flex items-center gap-3 justify-end">
          <button
            disabled={submitting}
            onClick={markCaseDone}
            className="w-full h-12 rounded-full bg-teal-600 text-white font-medium text-sm inline-flex items-center justify-center gap-2 hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Mark Case Done →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{children}</div>;
}

function Block({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
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

function TextArea({
  label, value, onChange, rows = 4,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <Label>{label}</Label>
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

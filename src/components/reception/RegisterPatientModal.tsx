import { useState } from "react";
import { X, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { queueActions } from "@/lib/queue-store";
import { api, ApiError } from "@/lib/api-client";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRegistered?: (p: { id: string; full_name: string; reg_no: string; phone: string }) => void;
};

const T =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 w-full";
const L = "text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block";
const Section = "mt-5 mb-2 text-[11px] uppercase tracking-widest text-primary/80 font-semibold";

type FormState = {
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  dob: string;
  age: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "";
  marital_status: "SINGLE" | "MARRIED" | "OTHER" | "";
  anniversary: string;
  res_address: string;
  res_city: string;
  res_state: string;
  res_postal: string;
  phone_mobile: string;
  phone_res: string;
  email: string;
  referred_by_name: string;
  referred_by_contact: string;
  language_pref: string;

};

const empty: FormState = {
  title: "Mr",
  first_name: "",
  middle_name: "",
  last_name: "",
  dob: "",
  age: "",
  gender: "",
  marital_status: "",
  anniversary: "",
  res_address: "",
  res_city: "",
  res_state: "",
  res_postal: "",
  phone_mobile: "",
  phone_res: "",
  email: "",
  referred_by_name: "",
  referred_by_contact: "",
  language_pref: "English",

};

export function RegisterPatientModal({ open, onOpenChange, onRegistered }: Props) {
  const [f, setF] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [dupe, setDupe] = useState<null | { patient: any; payload: any; fullName: string }>(null);

  if (!open) return null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const reset = () => setF(empty);

  const doCreate = async (payload: any, fullName: string) => {
    setSaving(true);
    try {
      const created = await api.post<{ id?: string; reg_no?: string | number }>("/patients", payload);
      if (!created?.id) {
        toast.error("Patient created but no id returned");
        return;
      }
      const reg_no = created.reg_no != null ? String(created.reg_no) : "";
      queueActions.createPatient(created.id, reg_no, fullName, f.phone_mobile.trim(), {
        city: f.res_city,
        patient_type: "HOMEOPATHY",
        age: f.age ? Number(f.age) : undefined,
        gender: (f.gender || undefined) as any,
        dob: f.dob || undefined,
        email: f.email || undefined,
        address: f.res_address || undefined,
      });
      toast.success(`Patient ${reg_no || created.id} registered`);
      onRegistered?.({ id: created.id, full_name: fullName, reg_no, phone: f.phone_mobile.trim() });
      onOpenChange(false);
      reset();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to register patient";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.first_name.trim()) return toast.error("First name is required");
    {
      const raw = f.phone_mobile.trim();
      const digits = raw.replace(/[^\d]/g, "");
      if (!/^[+\d\s-]{6,20}$/.test(raw) || digits.length < 6 || digits.length > 15) {
        return toast.error("Enter a valid mobile number (6–15 digits, +, spaces allowed)");
      }
    }

    const fullName = [f.title, f.first_name, f.middle_name, f.last_name]
      .map((s) => s.trim()).filter(Boolean).join(" ");

    const payload = {
      title: f.title || null,
      first_name: f.first_name.trim(),
      middle_name: f.middle_name.trim() || null,
      last_name: f.last_name.trim() || null,
      dob: f.dob || null,
      age: f.age ? Number(f.age) : null,
      gender: f.gender || null,
      marital_status: f.marital_status || null,
      anniversary: f.anniversary || null,
      res_address: f.res_address || null,
      res_city: f.res_city || null,
      res_state: f.res_state || null,
      res_postal: f.res_postal || null,
      phone_mobile: f.phone_mobile.trim(),
      phone_res: f.phone_res.trim() || null,
      email: f.email.trim() || null,
      referred_by_name: f.referred_by_name.trim() || null,
      referred_by_contact: f.referred_by_contact.trim() || null,
      language_pref: f.language_pref || null,
      patient_type: "HOMEOPATHY",

    };

    // Duplicate phone check before creation.
    setSaving(true);
    try {
      const phone = f.phone_mobile.trim();
      const digits = phone.replace(/[^\d]/g, "");
      const raw = await api.get<unknown>("/patients", { query: { search: phone } });
      const arr: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.items) ? (raw as any).items
        : Array.isArray((raw as any)?.data) ? (raw as any).data
        : Array.isArray((raw as any)?.patients) ? (raw as any).patients
        : [];
      const match = arr.find((p) => {
        const pd = String(p?.phone_mobile || p?.phone_res || "").replace(/[^\d]/g, "");
        return pd && (pd === digits || pd.endsWith(digits) || digits.endsWith(pd));
      });
      if (match) {
        setSaving(false);
        setDupe({ patient: match, payload, fullName });
        return;
      }
    } catch {
      // Non-blocking: if lookup fails, fall through to create.
    }
    setSaving(false);
    await doCreate(payload, fullName);
  };


  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4"
      onClick={() => !saving && onOpenChange(false)}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto clinic-card p-6 bg-card"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
              <UserPlus className="size-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">New patient</div>
              <h2 className="font-display text-2xl leading-tight">Register patient</h2>
            </div>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="size-9 rounded-full hover:bg-muted grid place-items-center"><X className="size-4" /></button>
        </div>

        <div className={Section}>Personal</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3"><label className={L}>Title</label>
            <select className={T} value={f.title} onChange={(e) => set("title", e.target.value)}>
              {["Mr", "Mrs", "Ms", "Mx", "Dr", "Master", "Baby"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-9 grid grid-cols-3 gap-3">
            <div><label className={L}>First name *</label><input className={T} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus /></div>
            <div><label className={L}>Middle name</label><input className={T} value={f.middle_name} onChange={(e) => set("middle_name", e.target.value)} /></div>
            <div><label className={L}>Last name</label><input className={T} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></div>
          </div>
          <div className="col-span-3"><label className={L}>Date of birth</label><input type="date" className={T} value={f.dob} onChange={(e) => set("dob", e.target.value)} /></div>
          <div className="col-span-2"><label className={L}>Age</label><input inputMode="numeric" className={T} value={f.age} onChange={(e) => set("age", e.target.value)} /></div>
          <div className="col-span-3"><label className={L}>Gender</label>
            <select className={T} value={f.gender} onChange={(e) => set("gender", e.target.value as any)}>
              <option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
            </select>
          </div>
          <div className="col-span-2"><label className={L}>Marital status</label>
            <select className={T} value={f.marital_status} onChange={(e) => set("marital_status", e.target.value as any)}>
              <option value="">—</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="OTHER">Other</option>
            </select>
          </div>
          <div className="col-span-2"><label className={L}>Anniversary</label><input type="date" className={T} value={f.anniversary} onChange={(e) => set("anniversary", e.target.value)} /></div>
        </div>

        <div className={Section}>Address</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12"><label className={L}>Residential address</label><input className={T} value={f.res_address} onChange={(e) => set("res_address", e.target.value)} /></div>
          <div className="col-span-5"><label className={L}>City</label><input className={T} value={f.res_city} onChange={(e) => set("res_city", e.target.value)} /></div>
          <div className="col-span-4"><label className={L}>State</label><input className={T} value={f.res_state} onChange={(e) => set("res_state", e.target.value)} /></div>
          <div className="col-span-3"><label className={L}>Postal code</label><input className={T} value={f.res_postal} onChange={(e) => set("res_postal", e.target.value)} /></div>
        </div>

        <div className={Section}>Contact</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-4"><label className={L}>Mobile *</label><input type="tel" autoComplete="tel" inputMode="tel" maxLength={20} placeholder="+91 98xxx xxxxx" className={`${T} tabular-nums`} value={f.phone_mobile} onChange={(e) => set("phone_mobile", e.target.value)} /></div>
          <div className="col-span-4"><label className={L}>Residence phone</label><input type="tel" autoComplete="tel" inputMode="tel" maxLength={20} className={`${T} tabular-nums`} value={f.phone_res} onChange={(e) => set("phone_res", e.target.value)} /></div>
          <div className="col-span-4"><label className={L}>Email</label><input type="email" className={T} value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        </div>

        <div className={Section}>Referral</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6"><label className={L}>Referred by (name)</label><input className={T} value={f.referred_by_name} onChange={(e) => set("referred_by_name", e.target.value)} placeholder="e.g. Existing patient or doctor" /></div>
          <div className="col-span-6"><label className={L}>Referred by (phone)</label><input type="tel" autoComplete="tel" inputMode="tel" maxLength={20} className={`${T} tabular-nums`} value={f.referred_by_contact} onChange={(e) => set("referred_by_contact", e.target.value)} /></div>
        </div>

        <div className={Section}>Preferences</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-4"><label className={L}>Language preference</label>
            <select className={T} value={f.language_pref} onChange={(e) => set("language_pref", e.target.value)}>
              {["English", "Hindi", "Marathi", "Gujarati", "Kannada", "Tamil", "Telugu"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>


        <div className="flex justify-end gap-2 mt-6 border-t clinic-divider pt-4">
          <button type="button" disabled={saving} onClick={() => { onOpenChange(false); reset(); }} className="h-10 px-5 rounded-full border border-border text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving} className="h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Registering…" : "Register patient"}
          </button>
        </div>
      </form>

      {dupe && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md clinic-card p-5 bg-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-2">Existing patient found</h3>
            <p className="text-sm text-muted-foreground">
              A patient with this phone number already exists:{" "}
              <span className="font-medium text-foreground">
                {dupe.patient.full_name ||
                  [dupe.patient.title, dupe.patient.first_name, dupe.patient.middle_name, dupe.patient.last_name].filter(Boolean).join(" ")}
              </span>
              {dupe.patient.reg_no != null && (
                <> (<span className="font-medium text-foreground">#{String(dupe.patient.reg_no)}</span>)</>
              )}
              .<br />Use existing patient instead of creating a new one?
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={async () => {
                  const p = dupe.payload;
                  const fn = dupe.fullName;
                  setDupe(null);
                  await doCreate(p, fn);
                }}
                className="h-9 px-4 rounded-full border border-border text-sm hover:bg-muted"
              >
                Create anyway
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = dupe.patient;
                  const name = p.full_name ||
                    [p.title, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
                  onRegistered?.({
                    id: String(p.id),
                    full_name: name,
                    reg_no: p.reg_no != null ? String(p.reg_no) : "",
                    phone: String(p.phone_mobile || p.phone_res || ""),
                  });
                  setDupe(null);
                  onOpenChange(false);
                  reset();
                }}
                className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                Use existing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

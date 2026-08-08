import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, RefreshCw, ShieldCheck, CheckCircle2, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import vennovaMark from "@/assets/vennova-mark.png.asset.json";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [
      { title: "Platform Console — Vennova" },
      { name: "description", content: "Vennova platform console: every clinic on the platform, plan and subscription status, and clinic provisioning." },
      { property: "og:title", content: "Platform Console — Vennova" },
      { property: "og:description", content: "Vennova platform console: every clinic on the platform, plan and subscription status, and clinic provisioning." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuperAdminPage,
});

type ClinicRow = {
  id?: string | number;
  name?: string;
  clinic_name?: string;
  owner?: string;
  owner_name?: string;
  doctor_name?: string;
  owner_email?: string;
  plan?: string;
  plan_name?: string;
  status?: string;
  subscription_status?: string;
  trial_status?: string;
  trial_ends_at?: string;
  patient_count?: number;
  patients?: number;
  revenue?: number;
  total_revenue?: number;
};

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  const o = v as Record<string, unknown> | null | undefined;
  for (const k of ["clinics", "items", "results", "data"]) {
    if (o && Array.isArray(o[k])) return o[k] as T[];
  }
  return [];
}

const inr = (n: unknown) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function SuperAdminPage() {
  const { role, loading, session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!session) return; // AppLayout sends signed-out users to /auth
    if (role && role !== "super_admin") {
      navigate({ to: "/" as any, replace: true });
    }
  }, [loading, session, role, navigate]);

  const clinicsQ = useQuery({
    queryKey: ["superadmin", "clinics"],
    queryFn: () => api.get<unknown>("/superadmin/clinics"),
    enabled: role === "super_admin",
    staleTime: 30_000,
  });

  if (loading || role !== "super_admin") {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  const rawClinics = asArray<ClinicRow>(clinicsQ.data);
  // Guard against duplicate rows/keys if the API ever returns repeats.
  const seen = new Set<string>();
  const clinics = rawClinics.filter((c, i) => {
    const k = String(c.id ?? `${c.clinic_name ?? c.name ?? ""}|${c.owner_email ?? ""}|${i}`);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });


  return (
    <div className="min-h-screen bg-background">
      <header
        className="text-primary-foreground"
        style={{ background: "linear-gradient(120deg, #0D2A4D 0%, #0D47A1 60%, #00B8A9 140%)" }}
      >
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white grid place-items-center shadow-md shrink-0">
              <img src={vennovaMark.url} alt="Vennova" className="size-7 object-contain" />
            </div>
            <div>
              <div className="text-lg leading-none lowercase tracking-tight font-semibold">vennova</div>
              <div className="text-xs text-primary-foreground/70 mt-1 flex items-center gap-1">
                <ShieldCheck className="size-3" /> Platform console
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-primary-foreground/80">
              {profile?.full_name || "Super admin"}
            </span>
            <button
              onClick={async () => { await signOut(); navigate({ to: "/auth" as any, replace: true }); }}
              className="h-9 px-3 rounded-lg border border-white/25 text-xs hover:bg-white/10 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h1 className="font-display text-xl">All clinics</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {clinics.length} clinic{clinics.length === 1 ? "" : "s"} on the platform
                </p>
              </div>
              <button
                onClick={() => clinicsQ.refetch()}
                disabled={clinicsQ.isFetching}
                className="h-9 px-3 rounded-lg border border-border text-xs inline-flex items-center gap-1.5 hover:bg-muted disabled:opacity-60"
              >
                <RefreshCw className={`size-3.5 ${clinicsQ.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    <th className="text-left font-medium px-5 py-3">Clinic</th>
                    <th className="text-left font-medium px-3 py-3">Owner</th>
                    <th className="text-left font-medium px-3 py-3">Plan</th>
                    <th className="text-left font-medium px-3 py-3">Status</th>
                    <th className="text-right font-medium px-3 py-3">Patients</th>
                    <th className="text-right font-medium px-5 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicsQ.isLoading && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Loading clinics…</td></tr>
                  )}
                  {clinicsQ.isError && !clinicsQ.isLoading && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-destructive">
                      {(clinicsQ.error as Error)?.message || "Could not load clinics."}
                    </td></tr>
                  )}
                  {!clinicsQ.isLoading && !clinicsQ.isError && clinics.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No clinics yet.</td></tr>
                  )}
                  {clinics.map((c, i) => {
                    const status = c.subscription_status || c.status || c.trial_status || "";
                    return (
                      <tr key={String(c.id ?? i)} className="border-t border-border/70 hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 font-medium">
                            <Building2 className="size-3.5 text-muted-foreground" />
                            {c.clinic_name || c.name || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div>{c.owner_name || c.owner || c.doctor_name || "—"}</div>
                          {c.owner_email && (
                            <div className="text-xs text-muted-foreground">{c.owner_email}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 capitalize">{c.plan_name || c.plan || "—"}</td>
                        <td className="px-3 py-3">
                          <StatusPill value={status} trialEnds={c.trial_ends_at} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {Number(c.patient_count ?? c.patients ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {inr(c.revenue ?? c.total_revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4">
          <CreateClinicCard onCreated={() => qc.invalidateQueries({ queryKey: ["superadmin", "clinics"] })} />
        </section>
      </main>
    </div>
  );
}

function StatusPill({ value, trialEnds }: { value: string; trialEnds?: string }) {
  const v = (value || "").toLowerCase();
  const tone =
    /active|paid|subscribed/.test(v) ? "bg-emerald-500/10 text-emerald-600"
    : /trial/.test(v) ? "bg-amber-500/10 text-amber-600"
    : /expired|cancel|past_due|suspend/.test(v) ? "bg-destructive/10 text-destructive"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs capitalize ${tone}`}>
      {value ? value.replace(/_/g, " ") : "—"}
      {trialEnds && /trial/.test(v) ? ` · ends ${new Date(trialEnds).toLocaleDateString("en-IN")}` : ""}
    </span>
  );
}

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" },
];

type CreatedClinic = {
  owner_email?: string;
  generated_password?: string;
  email_sent?: boolean;
  clinic?: { owner_email?: string; generated_password?: string };
  data?: { owner_email?: string; generated_password?: string; email_sent?: boolean };
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Could not copy — select and copy manually.");
            }
          }}
          className="shrink-0 h-auto px-3 rounded-lg border border-border text-xs inline-flex items-center gap-1.5 hover:bg-muted"
          aria-label={`Copy ${label}`}
        >
          {copied ? <><Check className="size-3.5" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
        </button>
      </div>
    </div>
  );
}

function CredentialsPanel({ data, onClose }: { data: CreatedClinic; onClose: () => void }) {
  const src = data.data ?? data.clinic ?? data;
  const email = (src as CreatedClinic).owner_email ?? data.owner_email ?? "";
  const password = (src as CreatedClinic).generated_password ?? data.generated_password ?? "";
  const emailSent = (data.data?.email_sent ?? data.email_sent) === true;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-display text-lg leading-tight">Clinic created</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Owner sign-in credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-lg hover:bg-muted" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <CopyField label="Owner email" value={email || "—"} />
          <CopyField label="Generated password" value={password || "—"} />
        </div>

        {!emailSent && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
            Email not sent yet — copy these credentials and share manually.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function CreateClinicCard({ onCreated }: { onCreated: () => void }) {
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [plan, setPlan] = useState("starter");
  const [created, setCreated] = useState<CreatedClinic | null>(null);

  const createM = useMutation({
    mutationFn: () =>
      api.post<CreatedClinic>("/superadmin/clinics", {
        clinic_name: clinicName.trim(),
        doctor_name: doctorName.trim(),
        doctor_email: doctorEmail.trim(),
        plan,
      }),
    onSuccess: (res) => {
      setCreated({ owner_email: doctorEmail.trim(), ...(res ?? {}) });
      toast.success("Clinic created.");
      setClinicName("");
      setDoctorName("");
      setDoctorEmail("");
      setPlan("starter");
      onCreated();
    },
    onError: (e: unknown) => {
      toast.error((e as Error)?.message || "Could not create clinic.");
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg">Create clinic</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Provisions the clinic and emails the owner their sign-in credentials.
      </p>

      {created && <CredentialsPanel data={created} onClose={() => setCreated(null)} />}


      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => { e.preventDefault(); setCreated(null); createM.mutate(); }}
      >
        <Field label="Clinic name">
          <input
            required maxLength={120} value={clinicName} onChange={(e) => setClinicName(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Doctor name">
          <input
            required maxLength={120} value={doctorName} onChange={(e) => setDoctorName(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Doctor email">
          <input
            type="email" required value={doctorEmail} onChange={(e) => setDoctorEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Plan">
          <select
            value={plan} onChange={(e) => setPlan(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <button
          type="submit" disabled={createM.isPending}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {createM.isPending
            ? <><Loader2 className="size-4 animate-spin" /> Creating…</>
            : <><Plus className="size-4" /> Create clinic</>}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

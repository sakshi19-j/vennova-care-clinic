import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Stethoscope, Phone, MessageCircle, Gift, ArrowLeft, Loader2, AlertTriangle,
  FileText, Receipt, BellRing, ClipboardList, Activity, CalendarDays, MapPin, Mail, IndianRupee, Download,
} from "lucide-react";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { patientsService, patientDisplayName, patientPhone, type Patient } from "@/services/patients";

export const Route = createFileRoute("/patients/$patientId")({
  head: () => ({ meta: [{ title: "Patient — Vennova Clinic" }] }),
  component: PatientDetail,
});

type Tab = "overview" | "visits" | "prescriptions" | "billing" | "followups" | "notes";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: ClipboardList },
  { key: "visits", label: "Visit timeline", icon: Activity },
  { key: "prescriptions", label: "Prescriptions", icon: FileText },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "followups", label: "Followups", icon: BellRing },
  { key: "notes", label: "Notes", icon: FileText },
];

function PatientDetail() {
  const { patientId } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  const patientQ = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsService.get(patientId),
    staleTime: 30_000,
    retry: 1,
  });

  if (patientQ.isLoading) {
    return (
      <div className="max-w-[1300px] mx-auto p-6">
        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse mb-3" />
        <div className="h-64 bg-muted/30 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (patientQ.error || !patientQ.data) {
    const msg = patientQ.error instanceof ApiError ? patientQ.error.message : (patientQ.error as Error | null)?.message;
    return (
      <div className="max-w-[800px] mx-auto p-6">
        <Card className="py-12 text-center">
          <AlertTriangle className="size-8 text-amber-600 mx-auto mb-2" />
          <div className="font-display text-xl">Patient not found</div>
          <p className="text-sm text-muted-foreground mt-1">{msg || "We couldn't load this record."}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => patientQ.refetch()} className="rounded-full">Retry</Button>
            <Button onClick={() => navigate({ to: "/patients" })} className="rounded-full">
              <ArrowLeft className="size-4 mr-1" /> Back to patients
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const p = patientQ.data;
  const name = patientDisplayName(p);
  const phone = patientPhone(p);
  const subtitle = [
    p.age != null ? `${p.age}y` : null,
    p.gender || null,
    phone || null,
    p.reg_no != null ? `Reg #${p.reg_no}` : null,
  ].filter(Boolean).join(" · ");

  const sendBirthdayWish = async () => {
    try {
      await api.post(`/whatsapp/send/birthday/${encodeURIComponent(patientId)}`);
      toast.success(`Birthday wish sent to ${name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message || "Couldn't send wish");
    }
  };

  return (
    <div className="max-w-[1300px] mx-auto">
      <PageHeader
        eyebrow={p.reg_no != null ? `Reg #${p.reg_no}` : "Patient"}
        title={name}
        subtitle={subtitle}
        actions={
          <>
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex">
                <Button variant="outline" className="rounded-full"><Phone className="size-4 mr-1" /> Call</Button>
              </a>
            )}
            {phone && (
              <a
                href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button variant="outline" className="rounded-full"><MessageCircle className="size-4 mr-1" /> WhatsApp</Button>
              </a>
            )}
            <Link
              to="/consultation/$patientId"
              params={{ patientId: p.id }}
              search={{ visit_type: ((p as unknown as { patient_type?: string }).patient_type || "HOMEOPATHY").toUpperCase() } as Record<string, string>}
              className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm hover:bg-primary/90"
            >
              <Stethoscope className="size-4" /> Start Consultation
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        {/* Profile sidebar */}
        <Card className="col-span-12 lg:col-span-4">
          <div className="font-display text-lg mb-3">Profile</div>
          <dl className="space-y-2 text-sm">
            <Row label="Phone" value={phone || "—"} icon={<Phone className="size-3.5" />} />
            <Row label="Email" value={p.email || "—"} icon={<Mail className="size-3.5" />} />
            <Row label="DOB" value={fmtDate(p.dob) || "—"} icon={<CalendarDays className="size-3.5" />} />
            <Row label="Blood group" value={p.blood_group || "—"} />
            <Row label="Marital" value={p.marital_status || "—"} />
            <Row label="Occupation" value={p.occupation || "—"} />
            <Row
              label="Address"
              value={[p.res_address, p.res_city, p.res_state, p.res_postal].filter(Boolean).join(", ") || "—"}
              icon={<MapPin className="size-3.5" />}
            />
            <Row label="Referred by" value={p.referred_by_name || "—"} />
            <Row label="Language" value={p.language_pref || "—"} />
          </dl>
          <div className="mt-4 pt-4 border-t clinic-divider">
            <Button
              variant="outline"
              className="rounded-full w-full justify-start"
              onClick={sendBirthdayWish}
              disabled={!p.dob}
              title={p.dob ? undefined : "DOB required"}
            >
              <Gift className="size-4 mr-2 text-saffron" />
              Send birthday wish via WhatsApp
            </Button>
          </div>
        </Card>

        {/* Tabs panel */}
        <div className="col-span-12 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-card border border-border mb-4 w-fit">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    "inline-flex items-center gap-2 px-3.5 h-9 rounded-xl text-xs font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  <Icon className="size-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          {tab === "overview" && <OverviewPane patient={p} />}
          {tab === "visits" && <VisitsPane patientId={patientId} />}
          {tab === "prescriptions" && <PrescriptionsPane patientId={patientId} />}
          {tab === "billing" && <BillingPane patientId={patientId} />}
          {tab === "followups" && <FollowupsPane patientId={patientId} />}
          {tab === "notes" && <NotesPane patient={p} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Panes ---------- */

function OverviewPane({ patient }: { patient: Patient }) {
  return (
    <Card>
      <div className="font-display text-lg mb-3">Overview</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Visits" value={patient.visit_count != null ? String(patient.visit_count) : "—"} icon={<Activity className="size-4" />} />
        <Kpi label="Outstanding" value={patient.outstanding_balance != null ? `₹${Number(patient.outstanding_balance).toLocaleString("en-IN")}` : "—"} icon={<IndianRupee className="size-4" />} />
        <Kpi label="Last visit" value={fmtDate(patient.last_visit_at) || "—"} icon={<CalendarDays className="size-4" />} />
      </div>
      {patient.notes && (
        <div className="mt-4 pt-4 border-t clinic-divider">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
          <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
        </div>
      )}
    </Card>
  );
}

type VisitRow = {
  id?: string;
  visit_id?: string;
  visit_date?: string;
  created_at?: string;
  type?: string;
  visit_type?: string;
  doctor_name?: string;
  diagnosis?: string;
  chief_complaint?: string;
  status?: string;
  payment_status?: string;
  fee?: number;
  amount?: number;
  [k: string]: unknown;
};

function VisitsPane({ patientId }: { patientId: string }) {
  const q = useQuery({
    queryKey: ["patient", patientId, "visits"],
    queryFn: () => patientsService.visits(patientId) as Promise<VisitRow[]>,
    staleTime: 30_000,
    retry: 1,
  });

  if (q.isLoading) return <PaneSkeleton />;
  if (q.error) return <PaneError onRetry={() => q.refetch()} message={(q.error as Error).message} />;
  const items = q.data ?? [];
  if (items.length === 0) return <PaneEmpty label="No visits recorded yet for this patient." />;

  return (
    <Card>
      <div className="font-display text-lg mb-3">Visit timeline</div>
      <ol className="relative pl-5">
        <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
        {items.map((v, i) => {
          const id = String(v.visit_id ?? v.id ?? i);
          const date = fmtDate(v.visit_date ?? v.created_at);
          const type = String(v.type ?? v.visit_type ?? "").toUpperCase();
          const dx = v.diagnosis || v.chief_complaint || "—";
          const fee = v.fee ?? v.amount;
          const paid = (v.payment_status || "").toUpperCase() === "PAID";
          return (
            <li key={id} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[14px] top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" />
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xs text-muted-foreground">{date || "—"}</div>
                {type && <span className="text-[10px] uppercase tracking-widest text-primary">{type}</span>}
              </div>
              <div className="text-sm font-medium mt-0.5">{dx}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {v.doctor_name && <span>Dr. {v.doctor_name}</span>}
                {fee != null && <span>₹{Number(fee).toLocaleString("en-IN")}</span>}
                {v.payment_status && (
                  <span className={paid ? "text-success" : "text-amber-600"}>{String(v.payment_status)}</span>
                )}
                {v.visit_id && (
                  <span className="text-muted-foreground">Visit #{String(v.visit_id).slice(0, 8)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function PrescriptionsPane({ patientId }: { patientId: string }) {
  const q = useQuery({
    queryKey: ["patient", patientId, "visits-rx"],
    queryFn: () => patientsService.visits(patientId) as Promise<VisitRow[]>,
    staleTime: 30_000,
    retry: 1,
  });
  if (q.isLoading) return <PaneSkeleton />;
  if (q.error) return <PaneError onRetry={() => q.refetch()} message={(q.error as Error).message} />;
  const items = (q.data ?? []).filter((v) => v.visit_id ?? v.id);
  if (items.length === 0) return <PaneEmpty label="No prescriptions generated yet." />;
  return (
    <Card>
      <div className="font-display text-lg mb-3">Prescriptions</div>
      <ul className="divide-y clinic-divider">
        {items.map((v, i) => {
          const id = String(v.visit_id ?? v.id ?? i);
          return (
            <li key={id} className="py-3 flex items-center gap-3">
              <FileText className="size-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{v.diagnosis || v.chief_complaint || "Prescription"}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(v.visit_date ?? v.created_at) || "—"}</div>
              </div>
              <a
                href={`/api/prescriptions/download/${encodeURIComponent(id)}`}
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await api.get<{ url?: string; pdf_url?: string }>(`/prescriptions/download/${encodeURIComponent(id)}`);
                    const url = res?.url || res?.pdf_url;
                    if (url) window.open(url, "_blank", "noopener");
                    else toast.message("Prescription PDF is being generated.");
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : "Couldn't fetch prescription");
                  }
                }}
                className="h-8 px-3 rounded-full border border-border text-xs inline-flex items-center gap-1 hover:bg-muted"
              >
                <Download className="size-3.5" /> PDF
              </a>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

type BillingRow = {
  id?: string;
  visit_id?: string;
  amount?: number;
  fee?: number;
  payment_mode?: string;
  payment_status?: string;
  status?: string;
  created_at?: string;
  date?: string;
  [k: string]: unknown;
};

function BillingPane({ patientId }: { patientId: string }) {
  // Backend offers /billing/history (paginated) and /visits/patient/{id} which
  // includes payment_status — derive billing rows from the patient's visits.
  const q = useQuery({
    queryKey: ["patient", patientId, "billing"],
    queryFn: () => patientsService.visits(patientId) as Promise<BillingRow[]>,
    staleTime: 30_000,
    retry: 1,
  });
  if (q.isLoading) return <PaneSkeleton />;
  if (q.error) return <PaneError onRetry={() => q.refetch()} message={(q.error as Error).message} />;
  const rows = (q.data ?? []).filter((r) => r.fee != null || r.amount != null || r.payment_status);
  if (rows.length === 0) return <PaneEmpty label="No billing records yet." />;
  return (
    <Card>
      <div className="font-display text-lg mb-3">Billing history</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
              <th className="text-left font-medium py-2 px-2">Date</th>
              <th className="text-left font-medium py-2 px-2">Visit</th>
              <th className="text-left font-medium py-2 px-2">Mode</th>
              <th className="text-left font-medium py-2 px-2">Status</th>
              <th className="text-right font-medium py-2 px-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const amount = r.amount ?? r.fee ?? 0;
              const status = (r.payment_status || r.status || "").toString();
              const paid = status.toUpperCase() === "PAID";
              return (
                <tr key={String(r.id ?? r.visit_id ?? i)} className="border-b clinic-divider">
                  <td className="py-2 px-2 text-muted-foreground">{fmtDate(r.created_at ?? r.date) || "—"}</td>
                  <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{String(r.visit_id ?? "—")}</td>
                  <td className="py-2 px-2">{r.payment_mode || "—"}</td>
                  <td className="py-2 px-2">
                    <span className={paid ? "text-success text-xs" : "text-amber-600 text-xs"}>{status || "—"}</span>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">₹{Number(amount).toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type FollowupRow = {
  id?: string;
  followup_id?: string;
  due_at?: string;
  due_date?: string;
  status?: string;
  note?: string;
  notes?: string;
  [k: string]: unknown;
};

function FollowupsPane({ patientId }: { patientId: string }) {
  const q = useQuery({
    queryKey: ["patient", patientId, "followups"],
    queryFn: () => patientsService.followups(patientId) as Promise<FollowupRow[]>,
    staleTime: 30_000,
    retry: 1,
  });
  if (q.isLoading) return <PaneSkeleton />;
  if (q.error) return <PaneError onRetry={() => q.refetch()} message={(q.error as Error).message} />;
  const items = q.data ?? [];
  if (items.length === 0) return <PaneEmpty label="No followups scheduled for this patient." />;
  return (
    <Card>
      <div className="font-display text-lg mb-3">Followups</div>
      <ul className="divide-y clinic-divider">
        {items.map((f, i) => (
          <li key={String(f.id ?? f.followup_id ?? i)} className="py-3 flex items-center gap-3">
            <BellRing className="size-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{f.note ?? f.notes ?? "Followup"}</div>
              <div className="text-xs text-muted-foreground">Due {fmtDate(f.due_at ?? f.due_date) || "—"}</div>
            </div>
            {f.status && <span className="text-xs text-muted-foreground">{String(f.status)}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NotesPane({ patient }: { patient: Patient }) {
  return (
    <Card>
      <div className="font-display text-lg mb-3">Notes</div>
      {patient.notes ? (
        <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
      ) : (
        <PaneEmpty label="No notes recorded for this patient." inline />
      )}
    </Card>
  );
}

/* ---------- Bits ---------- */

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground inline-flex items-center gap-1.5 shrink-0">{icon}{label}</dt>
      <dd className="font-medium text-right break-words min-w-0">{value}</dd>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3 bg-muted/20">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">{icon} {label}</div>
      <div className="font-display text-xl mt-0.5">{value}</div>
    </div>
  );
}

function PaneSkeleton() {
  return (
    <Card>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    </Card>
  );
}

function PaneError({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <Card>
      <div className="py-8 text-center">
        <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
          <AlertTriangle className="size-4" /> {message || "Couldn't load this section."}
        </div>
        <div className="mt-3"><Button variant="outline" onClick={onRetry} className="rounded-full">Retry</Button></div>
      </div>
    </Card>
  );
}

function PaneEmpty({ label, inline = false }: { label: string; inline?: boolean }) {
  const inner = <div className="text-sm text-muted-foreground py-6 text-center">{label}</div>;
  return inline ? inner : <Card>{inner}</Card>;
}

function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

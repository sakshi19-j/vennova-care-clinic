import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, AlertTriangle, ArrowLeft, User, FileText, Pill, Receipt,
  CalendarClock, StickyNote, Paperclip, Sparkles, History,
} from "lucide-react";
import { patientsService, patientDisplayName, patientPhone, type Patient } from "@/services/patients";
import { Card } from "@/components/clinic/PageHeader";

export const Route = createFileRoute("/patients/$patientId/workspace")({
  head: () => ({ meta: [{ title: "Patient Workspace — Vennova Clinic" }] }),
  component: WorkspacePage,
});

type TabId =
  | "summary" | "visits" | "prescriptions" | "billing"
  | "followups" | "notes" | "attachments" | "ai";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "summary", label: "Summary", icon: User },
  { id: "visits", label: "Visits", icon: History },
  { id: "prescriptions", label: "Prescriptions", icon: Pill },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "followups", label: "Follow-ups", icon: CalendarClock },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "ai", label: "AI Insights", icon: Sparkles },
];

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function WorkspacePage() {
  const { patientId } = Route.useParams();
  const [tab, setTab] = useState<TabId>("summary");

  const patientQ = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsService.get(patientId),
  });

  const visitsQ = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: () => patientsService.visits(patientId),
    enabled: tab === "visits" || tab === "prescriptions" || tab === "summary",
  });

  const followupsQ = useQuery({
    queryKey: ["patient-followups", patientId],
    queryFn: () => patientsService.followups(patientId),
    enabled: tab === "followups" || tab === "summary",
  });

  if (patientQ.isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto py-12 grid place-items-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mb-2" /> Loading workspace…
      </div>
    );
  }
  if (patientQ.error || !patientQ.data) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
          <AlertTriangle className="size-4" /> Could not load patient.
        </div>
        <div className="mt-4">
          <Link to="/patients" className="text-primary text-sm hover:underline">← Back to patients</Link>
        </div>
      </div>
    );
  }

  const p = patientQ.data as Patient;
  const visits = visitsQ.data ?? [];
  const followups = followupsQ.data ?? [];

  return (
    <div className="max-w-[1400px] mx-auto pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-1">Patient Workspace</div>
          <h1 className="font-display text-3xl md:text-4xl">{patientDisplayName(p)}</h1>
          <div className="text-sm text-muted-foreground mt-1 tabular-nums">
            {patientPhone(p) || "—"} {p.reg_no ? `· VNC-${String(p.reg_no).padStart(4, "0")}` : ""}
          </div>
        </div>
        <Link
          to="/patients"
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-full border border-border text-sm hover:bg-muted"
        >
          <ArrowLeft className="size-4" /> All patients
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-card border border-border mb-5 w-fit">
        {TABS.map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "inline-flex items-center gap-2 px-3.5 h-9 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              ].join(" ")}
            >
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {tab === "summary" && (
            <Card>
              <div className="font-display text-xl mb-3">Patient summary</div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Age">{p.age ?? "—"}</Field>
                <Field label="Gender">{p.gender ?? "—"}</Field>
                <Field label="Blood group">{p.blood_group ?? "—"}</Field>
                <Field label="Last visit">{fmtDate(p.last_visit_at)}</Field>
                <Field label="Total visits">{p.visit_count ?? visits.length}</Field>
                <Field label="Outstanding">₹{p.outstanding_balance ?? 0}</Field>
                <Field label="City">{p.res_city ?? "—"}</Field>
                <Field label="Email">{p.email ?? "—"}</Field>
              </dl>
            </Card>
          )}

          {tab === "visits" && (
            <Card className="p-0 overflow-hidden">
              <SectionHeader title="Visit history" count={visits.length} />
              <ListOrEmpty
                loading={visitsQ.isLoading}
                empty={visits.length === 0}
                emptyLabel="No visits yet"
              >
                <ul className="divide-y clinic-divider">
                  {visits.map((v: any) => (
                    <li key={v.id ?? v.visit_id} className="px-5 py-3 flex items-center gap-4">
                      <div className="text-xs text-muted-foreground tabular-nums w-28 shrink-0">
                        {fmtDate(v.visit_date ?? v.created_at)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{v.chief_complaint || "Consultation"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {v.type || v.visit_type || "—"} {v.doctor_name ? `· ${v.doctor_name}` : ""}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {v.status || "completed"}
                      </span>
                    </li>
                  ))}
                </ul>
              </ListOrEmpty>
            </Card>
          )}

          {tab === "prescriptions" && (
            <Card className="p-0 overflow-hidden">
              <SectionHeader title="Prescriptions" count={visits.length} />
              <ListOrEmpty
                loading={visitsQ.isLoading}
                empty={visits.length === 0}
                emptyLabel="No prescriptions yet"
              >
                <ul className="divide-y clinic-divider">
                  {visits.map((v: any) => (
                    <li key={v.id ?? v.visit_id} className="px-5 py-3 flex items-center gap-3">
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {v.homeopathy?.remedy || v.prescription || "Prescription"}
                        </div>
                        <div className="text-xs text-muted-foreground">{fmtDate(v.visit_date ?? v.created_at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ListOrEmpty>
            </Card>
          )}

          {tab === "billing" && (
            <Card className="p-0 overflow-hidden">
              <SectionHeader title="Billing history" />
              <EmptyState label="Billing history will appear here once invoices are linked to this patient." />
            </Card>
          )}

          {tab === "followups" && (
            <Card className="p-0 overflow-hidden">
              <SectionHeader title="Follow-ups" count={followups.length} />
              <ListOrEmpty
                loading={followupsQ.isLoading}
                empty={followups.length === 0}
                emptyLabel="No follow-ups scheduled"
              >
                <ul className="divide-y clinic-divider">
                  {followups.map((f: any) => (
                    <li key={f.id ?? f.followup_id} className="px-5 py-3 flex items-center gap-3">
                      <CalendarClock className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{fmtDate(f.due_at ?? f.due_date)}</div>
                        <div className="text-xs text-muted-foreground">{f.channel ?? "WhatsApp"} · {f.status ?? "pending"}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ListOrEmpty>
            </Card>
          )}

          {tab === "notes" && (
            <Card><div className="font-display text-xl mb-2">Notes timeline</div>
              <EmptyState label="Doctor notes added during consultations will appear here." />
            </Card>
          )}

          {tab === "attachments" && (
            <Card><div className="font-display text-xl mb-2">Attachments</div>
              <EmptyState label="Upload lab reports, scans, and case papers — coming soon." />
            </Card>
          )}

          {tab === "ai" && (
            <Card><div className="font-display text-xl mb-2">AI Insights</div>
              <EmptyState label="Pattern detection across visits — coming soon." />
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <Card>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Quick stats</div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Visits" value={String(p.visit_count ?? visits.length)} />
              <Stat label="Last visit" value={p.last_visit_at ? fmtDate(p.last_visit_at) : "New"} />
              <Stat label="Outstanding" value={`₹${p.outstanding_balance ?? 0}`} />
              <Stat label="Follow-ups" value={String(followups.length)} />
            </div>
          </Card>
          {p.notes && (
            <Card>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
              <p className="text-sm whitespace-pre-wrap">{p.notes}</p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="text-sm mt-0.5">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5 text-center">
      <div className="font-display text-base tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b clinic-divider">
      <div className="font-display text-lg">{title}</div>
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">{label}</div>
  );
}

function ListOrEmpty({
  loading, empty, emptyLabel, children,
}: { loading: boolean; empty: boolean; emptyLabel: string; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="px-5 py-10 grid place-items-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }
  if (empty) return <EmptyState label={emptyLabel} />;
  return <>{children}</>;
}

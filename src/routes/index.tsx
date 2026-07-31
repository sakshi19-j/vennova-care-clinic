import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Avatar } from "@/components/clinic/PageHeader";
import {
  ArrowRight, Plus, Clock, ChevronRight,
  Stethoscope, FileText, Receipt, BellRing, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardService } from "@/services/dashboard";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clinic Dashboard — Vennova" },
      { name: "description", content: "Your clinic at a glance: live queue, today's KPIs and pending follow-ups." },
      { property: "og:title", content: "Clinic Dashboard — Vennova" },
      { property: "og:description", content: "Your clinic at a glance: live queue, today's KPIs and pending follow-ups." },
      { property: "og:url", content: "https://vennova-care-clinic.lovable.app/" },
      { name: "twitter:title", content: "Clinic Dashboard — Vennova" },
      { name: "twitter:description", content: "Your clinic at a glance: live queue, today's KPIs and pending follow-ups." },
    ],
    links: [{ rel: "canonical", href: "https://vennova-care-clinic.lovable.app/" }],
  }),
  component: Dashboard,
});

type QueueItem = {
  id?: string;
  queue_id?: string;
  patient_id?: string;
  patient_name?: string;
  token?: number | string;
  status?: string;
  visit_type?: string;
  check_in_time?: string;
  created_at?: string;
};

type QueueStats = {
  waiting?: number;
  with_doctor?: number;
  in_treatment?: number;
  billing?: number;
  billing_pending?: number;
  completed?: number;
  no_show?: number;
  [k: string]: unknown;
};

function inr(n: number) { return `₹${Number(n || 0).toLocaleString("en-IN")}`; }

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "rows", "queue"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function Dashboard() {
  const queueQ = useQuery({
    queryKey: ["queue", "today"],
    queryFn: () => api.get<unknown>("/queue/today").then(asArray<QueueItem>),
    refetchInterval: 10_000, staleTime: 5_000, retry: 1,
  });
  const statsQ = useQuery({
    // Canonical key shared with every invalidator (admin/doctor/reception/billing/Rx).
    queryKey: ["queue", "stats-today"],
    queryFn: () => api.get<QueueStats>("/queue/stats/today"),
    refetchInterval: 10_000, staleTime: 5_000, retry: 1,
  });
  const summaryQ = useQuery({
    // Keep under the ["analytics"] prefix so blanket invalidations refresh us.
    queryKey: ["analytics", "summary", "today"],
    queryFn: () => dashboardService.summaryToday(),
    refetchInterval: 30_000, staleTime: 15_000, retry: 1,
  });

  const queue = queueQ.data ?? [];
  const inConsult = queue.find((q) => /WITH_DOCTOR|IN_TREATMENT|IN_CONSULT/i.test(String(q.status ?? "")));
  const waiting = queue.filter((q) => /WAITING/i.test(String(q.status ?? "")));

  const stats = statsQ.data ?? {};
  const sToday = summaryQ.data ?? {};

  const revenueToday = Number(sToday.revenue_today ?? sToday.revenue ?? 0) || 0;
  const visitsToday = Number(sToday.visits_today ?? sToday.visits ?? 0) || 0;
  const followupsToday = Number(sToday.pending_followups ?? sToday.followups_today ?? 0) || 0;

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow={`Today · ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`}
        title="Clinic Dashboard"
        subtitle={
          <>
            <strong className="text-foreground">{stats.waiting ?? waiting.length}</strong> waiting,{" "}
            <strong className="text-foreground">{stats.with_doctor ?? stats.in_treatment ?? 0}</strong> with doctor,{" "}
            <strong className="text-foreground">{followupsToday}</strong> followups today.
          </>
        }
        actions={
          <>
            <Link to="/queue" className="inline-flex items-center"><Button variant="outline" className="rounded-full">Open queue</Button></Link>
            <Link to="/patients" className="inline-flex items-center">
              <Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> New patient</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <Card className="bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_85%,black)] text-primary-foreground border-transparent relative overflow-hidden">
            <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary-foreground/70">
              <span className="size-1.5 rounded-full bg-success pulse-dot" /> Live · auto-refresh
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/70 mb-3">Now consulting</div>
            {inConsult ? (
              <>
                <div className="flex items-end gap-3">
                  {inConsult.token != null && <span className="font-display text-saffron text-3xl">#{inConsult.token}</span>}
                  <h2 className="font-display text-4xl leading-none">{inConsult.patient_name || ""}</h2>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/queue" className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-gold text-gold-foreground font-medium hover:brightness-105">
                    <Stethoscope className="size-4" /> Open queue
                  </Link>
                </div>
              </>
            ) : queueQ.isLoading ? (
              <div className="text-primary-foreground/70 inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading queue…</div>
            ) : (
              <div className="text-primary-foreground/70">No active consultation.</div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-xl">Waiting · {stats.waiting ?? waiting.length}</h2>
                <div className="text-xs text-muted-foreground">Live queue · refreshes every 10s</div>
              </div>
              <Link to="/queue" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                Open queue <ChevronRight className="size-3.5" />
              </Link>
            </div>
            {queueQ.isLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />)}
              </div>
            ) : waiting.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No patients waiting.</div>
            ) : (
              <ul className="space-y-1.5">
                {waiting.slice(0, 6).map((q) => {
                  const wait = waitMins(q.check_in_time || q.created_at);
                  return (
                    <li key={String(q.queue_id ?? q.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 border border-transparent hover:border-border">
                      {q.token != null && <span className="font-mono text-xs text-muted-foreground w-8">#{q.token}</span>}
                      <Avatar name={q.patient_name || ""} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{q.patient_name || ""}</div>
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="size-3" /> {wait}m
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card>
            <h2 className="font-display text-xl mb-3">Today at a glance</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Revenue" value={inr(revenueToday)} loading={summaryQ.isLoading} />
              <Stat label="Visits" value={String(visitsToday)} loading={summaryQ.isLoading} />
              <Stat label="Followups" value={String(followupsToday)} loading={summaryQ.isLoading} />
              <Stat label="Completed" value={String(stats.completed ?? 0)} loading={statsQ.isLoading} />
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-xl mb-3">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Stethoscope, label: "Open queue", to: "/queue" as const },
                { icon: FileText, label: "Prescriptions", to: "/prescriptions" as const },
                { icon: Receipt, label: "Billing", to: "/billing" as const },
                { icon: BellRing, label: "Reminders", to: "/reminders" as const },
              ].map((a) => (
                <Link key={a.label} to={a.to} className="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-border hover:bg-muted/60 transition">
                  <span className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <a.icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{a.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-3 space-y-5">
          <Card>
            <h2 className="font-display text-xl mb-3">Pipeline</h2>
            <div className="space-y-3 text-sm">
              <Row label="Waiting" value={stats.waiting ?? 0} />
              <Row label="With doctor" value={stats.with_doctor ?? stats.in_treatment ?? 0} />
              <Row label="Billing pending" value={stats.billing_pending ?? stats.billing ?? 0} />
              <Row label="Completed" value={stats.completed ?? 0} />
              <Row label="No-show" value={stats.no_show ?? 0} />
            </div>
            <Link to="/analytics" className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-4">
              Open analytics <ArrowRight className="size-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function waitMins(t: string | undefined): number {
  if (!t) return 0;
  const ms = Date.now() - new Date(t).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function Stat({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-3 bg-background/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl mt-0.5">{loading ? <span className="text-muted-foreground">…</span> : value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

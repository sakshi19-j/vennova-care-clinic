import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  IndianRupee, Users, CalendarDays, Stethoscope, BellRing, UserPlus,
  PlayCircle, Building2, UserCog, Loader2, AlertTriangle, ArrowRight, Sparkles,
  TrendingDown, UserX,
} from "lucide-react";
import { Card } from "@/components/clinic/PageHeader";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

function pick(obj: unknown, keys: string[], fallback = 0): number {
  if (!obj || typeof obj !== "object") return fallback;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v && !Number.isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

type DashboardData = unknown;
type QueueStats = {
  total_today?: number;
  waiting?: number;
  in_treatment?: number;
  completed?: number;
  no_show?: number;
  [k: string]: unknown;
};

function DashboardPage() {
  const { profile, clinicName, role } = useAuth();

  const dashQ = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get<DashboardData>("/analytics/dashboard"),
    staleTime: 60_000,
    retry: 1,
  });

  const queueStatsQ = useQuery({
    queryKey: ["queue", "stats-today"],
    queryFn: () => api.get<QueueStats>("/queue/stats/today"),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const loading = dashQ.isLoading || queueStatsQ.isLoading;
  const anyError = dashQ.error || queueStatsQ.error;

  const d = dashQ.data;
  const revenueToday = pick(get(d, ["revenue", "today"]), ["revenue", "total", "amount"]);
  const revenueMonthly = pick(get(d, ["revenue", "this_month"]), ["revenue", "total", "amount"]);
  const totalPatients = pick(get(d, ["patients", "total"]), ["count", "total"]) ||
    pick(get(d, ["patients"]), ["total", "count"]);
  const missedPatients = pick(get(d, ["patients", "missed"]), ["count", "total"]);
  const retentionRate = pick(get(d, ["patients", "retention"]), ["retention_rate", "rate"]);
  const followupsToday = pick(get(d, ["clinical", "followups_due_today"]), ["count", "total"]);
  const revenueLost = pick(get(d, ["intelligence"]), ["estimated_revenue_lost", "revenue_lost"]);

  const qs = queueStatsQ.data ?? {};
  const queueWaiting = pick(qs, ["waiting"]);
  const queueInTreatment = pick(qs, ["in_treatment"]);
  const queueCompleted = pick(qs, ["completed"]);
  const visitsToday = queueCompleted + queueInTreatment;
  const appointmentsToday = pick(qs, ["total_today"]);

  const chartData = useMemo(() => {
    const week = get(d, ["revenue", "this_week", "week"]);
    const pts = Array.isArray(week) ? week : [];
    return pts.map((p: Record<string, unknown>, i: number) => ({
      d: String(p.day ?? p.date ?? p.label ?? i + 1).slice(0, 10),
      total: Number(p.revenue ?? p.amount ?? p.total ?? 0) || 0,
    }));
  }, [d]);


  // Empty-account: no patients AND no visits AND no revenue ever
  const emptyAccount =
    !loading &&
    totalPatients === 0 &&
    visitsToday === 0 &&
    revenueToday === 0 &&
    revenueMonthly === 0;

  const firstName = (profile?.full_name || "").split(" ")[0] || "Doctor";

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Greeting */}
      <div className="col-span-12 flex items-end justify-between flex-wrap gap-2">
        <div>
          <div className="font-display text-lg leading-tight inline-flex items-center gap-2">
            Welcome back, {firstName}
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {clinicName ? `${clinicName} · ` : ""}Real-time data from your clinic.
          </div>
        </div>
        {anyError && !emptyAccount && (
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="size-3.5" /> Some widgets failed to load.
          </div>
        )}
      </div>

      {emptyAccount ? (
        <OnboardingCard firstName={firstName} role={role} />
      ) : (
        <>
          {/* KPI tiles */}
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Today's revenue" value={inr(revenueToday)} icon={<IndianRupee className="size-4" />} loading={dashQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Monthly revenue" value={inr(revenueMonthly)} icon={<IndianRupee className="size-4" />} loading={dashQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Total patients" value={totalPatients.toLocaleString("en-IN")} icon={<Users className="size-4" />} loading={dashQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Visits today" value={visitsToday.toLocaleString("en-IN")} icon={<Stethoscope className="size-4" />} loading={queueStatsQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Queue today" value={appointmentsToday.toLocaleString("en-IN")} icon={<CalendarDays className="size-4" />} loading={queueStatsQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Followups due" value={followupsToday.toLocaleString("en-IN")} icon={<BellRing className="size-4" />} loading={dashQ.isLoading} />

          {/* Queue at-a-glance */}
          <Card className="col-span-12">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-base">Today's queue</div>
              <Link to="/queue" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Open queue <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Waiting" value={queueWaiting} tone="gold" />
              <MiniStat label="In treatment" value={queueInTreatment} tone="primary" />
              <MiniStat label="Completed" value={queueCompleted} tone="success" />
              <MiniStat label="Missed patients" value={missedPatients} tone="destructive" icon={<UserX className="size-4" />} />
            </div>
          </Card>

          {/* Revenue trend */}
          <Card className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-display text-base">Revenue this week</div>
                <div className="text-xs text-muted-foreground">Daily collections · live from analytics</div>
              </div>
              {retentionRate > 0 && (
                <div className="text-xs text-muted-foreground">Retention {retentionRate.toFixed(0)}%</div>
              )}
            </div>
            <div className="h-56">
              {dashQ.isLoading ? (
                <Skeleton />
              ) : chartData.length === 0 ? (
                <EmptyChart message="No collections recorded yet." />
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="dash-rev" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.42 0.08 250)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="oklch(0.42 0.08 250)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
                    <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" fontSize={11} />
                    <YAxis stroke="oklch(0.52 0.06 285)" fontSize={11} />
                    <Tooltip formatter={(v: number) => inr(v)} />
                    <Area type="monotone" dataKey="total" stroke="oklch(0.42 0.08 250)" fill="url(#dash-rev)" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {revenueLost > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-700">
                <TrendingDown className="size-3.5" /> Estimated revenue lost from missed patients: {inr(revenueLost)}
              </div>
            )}
          </Card>


          {/* Quick actions */}
          <Card className="col-span-12 lg:col-span-4">
            <div className="font-display text-base mb-3 inline-flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Quick actions
            </div>
            <div className="grid gap-2">
              <QuickAction to="/patients" icon={<UserPlus className="size-4" />} label="Register patient" />
              <QuickAction to="/homeopathy/queue" icon={<PlayCircle className="size-4" />} label="Open today's queue" />
              <QuickAction to="/appointments" icon={<CalendarDays className="size-4" />} label="Manage appointments" />
              <QuickAction to="/staff" icon={<UserCog className="size-4" />} label="Manage staff" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  className = "", label, value, icon, loading,
}: { className?: string; label: string; value: string; icon: React.ReactNode; loading?: boolean }) {
  return (
    <Card className={className}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-display text-2xl mt-0.5 tabular-nums">
        {loading ? <span className="inline-block h-7 w-20 bg-muted/60 rounded animate-pulse" /> : value}
      </div>
    </Card>
  );
}

function Skeleton() {
  return <div className="h-full w-full rounded-lg bg-muted/40 animate-pulse" />;
}

function MiniStat({
  label, value, tone, icon,
}: { label: string; value: number; tone: "gold" | "primary" | "success" | "destructive"; icon?: React.ReactNode }) {
  const map = {
    gold: "from-gold/20 to-gold/5 text-foreground",
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-success/20 to-success/5 text-[color-mix(in_oklab,var(--success)_75%,black)]",
    destructive: "from-destructive/15 to-destructive/5 text-destructive",
  } as const;
  return (
    <div className={`rounded-xl border border-border p-4 bg-gradient-to-br ${map[tone]}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-display text-3xl tabular-nums mt-0.5">{(value || 0).toLocaleString("en-IN")}</div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-full grid place-items-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
      {message}
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 px-3 h-11 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm group"
    >
      <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center">{icon}</span>
      <span className="font-medium">{label}</span>
      <ArrowRight className="size-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

function OnboardingCard({ firstName, role }: { firstName: string; role: string | null }) {
  const steps = [
    { to: "/admin/settings", icon: <Building2 className="size-4" />, title: "Setup your clinic", desc: "Add clinic name, address, working hours and prescription header." },
    { to: "/reception/patients", icon: <UserPlus className="size-4" />, title: "Create your first patient", desc: "Register a patient to start building your records." },
    { to: "/homeopathy/queue", icon: <PlayCircle className="size-4" />, title: "Start your first visit", desc: "Move a patient into consultation and take the case." },
    { to: "/admin/staff-management", icon: <UserCog className="size-4" />, title: "Add your team", desc: "Invite a receptionist or assistant doctor." },
  ];
  return (
    <Card className="col-span-12">
      <div className="flex items-start gap-3 mb-5">
        <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Welcome to Vennova</div>
          <div className="font-display text-2xl leading-tight">Let's set up your clinic, {firstName}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Complete these four steps to get your {role === "homeopathy" ? "homeopathy " : ""}practice running.
            Your dashboard will fill in with real data as you start seeing patients.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {steps.map((s, i) => (
          <Link
            key={s.to}
            to={s.to}
            className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors group"
          >
            <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">{s.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums">STEP {i + 1}</span>
                <span>{s.title}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

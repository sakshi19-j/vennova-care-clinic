import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  IndianRupee, Users, CalendarDays, Stethoscope, BellRing, UserPlus,
  PlayCircle, Building2, UserCog, Loader2, AlertTriangle, ArrowRight, Sparkles,
} from "lucide-react";
import { Card } from "@/components/clinic/PageHeader";
import { dashboardService, type RevenuePoint } from "@/services/dashboard";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

// Pull first numeric value found under any of the given keys (defensive against
// loose backend schemas where field names may vary).
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

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function DashboardPage() {
  const { profile, clinicName, role } = useAuth();

  const summaryQ = useQuery({
    queryKey: ["dashboard", "summary-today"],
    queryFn: () => dashboardService.summaryToday(),
    staleTime: 30_000,
    retry: 1,
  });
  const monthlyQ = useQuery({
    queryKey: ["dashboard", "revenue-monthly"],
    queryFn: () => dashboardService.monthlyRevenue(),
    staleTime: 60_000,
    retry: 1,
  });
  const dailyQ = useQuery({
    queryKey: ["dashboard", "revenue-daily"],
    queryFn: () => dashboardService.dailyRevenue(),
    staleTime: 60_000,
    retry: 1,
  });
  const followupsQ = useQuery({
    queryKey: ["dashboard", "followups-today"],
    queryFn: () => dashboardService.followupsToday(),
    staleTime: 30_000,
    retry: 1,
  });
  const apptsQ = useQuery({
    queryKey: ["dashboard", "appointments-today"],
    queryFn: () => dashboardService.appointmentsToday(),
    staleTime: 30_000,
    retry: 1,
  });
  const patientsQ = useQuery({
    queryKey: ["dashboard", "patients-count"],
    queryFn: () => dashboardService.patientsCount(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const loading =
    summaryQ.isLoading || monthlyQ.isLoading || dailyQ.isLoading ||
    followupsQ.isLoading || apptsQ.isLoading || patientsQ.isLoading;

  const anyError =
    summaryQ.error || monthlyQ.error || dailyQ.error ||
    followupsQ.error || apptsQ.error || patientsQ.error;

  const revenueToday = pick(summaryQ.data, ["revenue_today", "revenue", "today", "amount"]);
  const visitsToday = pick(summaryQ.data, ["visits_today", "visits", "visit_count"]);
  const appointmentsToday = apptsQ.data?.length ?? pick(summaryQ.data, ["appointments_today", "appointments"]);
  const pendingFollowups = followupsQ.data?.length ?? pick(summaryQ.data, ["pending_followups", "followups_today"]);
  const totalPatients = patientsQ.data ?? pick(summaryQ.data, ["total_patients"]);
  const revenueMonthly = pick(monthlyQ.data, ["total", "amount", "revenue", "monthly"]);

  const chartData = useMemo(() => {
    const pts = dailyQ.data ?? [];
    return pts.slice(-30).map((p: RevenuePoint, i) => ({
      d: String(p.date ?? p.day ?? p.d ?? p.label ?? i + 1).slice(5),
      total: Number(p.total ?? p.amount ?? p.revenue ?? p.value ?? 0) || 0,
    }));
  }, [dailyQ.data]);

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
            label="Today's revenue" value={inr(revenueToday)} icon={<IndianRupee className="size-4" />} loading={summaryQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Monthly revenue" value={inr(revenueMonthly)} icon={<IndianRupee className="size-4" />} loading={monthlyQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Total patients" value={totalPatients.toLocaleString("en-IN")} icon={<Users className="size-4" />} loading={patientsQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Visits today" value={visitsToday.toLocaleString("en-IN")} icon={<Stethoscope className="size-4" />} loading={summaryQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Appointments today" value={appointmentsToday.toLocaleString("en-IN")} icon={<CalendarDays className="size-4" />} loading={apptsQ.isLoading} />
          <Kpi className="col-span-12 md:col-span-4 lg:col-span-2"
            label="Pending followups" value={pendingFollowups.toLocaleString("en-IN")} icon={<BellRing className="size-4" />} loading={followupsQ.isLoading} />

          {/* Revenue trend */}
          <Card className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-display text-base">Revenue trend</div>
                <div className="text-xs text-muted-foreground">Last 30 days · daily collections</div>
              </div>
            </div>
            <div className="h-56">
              {dailyQ.isLoading ? (
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
          </Card>

          {/* Quick actions */}
          <Card className="col-span-12 lg:col-span-4">
            <div className="font-display text-base mb-3 inline-flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Quick actions
            </div>
            <div className="grid gap-2">
              <QuickAction to="/reception/patients" icon={<UserPlus className="size-4" />} label="Register patient" />
              <QuickAction to="/homeopathy/queue" icon={<PlayCircle className="size-4" />} label="Open today's queue" />
              <QuickAction to="/reception/appointments" icon={<CalendarDays className="size-4" />} label="Manage appointments" />
              <QuickAction to="/admin/staff-management" icon={<UserCog className="size-4" />} label="Manage staff" />
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

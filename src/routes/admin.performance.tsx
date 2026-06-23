import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/clinic/PageHeader";
import { analyticsService } from "@/services/analytics";
import { dashboardService, asArray, type RevenuePoint } from "@/services/dashboard";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/performance")({
  component: PerformancePage,
});

type TopPatient = { name?: string; patient_name?: string; visits?: number; count?: number };

function PerformancePage() {
  const topPatientsQ = useQuery({
    queryKey: ["analytics", "patients", "top"],
    queryFn: () => analyticsService.topPatients(),
    staleTime: 60_000,
    retry: 1,
  });

  const dailyRevQ = useQuery({
    queryKey: ["analytics", "revenue", "daily"],
    queryFn: () => dashboardService.dailyRevenue(),
    staleTime: 60_000,
    retry: 1,
  });

  const followupsQ = useQuery({
    queryKey: ["analytics", "followups", "today"],
    queryFn: () => analyticsService.followupsToday(),
    staleTime: 30_000,
    retry: 1,
  });

  const top = asArray<TopPatient>(topPatientsQ.data);
  const daily = asArray<RevenuePoint>(dailyRevQ.data).map((p, i) => ({
    d: String(p.date ?? p.day ?? p.d ?? p.label ?? i + 1).slice(5, 10),
    total: Number(p.total ?? p.amount ?? p.revenue ?? p.value ?? 0) || 0,
  }));
  const followupsCount = Array.isArray(followupsQ.data) ? followupsQ.data.length : 0;

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12">
        <div className="font-display text-lg leading-tight">Performance</div>
        <div className="text-xs text-muted-foreground">Live retention, revenue trend and clinical follow-up performance.</div>
      </div>

      <Card className="col-span-12 md:col-span-4">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Follow-ups due today</div>
        <div className="font-display text-2xl mt-0.5 tabular-nums">
          {followupsQ.isLoading ? <Loader2 className="size-5 animate-spin" /> : followupsCount}
        </div>
      </Card>
      <Card className="col-span-12 md:col-span-4">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Active top patients</div>
        <div className="font-display text-2xl mt-0.5 tabular-nums">
          {topPatientsQ.isLoading ? <Loader2 className="size-5 animate-spin" /> : top.length}
        </div>
      </Card>
      <Card className="col-span-12 md:col-span-4">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Days of revenue data</div>
        <div className="font-display text-2xl mt-0.5 tabular-nums">
          {dailyRevQ.isLoading ? <Loader2 className="size-5 animate-spin" /> : daily.length}
        </div>
      </Card>

      <Card className="col-span-12">
        <div className="font-display text-base mb-2">Daily revenue</div>
        <div className="h-60">
          {dailyRevQ.isLoading ? (
            <div className="h-full w-full rounded-lg bg-muted/40 animate-pulse" />
          ) : dailyRevQ.error ? (
            <Empty><AlertTriangle className="size-4 inline mr-1.5" />Unable to load /analytics/revenue/daily</Empty>
          ) : daily.length === 0 ? (
            <Empty>No revenue recorded yet.</Empty>
          ) : (
            <ResponsiveContainer>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
                <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" fontSize={11} />
                <YAxis stroke="oklch(0.52 0.06 285)" fontSize={11} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" fill="oklch(0.42 0.08 250)" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="col-span-12 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b clinic-divider font-display text-base">Top patients (by visits)</div>
        {topPatientsQ.isLoading ? (
          <div className="p-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
        ) : topPatientsQ.error ? (
          <div className="p-6"><Empty><AlertTriangle className="size-4 inline mr-1.5" />Unable to load /analytics/patients/top</Empty></div>
        ) : top.length === 0 ? (
          <div className="p-6"><Empty>No patient activity yet.</Empty></div>
        ) : (
          <ul className="divide-y clinic-divider">
            {top.slice(0, 10).map((p, i) => (
              <li key={i} className="px-4 py-2 flex items-center text-[13px]">
                <span className="w-6 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1 font-medium">{p.name ?? p.patient_name ?? "—"}</span>
                <span className="text-muted-foreground tabular-nums">{p.visits ?? p.count ?? 0} visits</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full grid place-items-center text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6">
      {children}
    </div>
  );
}

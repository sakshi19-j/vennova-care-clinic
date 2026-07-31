import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { analyticsService } from "@/services/analytics";
import { dashboardService, asArray, type RevenuePoint } from "@/services/dashboard";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Vennova Clinic" },
      { name: "description", content: "Retention, follow-up adherence, treatment outcomes and revenue trends." },
      { property: "og:title", content: "Analytics — Vennova Clinic" },
      { property: "og:description", content: "Retention, follow-up adherence, treatment outcomes and revenue trends." },
      { property: "og:url", content: "https://vennova-care-clinic.lovable.app/analytics" },
      { name: "twitter:title", content: "Analytics — Vennova Clinic" },
      { name: "twitter:description", content: "Retention, follow-up adherence, treatment outcomes and revenue trends." },
    ],
    links: [{ rel: "canonical", href: "https://vennova-care-clinic.lovable.app/analytics" }],
  }),
  component: Analytics,
});

type Retention = { d30?: number; d60?: number; d90?: number; "30_day"?: number; "60_day"?: number; "90_day"?: number };
type Missed = { count?: number; total?: number };
type TopPatient = { name?: string; patient_name?: string; visits?: number; count?: number };

function num(v: unknown) { return typeof v === "number" && Number.isFinite(v) ? v : 0; }

function Analytics() {
  const dailyQ = useQuery({
    queryKey: ["analytics", "revenue", "daily"],
    queryFn: () => dashboardService.dailyRevenue(),
    staleTime: 60_000, retry: 1,
  });
  const retentionQ = useQuery({
    queryKey: ["analytics", "retention"],
    queryFn: () => analyticsService.retention(),
    staleTime: 60_000, retry: 1,
  });
  const missedQ = useQuery({
    queryKey: ["analytics", "missed"],
    queryFn: () => analyticsService.missedPatients(),
    staleTime: 60_000, retry: 1,
  });
  const topQ = useQuery({
    queryKey: ["analytics", "top"],
    queryFn: () => analyticsService.topPatients(),
    staleTime: 60_000, retry: 1,
  });

  const series = asArray<RevenuePoint>(dailyQ.data).map((p, i) => ({
    d: String(p.date ?? p.day ?? p.d ?? p.label ?? i + 1).slice(5, 10),
    total: Number(p.total ?? p.amount ?? p.revenue ?? p.value ?? 0) || 0,
  }));

  const r = (retentionQ.data ?? {}) as Retention;
  const retention = [
    ["30-day", num(r.d30 ?? r["30_day"])],
    ["60-day", num(r.d60 ?? r["60_day"])],
    ["90-day", num(r.d90 ?? r["90_day"])],
  ] as const;

  const missedCount = (() => {
    const m = missedQ.data as Missed | unknown[];
    if (Array.isArray(m)) return m.length;
    if (m && typeof m === "object") return num((m as Missed).count ?? (m as Missed).total);
    return 0;
  })();

  const top = asArray<TopPatient>(topQ.data);

  const anyError = dailyQ.error || retentionQ.error || missedQ.error || topQ.error;
  const loading = dailyQ.isLoading || retentionQ.isLoading || missedQ.isLoading || topQ.isLoading;

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="Live" title="Clinical Analytics"
        subtitle="Retention, follow-up performance and revenue — live from your backend." />

      {anyError && (
        <div className="mb-3 text-xs text-amber-700 inline-flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" /> Some analytics endpoints failed to load.
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8">
          <h2 className="font-display text-xl mb-1">Daily revenue</h2>
          <div className="text-xs text-muted-foreground mb-4">/analytics/revenue/daily</div>
          <div className="h-72">
            {dailyQ.isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
              : series.length === 0 ? <Empty>No revenue data.</Empty>
              : (
                <ResponsiveContainer>
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.38 0.16 285)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="oklch(0.38 0.16 285)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
                    <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" />
                    <YAxis stroke="oklch(0.52 0.06 285)" />
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    <Legend />
                    <Area type="monotone" dataKey="total" stroke="oklch(0.38 0.16 285)" fill="url(#g1)" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <h2 className="font-display text-xl mb-3">Retention</h2>
          {retentionQ.isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : (
            <div className="space-y-3">
              {retention.map(([l, v]) => (
                <div key={l as string}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}%</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-saffron" style={{ width: `${Math.min(100, v)}%` }} />
                  </div>
                </div>
              ))}
              {retention.every(([, v]) => v === 0) && (
                <div className="text-xs text-muted-foreground pt-2">No retention data yet.</div>
              )}
            </div>
          )}
        </Card>

        <Card className="col-span-12 lg:col-span-4 bg-[color-mix(in_oklab,var(--destructive)_5%,var(--card))] border-destructive/20">
          <h2 className="font-display text-xl mb-2">Missed follow-ups</h2>
          <div className="font-display text-6xl text-destructive tabular-nums">
            {missedQ.isLoading ? "…" : missedCount}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Patients overdue. Send a batch reminder to recover them.</p>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <h2 className="font-display text-xl mb-3">Top patients (lifetime)</h2>
          {topQ.isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
            : top.length === 0 ? <Empty>No patient data yet.</Empty>
            : (
              <ul className="divide-y clinic-divider">
                {top.slice(0, 10).map((p, i) => (
                  <li key={i} className="flex items-center gap-4 py-2.5 text-sm">
                    <span className="font-medium flex-1">{p.name ?? p.patient_name ?? "—"}</span>
                    <span className="text-muted-foreground">{num(p.visits ?? p.count)} visits</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      {loading && <div className="text-xs text-muted-foreground mt-4 inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Loading…</div>}
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

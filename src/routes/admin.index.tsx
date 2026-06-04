import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { IndianRupee, TrendingUp, TrendingDown, CreditCard, Banknote, Smartphone, Wifi, Users, UserPlus, Repeat, Award, Loader2 } from "lucide-react";
import { Card } from "@/components/clinic/PageHeader";
import {
  revenueHourly, revenue14d, revenue12m, paymentMix, paymentTrend14d,
} from "@/lib/admin-data";
import { rxRevenueToday } from "@/lib/reception-data";
import { api, ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/admin/")({
  component: RevenuePage,
});

type Range = "today" | "week" | "month" | "year";
const rangeLabels: Record<Range, string> = {
  today: "Today", week: "Last 14 days", month: "Last 30 days", year: "Last 12 months",
};

const modeIcons = { UPI: Smartphone, Cash: Banknote, Card: CreditCard, Online: Wifi } as const;

type RevenueAnalytics = {
  today?: number;
  weekly?: number;
  monthly?: number;
  total_patients?: number;
  new_patients?: number;
  returning_patients?: number;
  by_mode?: { CASH?: number; UPI?: number; CARD?: number; ONLINE?: number };
  top_referrers?: Array<{ name: string; count: number; contact?: string }>;
};

function RevenuePage() {
  const [range, setRange] = useState<Range>("today");
  const [live, setLive] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get<RevenueAnalytics>("/analytics/revenue")
      .then((d) => { if (alive) { setLive(d); setErr(null); } })
      .catch((e) => { if (alive) setErr(e instanceof ApiError ? e.message : (e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const series = useMemo(() => {
    if (range === "today") return revenueHourly;
    if (range === "year") return revenue12m;
    return revenue14d;
  }, [range]);

  const totals = useMemo(() => {
    const total = series.reduce((s, x) => s + x.total, 0);
    const allo = series.reduce((s, x) => s + x.allopathy, 0);
    const homeo = series.reduce((s, x) => s + x.homeopathy, 0);
    return { total, allo, homeo };
  }, [series]);

  const todayCollected = live?.today ?? rxRevenueToday.total;
  const weekly = live?.weekly ?? totals.total;
  const monthly = live?.monthly ?? totals.total;
  const totalPatients = live?.total_patients ?? 0;
  const newPatients = live?.new_patients ?? 0;
  const returningPatients = live?.returning_patients ?? Math.max(0, totalPatients - newPatients);

  const byMode = live?.by_mode ?? {
    CASH: rxRevenueToday.CASH, UPI: rxRevenueToday.UPI, CARD: rxRevenueToday.CARD, ONLINE: rxRevenueToday.ONLINE,
  };

  const paymentTotal = paymentMix.reduce((s, p) => s + p.value, 0);
  const referrers = live?.top_referrers ?? [];

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* range switcher */}
      <div className="col-span-12 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-display text-lg leading-tight inline-flex items-center gap-2">
            Revenue
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {err ? <span className="text-amber-600">Live data unavailable: {err} — showing local snapshot</span> : "Real-time collections from your backend."}
          </div>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-card border border-border">
          {(Object.keys(rangeLabels) as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={["px-3 h-8 rounded-lg text-xs font-medium transition-colors", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Today's collection</div>
        <div className="font-display text-2xl mt-0.5">₹{todayCollected.toLocaleString("en-IN")}</div>
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-success"><TrendingUp className="size-3.5" /> vs yesterday</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Weekly</div>
        <div className="font-display text-2xl mt-0.5">₹{weekly.toLocaleString("en-IN")}</div>
        <div className="text-xs text-muted-foreground mt-1">Last 7 days</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Monthly</div>
        <div className="font-display text-2xl mt-0.5">₹{monthly.toLocaleString("en-IN")}</div>
        <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pending</div>
        <div className="font-display text-2xl mt-0.5">₹1,900</div>
        <div className="text-xs text-muted-foreground mt-1">3 unpaid bills</div>
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600"><TrendingDown className="size-3.5" /> down 8%</div>
      </Card>

      {/* Patient mix */}
      <Card className="col-span-12 md:col-span-4">
        <div className="font-display text-base mb-3 inline-flex items-center gap-2"><Users className="size-4 text-primary" /> Patients</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Total" value={totalPatients} />
          <Stat label="New" value={newPatients} icon={<UserPlus className="size-3.5" />} />
          <Stat label="Returning" value={returningPatients} icon={<Repeat className="size-3.5" />} />
        </div>
      </Card>

      {/* By payment mode (live) */}
      <Card className="col-span-12 md:col-span-8">
        <div className="font-display text-base mb-3">Payment mode breakdown (today)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {([
            { name: "Cash" as const, value: byMode.CASH ?? 0 },
            { name: "UPI" as const, value: byMode.UPI ?? 0 },
            { name: "Card" as const, value: byMode.CARD ?? 0 },
            { name: "Online" as const, value: byMode.ONLINE ?? 0 },
          ]).map((p) => {
            const Icon = modeIcons[p.name];
            return (
              <div key={p.name} className="rounded-lg border border-border bg-muted/40 p-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" /> {p.name}</div>
                <div className="font-display text-xl mt-0.5">₹{p.value.toLocaleString("en-IN")}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Revenue trend */}
      <Card className="col-span-12 lg:col-span-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-display text-base">Revenue trend</div>
            <div className="text-xs text-muted-foreground">{rangeLabels[range]} · Allopathy vs Homeopathy</div>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="rv-allo" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.42 0.08 250)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.42 0.08 250)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rv-homeo" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.14 295)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.55 0.14 295)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <YAxis stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="allopathy" stroke="oklch(0.42 0.08 250)" fill="url(#rv-allo)" name="Allopathy" />
              <Area type="monotone" dataKey="homeopathy" stroke="oklch(0.55 0.14 295)" fill="url(#rv-homeo)" name="Homeopathy" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <div className="font-display text-base mb-1">Payment methods</div>
        <div className="text-xs text-muted-foreground mb-2">Lifetime share · ₹{paymentTotal.toLocaleString("en-IN")}</div>
        <div className="h-40">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={paymentMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {paymentMix.map((p) => <Cell key={p.name} fill={p.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid grid-cols-2 gap-1.5 mt-2 text-xs">
          {paymentMix.map((p) => {
            const Icon = modeIcons[p.name];
            return (
              <li key={p.name} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-muted/60">
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{p.name}</span>
                <span className="ml-auto tabular-nums">₹{p.value.toLocaleString("en-IN")}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="col-span-12">
        <div className="font-display text-base mb-2">Collections by payment method</div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={paymentTrend14d}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <YAxis stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="UPI" stackId="m" fill="oklch(0.55 0.14 295)" />
              <Bar dataKey="Cash" stackId="m" fill="oklch(0.78 0.14 75)" />
              <Bar dataKey="Card" stackId="m" fill="oklch(0.42 0.08 250)" />
              <Bar dataKey="Online" stackId="m" fill="oklch(0.38 0.16 285)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Referrals */}
      <Card className="col-span-12">
        <div className="flex items-center gap-2 mb-3">
          <Award className="size-4 text-primary" />
          <div className="font-display text-base">Referrals</div>
          <div className="text-xs text-muted-foreground">Patients who brought the most new patients</div>
        </div>
        {referrers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No referrals tracked yet.</div>
        ) : (
          <ul className="divide-y clinic-divider">
            {referrers.slice(0, 10).map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center gap-3 py-2.5">
                <span className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.name}</div>
                  {r.contact && <div className="text-xs text-muted-foreground">{r.contact}</div>}
                </div>
                <div className="font-display text-xl tabular-nums">{r.count}</div>
                <div className="text-xs text-muted-foreground">referrals</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-2.5 bg-muted/30">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">{icon}{label}</div>
      <div className="font-display text-xl mt-0.5">{value.toLocaleString("en-IN")}</div>
    </div>
  );
}

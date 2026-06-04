import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { IndianRupee, TrendingUp, TrendingDown, CreditCard, Banknote, Smartphone, Wifi } from "lucide-react";
import { Card } from "@/components/clinic/PageHeader";
import {
  revenueHourly, revenue14d, revenue12m, paymentMix, paymentTrend14d,
} from "@/lib/admin-data";
import { rxRevenueToday } from "@/lib/reception-data";

export const Route = createFileRoute("/admin/")({
  component: RevenuePage,
});

type Range = "today" | "week" | "month" | "year";

const rangeLabels: Record<Range, string> = {
  today: "Today",
  week: "Last 14 days",
  month: "Last 30 days",
  year: "Last 12 months",
};

const modeIcons = {
  UPI: Smartphone,
  Cash: Banknote,
  Card: CreditCard,
  Online: Wifi,
} as const;

function RevenuePage() {
  const [range, setRange] = useState<Range>("today");

  const series = useMemo(() => {
    if (range === "today") return revenueHourly;
    if (range === "year") return revenue12m;
    return revenue14d; // week / month both use the 14d set for the demo
  }, [range]);

  const totals = useMemo(() => {
    const total = series.reduce((s, x) => s + x.total, 0);
    const allo = series.reduce((s, x) => s + x.allopathy, 0);
    const homeo = series.reduce((s, x) => s + x.homeopathy, 0);
    return { total, allo, homeo };
  }, [series]);

  // headline KPI — today always shows live rxRevenueToday
  const headline = range === "today"
    ? { label: "Collected today", value: rxRevenueToday.total, sub: `${rxRevenueToday.count} bills` }
    : { label: `Total · ${rangeLabels[range]}`, value: totals.total, sub: `${series.length} ${range === "year" ? "months" : "days"}` };

  const paymentTotal = paymentMix.reduce((s, p) => s + p.value, 0);

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* range switcher */}
      <div className="col-span-12 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-display text-lg leading-tight">Revenue</div>
          <div className="text-xs text-muted-foreground">Collections in real time across branches and payment methods.</div>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-card border border-border">
          {(Object.keys(rangeLabels) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={[
                "px-3 h-8 rounded-lg text-xs font-medium transition-colors",
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{headline.label}</div>
        <div className="font-display text-2xl mt-0.5">₹{headline.value.toLocaleString("en-IN")}</div>
        <div className="text-xs text-muted-foreground mt-1">{headline.sub}</div>
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-success">
          <TrendingUp className="size-3.5" /> +12.4% vs prev
        </div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Allopathy</div>
        <div className="font-display text-2xl mt-0.5">₹{totals.allo.toLocaleString("en-IN")}</div>
        <div className="text-xs text-muted-foreground mt-1">{Math.round((totals.allo / Math.max(1, totals.total)) * 100)}% share</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Homeopathy</div>
        <div className="font-display text-2xl mt-0.5">₹{totals.homeo.toLocaleString("en-IN")}</div>
        <div className="text-xs text-muted-foreground mt-1">{Math.round((totals.homeo / Math.max(1, totals.total)) * 100)}% share</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pending</div>
        <div className="font-display text-2xl mt-0.5">₹1,900</div>
        <div className="text-xs text-muted-foreground mt-1">3 unpaid bills</div>
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600">
          <TrendingDown className="size-3.5" /> down 8%
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
              <Area type="monotone" dataKey="allopathy"  stroke="oklch(0.42 0.08 250)" fill="url(#rv-allo)"  name="Allopathy" />
              <Area type="monotone" dataKey="homeopathy" stroke="oklch(0.55 0.14 295)" fill="url(#rv-homeo)" name="Homeopathy" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Payment mix pie */}
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

      {/* Payment trend stacked bars */}
      <Card className="col-span-12">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-display text-base">Collections by payment method</div>
            <div className="text-xs text-muted-foreground">Last 14 days · stacked</div>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={paymentTrend14d}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <YAxis stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="UPI"    stackId="m" fill="oklch(0.55 0.14 295)" />
              <Bar dataKey="Cash"   stackId="m" fill="oklch(0.78 0.14 75)"  />
              <Bar dataKey="Card"   stackId="m" fill="oklch(0.42 0.08 250)" />
              <Bar dataKey="Online" stackId="m" fill="oklch(0.38 0.16 285)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Today’s mode chips */}
      <Card className="col-span-12">
        <div className="flex items-center gap-2 mb-2">
          <IndianRupee className="size-4 text-muted-foreground" />
          <div className="font-display text-base">Today’s collections by method</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {([
            { name: "Cash" as const,   value: rxRevenueToday.CASH },
            { name: "UPI" as const,    value: rxRevenueToday.UPI },
            { name: "Card" as const,   value: rxRevenueToday.CARD },
            { name: "Online" as const, value: rxRevenueToday.ONLINE },
          ]).map((p) => {
            const Icon = modeIcons[p.name];
            return (
              <div key={p.name} className="rounded-lg border border-border bg-muted/40 p-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="size-3.5" /> {p.name}
                </div>
                <div className="font-display text-xl mt-0.5">₹{p.value.toLocaleString("en-IN")}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

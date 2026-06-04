import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { revenue6m, patients } from "@/lib/clinic-data";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Vedic Clinic" },
      { name: "description", content: "Retention, follow-up adherence, treatment outcomes and revenue trends — analytics built for clinic operations." },
      { property: "og:title", content: "Clinical Analytics — Vedic Clinic" },
      { property: "og:description", content: "Retention, adherence and revenue trends over the last 6 months." },
    ],
    links: [{ rel: "canonical", href: "/analytics" }],
  }),
  component: Analytics,
});

function Analytics() {
  const top = [...patients].sort((a, b) => b.visits - a.visits).slice(0, 5);
  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="Last 6 months" title="Clinical Analytics"
        subtitle="Retention, follow-up adherence, treatment outcomes — built for clinic operations, not boardrooms." />

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8">
          <h2 className="font-display text-xl mb-1">Revenue & visits</h2>
          <div className="text-xs text-muted-foreground mb-4">Monthly trend</div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={revenue6m}>
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.38 0.16 285)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.38 0.16 285)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
                <XAxis dataKey="m" stroke="oklch(0.52 0.06 285)" />
                <YAxis stroke="oklch(0.52 0.06 285)" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="consult" stroke="oklch(0.38 0.16 285)" fill="url(#g1)" name="Consult" />
                <Area type="monotone" dataKey="medicine" stroke="oklch(0.78 0.14 75)" fill="oklch(0.78 0.14 75 / 0.2)" name="Medicine" />
                <Area type="monotone" dataKey="procedures" stroke="oklch(0.55 0.14 295)" fill="oklch(0.55 0.14 295 / 0.2)" name="Procedures" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <h2 className="font-display text-xl mb-3">Retention</h2>
          <div className="space-y-3">
            {[["30-day", 84],["60-day", 71],["90-day", 58]].map(([l, v]) => (
              <div key={l as string}>
                <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}%</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-saffron" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 h-40">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: "Adherence", value: 74, fill: "oklch(0.55 0.14 295)" }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-sm text-muted-foreground -mt-2">Follow-up adherence · 74%</div>
        </Card>

        <Card className="col-span-12 lg:col-span-4 bg-[color-mix(in_oklab,var(--destructive)_5%,var(--card))] border-destructive/20">
          <h2 className="font-display text-xl mb-2">Missed follow-ups</h2>
          <div className="font-display text-6xl text-destructive">23</div>
          <p className="text-sm text-muted-foreground mt-2">Patients overdue by 7+ days. Send a batch reminder to recover them.</p>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <h2 className="font-display text-xl mb-3">Top patients (lifetime)</h2>
          <ul className="divide-y clinic-divider">
            {top.map((p) => (
              <li key={p.id} className="flex items-center gap-4 py-2.5 text-sm">
                <span className="font-medium flex-1">{p.name}</span>
                <span className="text-muted-foreground">{p.visits} visits</span>
                <span className="font-medium tabular-nums">₹{(p.visits * 600).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

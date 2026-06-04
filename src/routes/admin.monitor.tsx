import { createFileRoute } from "@tanstack/react-router";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { useQueue } from "@/lib/queue-store";
import { doctorsPerf, auditEvents, timeAgo } from "@/lib/admin-data";
import { queueStatusStyles } from "@/lib/reception-data";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";
import {
  Activity, Stethoscope, UserCheck, Hourglass,
} from "lucide-react";

export const Route = createFileRoute("/admin/monitor")({
  component: MonitorPage,
});

function MonitorPage() {
  const queue = useQueue();
  const waiting     = queue.filter((q) => q.status === "WAITING").length;
  const checkedIn   = queue.filter((q) => q.status === "CHECKED_IN").length;
  const inTreatment = queue.filter((q) => q.status === "IN_TREATMENT").length;
  const completed   = queue.filter((q) => q.status === "COMPLETED").length;
  const walkins     = queue.filter((q) => q.visit_type === "WALKIN").length;
  const appts       = queue.filter((q) => q.visit_type === "APPOINTMENT").length;
  const avgWait     = queue.length
    ? Math.round(queue.reduce((s, q) => s + q.wait_minutes, 0) / queue.length)
    : 0;

  const visitMix = [
    { name: "Appointments", value: appts,   color: "oklch(0.42 0.08 250)" },
    { name: "Walk-ins",     value: walkins, color: "oklch(0.78 0.14 75)" },
  ];

  const tiles = [
    { label: "In queue",     value: waiting + checkedIn, sub: `${waiting} waiting · ${checkedIn} checked-in`, icon: Hourglass,  accent: "text-amber-600" },
    { label: "In treatment", value: inTreatment,         sub: "Currently with doctor",                       icon: Activity,   accent: "text-primary" },
    { label: "Completed",    value: completed,           sub: "Discharged today",                            icon: UserCheck,  accent: "text-success" },
    { label: "Avg wait",     value: `${avgWait}m`,       sub: "Across all patients",                         icon: Hourglass,  accent: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12">
        <div className="font-display text-lg leading-tight">Live monitor</div>
        <div className="text-xs text-muted-foreground">Current state of the clinic — queues, treatment, walk-ins vs appointments.</div>
      </div>

      {/* KPI tiles */}
      <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t.label}</div>
                <div className="font-display text-2xl mt-0.5">{t.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.sub}</div>
              </div>
              <div className={`size-8 rounded-lg bg-muted flex items-center justify-center ${t.accent}`}>
                <t.icon className="size-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Doctors live */}
      <Card className="col-span-12 lg:col-span-8 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b clinic-divider flex items-center justify-between">
          <div>
            <div className="font-display text-base">Doctors — live</div>
            <div className="text-xs text-muted-foreground">Patients treated today and currently in treatment</div>
          </div>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
              <th className="text-left font-medium py-2 px-4">Doctor</th>
              <th className="text-left font-medium py-2 px-2">Branch</th>
              <th className="text-left font-medium py-2 px-2">In Tx</th>
              <th className="text-left font-medium py-2 px-2">Done</th>
              <th className="text-left font-medium py-2 px-2">Avg</th>
              <th className="text-left font-medium py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {doctorsPerf.map((d) => (
              <tr key={d.id} className="border-b last:border-0 clinic-divider hover:bg-muted/50">
                <td className="py-2 px-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-muted text-[11px] font-medium flex items-center justify-center border border-border">{d.initials}</div>
                    <div className="font-medium">{d.name}</div>
                  </div>
                </td>
                <td className="py-2 px-2"><Tag className="bg-muted text-muted-foreground border-border">{d.branch}</Tag></td>
                <td className="py-2 px-2 tabular-nums">
                  {d.in_treatment_now > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-success pulse-dot" /> {d.in_treatment_now}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2 px-2 tabular-nums">{d.patients_today}</td>
                <td className="py-2 px-2 tabular-nums">{d.avg_consult_min}m</td>
                <td className="py-2 px-2">
                  <Tag className={d.on_duty ? "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30" : "bg-muted text-muted-foreground border-border"}>
                    <span className={`size-1.5 rounded-full ${d.on_duty ? "bg-success pulse-dot" : "bg-muted-foreground"}`} />
                    {d.on_duty ? "On duty" : "Off"}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Walk-ins vs appts */}
      <Card className="col-span-12 lg:col-span-4">
        <div className="font-display text-base mb-0.5">Walk-ins vs appointments</div>
        <div className="text-xs text-muted-foreground mb-2">Today’s queue composition</div>
        <div className="h-36">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={visitMix} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={3}>
                {visitMix.map((p) => <Cell key={p.name} fill={p.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 mt-2 text-xs">
          {visitMix.map((p) => (
            <li key={p.name} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              <span>{p.name}</span>
              <span className="ml-auto tabular-nums">{p.value}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Live queue */}
      <Card className="col-span-12 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b clinic-divider flex items-center justify-between">
          <div className="font-display text-base">Live queue</div>
          <div className="text-xs text-muted-foreground">{queue.length} patients on the board</div>
        </div>
        <ul className="divide-y clinic-divider">
          {queue.slice(0, 8).map((q) => {
            const st = queueStatusStyles[q.status];
            return (
              <li key={q.queue_id} className="px-4 py-2 flex items-center gap-2.5 text-[13px]">
                <div className="size-8 rounded-md bg-muted border border-border font-display text-sm flex items-center justify-center">
                  #{q.token_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{q.patient_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {q.visit_type === "WALKIN" ? "Walk-in" : "Appointment"}
                    {q.notes ? ` · ${q.notes}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                  {q.wait_minutes}m
                </div>
                <Tag className={st.pill}>
                  <span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}
                </Tag>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Activity stream */}
      <Card className="col-span-12 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b clinic-divider flex items-center justify-between">
          <div className="font-display text-base">Recent activity</div>
          <div className="text-xs text-muted-foreground">{auditEvents.length} events</div>
        </div>
        <ul className="divide-y clinic-divider">
          {auditEvents.slice(0, 8).map((e) => (
            <li key={e.id} className="px-4 py-2 flex items-center gap-2.5 text-[13px]">
              <div className={`size-2 rounded-full ${
                e.severity === "critical" ? "bg-destructive" :
                e.severity === "warn" ? "bg-amber-500" : "bg-blue-500"
              }`} />
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  <span className="font-medium">{e.actor}</span>
                  <span className="text-muted-foreground"> · {e.actor_role}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{e.action} → {e.target}</div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">{timeAgo(e.at)}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

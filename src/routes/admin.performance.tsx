import { createFileRoute } from "@tanstack/react-router";
import { Card, Tag } from "@/components/clinic/PageHeader";
import {
  doctorsPerf, dailyTasks, taskStatusStyles, patientCount14d,
} from "@/lib/admin-data";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const taskTotal = dailyTasks.reduce((s, t) => s + t.target, 0);
  const taskDone  = dailyTasks.reduce((s, t) => s + t.done, 0);
  const pct       = Math.round((taskDone / Math.max(1, taskTotal)) * 100);
  const missed    = dailyTasks.filter((t) => t.status === "MISSED").length;

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12">
        <div className="font-display text-lg leading-tight">Performance</div>
        <div className="text-xs text-muted-foreground">Daily task completion and doctor patient counts.</div>
      </div>

      {/* KPI strip */}
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Daily tasks</div>
        <div className="font-display text-2xl mt-0.5">{taskDone}<span className="text-sm text-muted-foreground">/{taskTotal}</span></div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div className="h-full bg-gradient-to-r from-primary to-saffron" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-muted-foreground mt-1">{pct}% complete</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Missed</div>
        <div className="font-display text-2xl mt-0.5">{missed}</div>
        <div className="text-xs text-muted-foreground mt-1">Tasks past due</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Patients today</div>
        <div className="font-display text-2xl mt-0.5">{doctorsPerf.reduce((s, d) => s + d.patients_today, 0)}</div>
        <div className="text-xs text-muted-foreground mt-1">Across {doctorsPerf.length} doctors</div>
      </Card>
      <Card className="col-span-12 md:col-span-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Avg satisfaction</div>
        <div className="font-display text-2xl mt-0.5">
          {Math.round(doctorsPerf.reduce((s, d) => s + d.satisfaction, 0) / doctorsPerf.length)}%
        </div>
        <div className="text-xs text-muted-foreground mt-1">Across doctors</div>
      </Card>

      {/* Receptionist tasks */}
      <Card className="col-span-12 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b clinic-divider flex items-center justify-between">
          <div>
            <div className="font-display text-base">Receptionist — daily checklist</div>
            <div className="text-xs text-muted-foreground">Reminders, follow-ups and end-of-day duties</div>
          </div>
        </div>
        <ul className="divide-y clinic-divider">
          {dailyTasks.map((t) => {
            const tpct = Math.round((t.done / Math.max(1, t.target)) * 100);
            const Icon = t.status === "DONE" ? CheckCircle2
              : t.status === "MISSED" ? AlertCircle : Clock;
            return (
              <li key={t.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Icon className={`size-4 ${
                    t.status === "DONE" ? "text-success" :
                    t.status === "MISSED" ? "text-destructive" : "text-muted-foreground"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-[13px]">{t.task}</div>
                    <div className="text-[11px] text-muted-foreground">{t.category} · {t.receptionist} · due {t.due_by}</div>
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground w-16 text-right">{t.done}/{t.target}</div>
                  <Tag className={taskStatusStyles[t.status]}>{t.status.replace("_", " ").toLowerCase()}</Tag>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5 ml-6">
                  <div className={`h-full ${
                    t.status === "MISSED" ? "bg-destructive" :
                    t.status === "DONE" ? "bg-success" : "bg-primary"
                  }`} style={{ width: `${tpct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Patient volume trend */}
      <Card className="col-span-12">
        <div className="font-display text-base mb-2">Patient volume — 14 days</div>
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={patientCount14d}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.018 85)" vertical={false} />
              <XAxis dataKey="d" stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <YAxis stroke="oklch(0.52 0.06 285)" fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="appointments" stackId="p" fill="oklch(0.42 0.08 250)" />
              <Bar dataKey="walkins"      stackId="p" fill="oklch(0.78 0.14 75)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}


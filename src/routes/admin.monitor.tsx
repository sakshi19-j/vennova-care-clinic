import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { api } from "@/lib/api-client";
import { asArray } from "@/services/dashboard";
import { normalizeQueueStatus } from "@/lib/queue-store";
import { formatWaitMinutes } from "@/lib/wait-time";
import { Activity, UserCheck, Hourglass, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/monitor")({
  component: MonitorPage,
});

type QueueRow = {
  queue_id?: string;
  id?: string;
  token_number?: number;
  patient_name?: string;
  status?: string;
  visit_type?: string;
  wait_minutes?: number;
  created_at?: string;
  check_in_time?: string;

  notes?: string;
};

const statusPill: Record<string, string> = {
  WAITING: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  IN_TREATMENT: "bg-primary/15 text-primary border-primary/30",
  BILLING_PENDING: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  COMPLETED: "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30",
};

function num(o: unknown, keys: string[]): number {
  if (!o || typeof o !== "object") return 0;
  const r = o as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

function MonitorPage() {
  const queueQ = useQuery({
    queryKey: ["queue", "today"],
    queryFn: () => api.get<unknown>("/queue/today"),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1,
  });
  // FIX 3: counts MUST come from /queue/stats/today (single source of truth).
  const statsQ = useQuery({
    queryKey: ["queue", "stats-today"],
    queryFn: () => api.get<Record<string, unknown>>("/queue/stats/today"),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1,
  });

  const rawQueue = asArray<QueueRow>(queueQ.data).map((q) => ({
    ...q,
    status: normalizeQueueStatus(q.status),
  }));

  const s = statsQ.data ?? {};
  const waiting = num(s, ["waiting"]);
  const inTreatment = num(s, ["in_treatment"]);
  const billing = num(s, ["billing_pending", "billing"]);
  const completed = num(s, ["completed"]);
  const avgWait = num(s, ["avg_wait_minutes", "avg_wait"]);

  const tiles = [
    { label: "Waiting", value: waiting, sub: "In queue", icon: Hourglass, accent: "text-amber-600" },
    { label: "In treatment", value: inTreatment, sub: "With doctor", icon: Activity, accent: "text-primary" },
    { label: "Billing pending", value: billing, sub: "At reception", icon: UserCheck, accent: "text-blue-600" },
    { label: "Avg wait", value: `${avgWait}m`, sub: `Across ${waiting} waiting`, icon: Hourglass, accent: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 flex items-end justify-between">
        <div>
          <h1 className="font-display text-lg leading-tight">Live monitor</h1>
          <div className="text-xs text-muted-foreground">Real-time state from /queue/today · auto-refresh 15s.</div>
        </div>
        {queueQ.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t.label}</div>
                <div className="font-display text-2xl mt-0.5 tabular-nums">{t.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.sub}</div>
              </div>
              <div className={`size-8 rounded-lg bg-muted flex items-center justify-center ${t.accent}`}>
                <t.icon className="size-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="col-span-12 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b clinic-divider flex items-center justify-between">
          <div className="font-display text-base">Live queue</div>
          <div className="text-xs text-muted-foreground">{rawQueue.length} patients · completed today: {completed}</div>
        </div>
        {queueQ.error ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="size-4 inline mr-1.5" />
            Unable to load /queue/today. Backend may not be reachable.
          </div>
        ) : rawQueue.length === 0 && !queueQ.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No patients in the queue.</div>
        ) : (
          <ul className="divide-y clinic-divider">
            {rawQueue.slice(0, 20).map((q) => (
              <li key={q.queue_id ?? q.id} className="px-4 py-2 flex items-center gap-2.5 text-[13px]">
                <div className="w-14 text-right tabular-nums shrink-0 size-8 rounded-md bg-muted border border-border font-display text-sm flex items-center justify-center">
                  #{q.token_number ?? "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{q.patient_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {q.visit_type === "WALKIN" ? "Walk-in" : q.visit_type === "APPOINTMENT" ? "Appointment" : (q.visit_type ?? "—")}
                    {q.notes ? ` · ${q.notes}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums w-24 text-right shrink-0">
                  {formatWaitMinutes(q.wait_minutes, q.check_in_time ?? q.created_at)}
                </div>
                <Tag className={statusPill[q.status ?? ""] ?? "bg-muted text-muted-foreground border-border"}>
                  {(q.status ?? "—").toString().toLowerCase().replace("_", " ")}
                </Tag>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

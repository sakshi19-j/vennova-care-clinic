import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, Tag, Avatar } from "@/components/clinic/PageHeader";
import {
  Clock, UserX, ArrowRight, Bell, Stethoscope, Loader2, AlertTriangle, Trash2, PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Live Queue — Vennova Clinic" },
      { name: "description", content: "Real-time clinic queue with token control, wait times, and one-click call-next." },
    ],
  }),
  component: QueuePage,
});

type QueueStatus = "WAITING" | "IN_TREATMENT" | "DONE" | "NO_SHOW";

type QueueItem = {
  id?: string;
  queue_id?: string;
  token_number: number;
  patient_id: string;
  patient_name: string;
  patient_phone?: string | null;
  status: QueueStatus;
  visit_type?: string | null;
  wait_minutes?: number;
  check_in_time?: string;
};

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["queue", "items", "data", "results"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.data as { detail?: unknown } | null;
    const detail = d?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const m = detail.map((x: { msg?: string }) => x?.msg || "").filter(Boolean).join("; ");
      if (m) return m;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function normalizedStatus(status: unknown): QueueStatus {
  const s = String(status ?? "WAITING").toUpperCase();
  if (s === "IN_CONSULTATION") return "IN_TREATMENT";
  if (s === "COMPLETED" || s === "BILLING") return "DONE";
  if (s === "NO_SHOW") return "NO_SHOW";
  if (s === "IN_TREATMENT") return "IN_TREATMENT";
  return "WAITING";
}

function queueId(q?: QueueItem): string {
  return String(q?.id ?? q?.queue_id ?? "");
}

const STATUS_BADGE: Record<QueueStatus, string> = {
  WAITING: "bg-amber-100 text-amber-800 border-amber-300",
  IN_TREATMENT: "bg-blue-100 text-blue-800 border-blue-300",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  NO_SHOW: "bg-rose-100 text-rose-800 border-rose-300",
};
const STATUS_LABEL: Record<QueueStatus, string> = {
  WAITING: "Waiting",
  IN_TREATMENT: "With Doctor",
  DONE: "Completed",
  NO_SHOW: "No-show",
};

function QueuePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const queueQ = useQuery({
    queryKey: ["queue", "today"],
    queryFn: async () => {
      const raw = await api.get<unknown>("/queue/today");
      return asArray<QueueItem>(raw).map((q) => ({ ...q, status: normalizedStatus(q.status) }));
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  const queue = queueQ.data ?? [];
  const waiting = queue.filter((q) => q.status === "WAITING");
  const inTreatment = queue.filter((q) => q.status === "IN_TREATMENT");
  const completed = queue.filter((q) => q.status === "DONE");
  const noShow = queue.filter((q) => q.status === "NO_SHOW");

  const callMut = useMutation({
    mutationFn: async (item: QueueItem) => {
      await api.post("/queue/next");
      const raw = await api.get<unknown>("/queue/today");
      const latest = asArray<QueueItem>(raw).map((q) => ({ ...q, status: normalizedStatus(q.status) }));
      return latest.find((q) => queueId(q) === queueId(item) && q.status === "IN_TREATMENT") ??
        latest.find((q) => q.status === "IN_TREATMENT") ?? item;
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ["queue", "today"] });
      const visitType = item.visit_type || "HOMEOPATHY";
      const id = queueId(item);
      navigate({
        to: "/consultation/$patientId",
        params: { patientId: item.patient_id },
        search: { queue_id: id, visit_type: visitType } as Record<string, string>,
      });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const noShowMut = useMutation({
    mutationFn: (id: string) => api.put(`/queue/${encodeURIComponent(id)}/no-show`),
    onSuccess: () => {
      toast.success("Marked as no-show");
      qc.invalidateQueries({ queryKey: ["queue", "today"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.delete(`/queue/${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Removed from queue");
      qc.invalidateQueries({ queryKey: ["queue", "today"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Live · auto-refresh every 10s"
        title="Queue Board"
        subtitle="Walk-in & appointment queue with token control and wait times."
        actions={
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => queueQ.refetch()}
            disabled={queueQ.isFetching}
          >
            {queueQ.isFetching ? <Loader2 className="size-4 mr-1 animate-spin" /> : <ArrowRight className="size-4 mr-1" />}
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {queueQ.error && (
            <Card className="border-amber-300 bg-amber-50">
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="size-4" />
                Couldn't load queue: {errMsg(queueQ.error)}
                <button onClick={() => queueQ.refetch()} className="ml-auto text-xs underline">Retry</button>
              </div>
            </Card>
          )}

          {inTreatment.length > 0 && (
            <Card className="bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_82%,black)] text-primary-foreground border-transparent">
              <div className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/70 mb-2 inline-flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-success pulse-dot" /> Currently with doctor
              </div>
              <ul className="space-y-2">
                {inTreatment.map((q) => (
                  <li key={q.id} className="flex items-center gap-3">
                    <span className="font-display text-saffron text-3xl">#{q.token_number}</span>
                    <div className="flex-1">
                      <div className="font-display text-2xl leading-tight">{q.patient_name}</div>
                      <div className="text-xs text-primary-foreground/70">{q.visit_type || "—"} · {q.patient_phone || ""}</div>
                    </div>
                    <button
                      onClick={() =>
                        navigate({
                          to: "/consultation/$patientId",
                          params: { patientId: q.patient_id },
                          search: { queue_id: q.id, visit_type: q.visit_type || "HOMEOPATHY" } as Record<string, string>,
                        })
                      }
                      className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm"
                    >
                      <Stethoscope className="size-4" /> Open case
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-2xl">Waiting · {waiting.length}</div>
              {queueQ.isFetching && <Loader2 className="size-4 text-muted-foreground animate-spin" />}
            </div>

            {queueQ.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : waiting.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No one waiting right now.</div>
            ) : (
              <ul className="divide-y clinic-divider">
                {waiting.map((q, idx) => {
                  const id = queueId(q);
                  const delayed = (q.wait_minutes ?? 0) > 20;
                  const busy = (callMut.isPending && queueId(callMut.variables) === id) ||
                    (noShowMut.isPending && noShowMut.variables === id) ||
                    (removeMut.isPending && removeMut.variables === id);
                  return (
                    <li key={id || `${q.patient_id}-${q.token_number}`} className="flex items-center gap-3 py-3 group">
                      <span className="font-mono text-xs text-muted-foreground w-10">#{q.token_number}</span>
                      <Avatar name={q.patient_name} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          {q.patient_name}
                          {idx === 0 && (
                            <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-gold/20 text-[color-mix(in_oklab,var(--gold)_30%,black)] border border-gold/30">
                              Up next
                            </span>
                          )}
                          {q.visit_type && <Tag className="bg-muted text-muted-foreground border-border">{q.visit_type}</Tag>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{q.patient_phone || "—"}</div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border font-medium ${STATUS_BADGE[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                      <div
                        className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
                          delayed ? "border-destructive/40 text-destructive bg-destructive/10" : "border-border text-muted-foreground"
                        }`}
                      >
                        <Clock className="size-3" /> {q.wait_minutes ?? 0}m
                      </div>
                      <button
                        title="Mark no-show"
                        disabled={busy}
                        onClick={() => noShowMut.mutate(id)}
                        className="px-2.5 h-8 text-xs rounded-lg border border-border hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 disabled:opacity-50"
                      >
                        <UserX className="size-3.5" />
                      </button>
                      <button
                        title="Remove from queue"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Remove ${q.patient_name} from queue?`)) removeMut.mutate(id);
                        }}
                        className="px-2.5 h-8 text-xs rounded-lg border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => callMut.mutate(q)}
                        className="px-3 h-8 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PhoneCall className="size-3.5" />}
                        Call
                      </button>
                      <Link
                        to="/consultation/$patientId"
                        params={{ patientId: q.patient_id }}
                        search={{ queue_id: id, visit_type: q.visit_type || "HOMEOPATHY" } as Record<string, string>}
                        className="px-3 h-8 text-xs rounded-lg bg-teal-600 text-white hover:bg-teal-700 inline-flex items-center gap-1"
                      >
                        <Stethoscope className="size-3.5" />
                        Start Consultation
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {(completed.length > 0 || noShow.length > 0) && (
            <Card>
              <div className="font-display text-2xl mb-3">Completed today</div>
              <ul className="divide-y clinic-divider">
                {[...completed, ...noShow].map((q) => (
                  <li key={queueId(q) || `${q.patient_id}-${q.token_number}`} className="flex items-center gap-3 py-3">
                    <span className="font-mono text-xs text-muted-foreground w-10">#{q.token_number}</span>
                    <Avatar name={q.patient_name} size={32} />
                    <div className="flex-1 min-w-0 font-medium truncate">{q.patient_name}</div>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border font-medium ${STATUS_BADGE[q.status]}`}>
                      {STATUS_LABEL[q.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card>
            <div className="font-display text-2xl mb-4">Today's stats</div>
            <div className="grid grid-cols-2 gap-3">
              <KPI value={waiting.length} label="Waiting" tone="gold" />
              <KPI value={inTreatment.length} label="In treatment" tone="primary" />
              <KPI value={completed.length} label="Completed" tone="success" />
              <KPI value={noShow.length} label="No-shows" tone="destructive" />
            </div>
          </Card>

          <Card className="bg-[color-mix(in_oklab,var(--saffron)_8%,var(--card))] border-saffron/30">
            <div className="font-display text-lg mb-2 inline-flex items-center gap-2">
              <Bell className="size-4 text-saffron" /> Live updates
            </div>
            <p className="text-sm text-muted-foreground">
              The queue auto-refreshes every 10 seconds. Tap <span className="text-foreground font-medium">Call</span>
              {" "}on the next waiting patient to start the consultation.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KPI({ value, label, tone }: { value: React.ReactNode; label: string; tone: "gold" | "primary" | "success" | "destructive" }) {
  const colorMap = {
    gold: "from-gold/20 to-gold/5 text-foreground",
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-success/20 to-success/5 text-[color-mix(in_oklab,var(--success)_75%,black)]",
    destructive: "from-destructive/15 to-destructive/5 text-destructive",
  };
  return (
    <div className={`rounded-xl border border-border p-4 bg-gradient-to-br ${colorMap[tone]}`}>
      <div className="font-display text-3xl tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

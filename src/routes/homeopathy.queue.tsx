import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { Loader2, ArrowRight, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/homeopathy/queue")({
  component: TodayList,
});

type QueueItem = {
  id: string;
  token_number: number;
  patient_id: string;
  patient_name: string;
  patient_phone?: string | null;
  status: string;
  visit_type?: string | null;
  wait_minutes?: number;
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
    const d = e.data as { detail?: unknown; message?: unknown } | null;
    const detail = d?.detail ?? d?.message;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ");
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

function TodayList() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["queue", "today"],
    queryFn: () => api.get<unknown>("/queue/today"),
    refetchInterval: 10000,
  });

  const items = asArray<QueueItem>(data);
  const waiting = items
    .filter((q) => q.status === "WAITING")
    .sort((a, b) => (a.token_number ?? 0) - (b.token_number ?? 0));

  const callNext = useMutation({
    mutationFn: async (q: QueueItem) => {
      try { await api.post("/queue/next"); } catch (e) { /* still navigate */ void e; }
      return q;
    },
    onSuccess: (q) => {
      navigate({
        to: "/consultation/$patientId",
        params: { patientId: q.patient_id },
        search: { queue_id: q.id, visit_type: q.visit_type || "HOMEOPATHY" } as Record<string, string>,
      });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-5">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b clinic-divider flex items-center justify-between">
          <div className="font-display text-xl">Waiting · {waiting.length}</div>
          <div className="text-xs text-muted-foreground">Live · refreshes every 10s</div>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
            <Loader2 className="size-4 animate-spin" /> Loading queue…
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-sm text-destructive">{errMsg(error)}</div>
        ) : waiting.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No patients waiting right now</div>
        ) : (
          <ul className="divide-y clinic-divider">
            {waiting.map((q) => (
              <li key={q.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap hover:bg-muted/40">
                <span className="font-mono text-sm w-12 text-muted-foreground shrink-0">#{q.token_number}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{q.patient_name}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {q.visit_type && (
                      <Tag className="bg-muted text-foreground/70 border-border">{q.visit_type}</Tag>
                    )}
                    <span className="inline-flex items-center gap-1"><Clock className="size-3" />{q.wait_minutes ?? 0}m</span>
                  </div>
                </div>
                <button
                  onClick={() => callNext.mutate(q)}
                  disabled={callNext.isPending}
                  className="h-9 px-3 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {callNext.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Call In <ArrowRight className="size-4" /></>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

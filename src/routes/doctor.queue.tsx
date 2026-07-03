import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { Loader2, ArrowRight, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatWaitMinutes } from "@/lib/wait-time";


export const Route = createFileRoute("/doctor/queue")({
  component: CaseTakingQueue,
});

type QueueItem = {
  id?: string;
  queue_id?: string;
  token_number: number;
  patient_id: string;
  patient_name: string;
  patient_phone?: string | null;
  status: string;
  visit_type?: string | null;
  wait_minutes?: number;
  created_at?: string | null;
  check_in_time?: string | null;

};

type PatientLite = { total_visits?: number; patient_type?: string };

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
    const raw = d?.detail ?? d?.message;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw))
      return raw.map((x: unknown) => (typeof x === "string" ? x : (x as { msg?: string })?.msg || JSON.stringify(x))).join(", ");
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

function statusBadge(s: string): string {
  const u = (s || "").toUpperCase();
  if (u === "WAITING") return "bg-amber-100 text-amber-800 border-amber-300";
  if (u === "IN_TREATMENT" || u === "IN_CONSULTATION") return "bg-teal-100 text-teal-800 border-teal-300";
  if (u === "BILLING_PENDING" || u === "BILLING") return "bg-violet-100 text-violet-800 border-violet-300";
  if (u === "DONE" || u === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-muted text-foreground/70 border-border";
}

function normalizedStatus(s: string): string {
  const u = (s || "WAITING").toUpperCase();
  if (u === "IN_CONSULTATION") return "IN_TREATMENT";
  if (u === "BILLING") return "BILLING_PENDING";
  return u;
}

// Statuses that should NOT appear in the doctor's active list.
const DOCTOR_HIDDEN = new Set(["BILLING_PENDING", "DONE", "COMPLETED", "NO_SHOW", "CANCELLED"]);

function queueId(q: QueueItem): string {
  return String(q.id ?? q.queue_id ?? "");
}

function CaseTakingQueue() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  // FIX 3: header count must come from /queue/stats/today (single source of truth).
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  // 60s tick so wait-time labels recalc without refetching the queue.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);


  const fetchQueue = async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get<unknown>("/queue/today"),
        api.get<Record<string, unknown>>("/queue/stats/today").catch(() => null),
      ]);
      const rows = asArray<QueueItem>(listRes);
      setQueue(rows);
      if (statsRes && typeof statsRes === "object") {
        const w = (statsRes as Record<string, unknown>).waiting;
        if (typeof w === "number") setWaitingCount(w);
        else if (typeof w === "string" && !Number.isNaN(Number(w))) setWaitingCount(Number(w));
      }
      setError(null);
      return rows;
    } catch (e) {
      setError(errMsg(e));
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // FIX 5: keep queue polling every 15s
    const id = setInterval(fetchQueue, 15000);
    return () => clearInterval(id);
  }, []);

  const goToConsultation = (patientId: string, mode: "new" | "followup", queueId?: string) => {
    const search: Record<string, string> = { mode };
    if (queueId) search.queue_id = queueId;
    navigate({ to: "/consultation/$patientId", params: { patientId }, search });
  };


  const handleCallIn = async (q: QueueItem) => {
    const id = queueId(q);
    if (callingId) return; // prevent double-click
    setCallingId(id);

    // FIX 5: optimistic local status update — no full refetch after Call In
    setQueue((prev) =>
      prev.map((row) => (queueId(row) === id ? { ...row, status: "IN_TREATMENT" } : row)),
    );

    try {
      // STEP 1: POST /queue/next
      const nextRes = await api.post<unknown>("/queue/next").catch((e) => {
        // If backend already advanced (or returned non-fatal), fall back to clicked row
        console.warn("[queue/next] non-fatal:", e);
        return {} as unknown;
      });
      const r = (nextRes && typeof nextRes === "object" ? (nextRes as Record<string, unknown>) : {});
      // STEP 2: extract patient_id (with fallback to clicked row)
      const patientId = (typeof r.patient_id === "string" && r.patient_id) || q.patient_id;
      const queueItemId =
        (typeof r.queue_item_id === "string" && r.queue_item_id) ||
        (typeof r.queue_id === "string" && r.queue_id) ||
        (typeof r.id === "string" && r.id) ||
        id;
      const visitId =
        (typeof r.visit_id === "string" && r.visit_id) || "";

      // STEP 3: detect followup vs new (non-fatal)
      let mode: "new" | "followup" = "new";
      try {
        const visits = await api.get<unknown>(
          `/visits/patient/${encodeURIComponent(patientId)}`,
          { query: { limit: 1 } },
        );
        const arr = Array.isArray(visits)
          ? visits
          : ((visits as any)?.items ?? (visits as any)?.visits ?? []);
        if (Array.isArray(arr) && arr.length > 0) mode = "followup";
      } catch {
        // default to new patient
      }

      // Persist active consultation context so the doctor can resume from Home.
      try {
        sessionStorage.setItem("active_visit_id", visitId || queueItemId);
        sessionStorage.setItem("active_patient_id", patientId);
        sessionStorage.setItem("active_patient_name", q.patient_name || "");
      } catch {
        /* ignore storage failures */
      }

      // FIX 2: navigate immediately to consultation — do NOT stay on queue page
      goToConsultation(patientId, mode, queueItemId);
    } catch (e) {
      // Revert optimistic update on real failure
      setQueue((prev) =>
        prev.map((row) => (queueId(row) === id ? { ...row, status: q.status } : row)),
      );
      toast.error(errMsg(e));
    } finally {
      setCallingId(null);
    }
  };



  return (
    <div className="space-y-5">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b clinic-divider flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display text-xl">Case-taking · {waitingCount ?? queue.filter((q) => !DOCTOR_HIDDEN.has(normalizedStatus(q.status))).length}</div>
            <div className="text-xs text-muted-foreground">Live · refreshes every 15s</div>
          </div>
          <button
            onClick={() => setShowWalkIn((v) => !v)}
            className="h-9 px-3 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white inline-flex items-center gap-1.5"
          >
            <UserPlus className="size-4" /> Start Walk-in
          </button>
        </div>

        {showWalkIn && (
          <div className="px-5 py-3 border-b clinic-divider bg-muted/30">
            <WalkInSearch
              onClose={() => setShowWalkIn(false)}
              onSelect={(p) => {
                setShowWalkIn(false);
                const tv = Number(
                  (p as unknown as { total_visits?: number }).total_visits ?? p.visit_count ?? 0,
                );
                goToConsultation(p.id, tv > 0 ? "followup" : "new");
              }}
            />

          </div>
        )}

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
            <Loader2 className="size-4 animate-spin" /> Loading queue…
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center text-sm text-destructive">{error}</div>
        ) : queue.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No patients waiting right now</div>
        ) : (
          <ul className="divide-y clinic-divider">
            {queue
              .filter((q) => !DOCTOR_HIDDEN.has(normalizedStatus(q.status)))
              .slice()
              .sort((a, b) => (a.token_number ?? 0) - (b.token_number ?? 0))
              .map((q) => {
                const id = queueId(q);
                const u = normalizedStatus(q.status);
                const isWaiting = u === "WAITING";
                return (
                  <li key={id || `${q.patient_id}-${q.token_number}`} className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap hover:bg-muted/40">
                    <span className="font-mono text-sm w-14 text-right text-muted-foreground tabular-nums shrink-0">#{q.token_number}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{q.patient_name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {q.visit_type && (
                          <Tag className="bg-muted text-foreground/70 border-border">{q.visit_type}</Tag>
                        )}
                         <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                           <Clock className="size-3" />
                           {formatWaitMinutes(q.wait_minutes, q.check_in_time ?? q.created_at)}
                         </span>
                         {q.patient_phone && (
                           <span className="font-mono text-[11px] whitespace-nowrap tabular-nums tracking-normal">
                             {q.patient_phone}
                           </span>
                         )}
                        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusBadge(u)}`}>
                          {u}
                        </span>
                      </div>
                    </div>
                    {isWaiting && (
                      <button
                        onClick={() => handleCallIn(q)}
                        disabled={callingId === id}
                        className="h-9 px-3 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {callingId === id ? <Loader2 className="size-4 animate-spin" /> : <>Call In <ArrowRight className="size-4" /></>}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function WalkInSearch({ onClose, onSelect }: { onClose: () => void; onSelect: (p: Patient) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const tref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tref.current) clearTimeout(tref.current);
    const term = q.trim();
    if (!term) { setResults([]); return; }
    tref.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await patientsService.list({ search: term, limit: 8 });
        setResults(r.items);
      } catch (e) {
        toast.error(errMsg(e));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (tref.current) clearTimeout(tref.current); };
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient by name, phone, registration no…"
            className="w-full h-10 pl-9 pr-3 rounded-full border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
          {loading && <Loader2 className="size-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <button onClick={onClose} className="size-9 grid place-items-center rounded-full border border-border hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      {q.trim() !== "" && (
        <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden max-h-72 overflow-y-auto">
          {results.length === 0 && !loading ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No matches</div>
          ) : (
            <ul className="divide-y clinic-divider">
              {results.map((p) => {
                const rec = p as unknown as Record<string, unknown>;
                const name = (typeof rec.full_name === "string" && rec.full_name) ||
                  [p.first_name, p.last_name].filter(Boolean).join(" ") || "";
                const phone = (typeof rec.phone === "string" && rec.phone) || p.phone_mobile || "";
                const reg = typeof p.reg_no === "number" && p.reg_no > 0 ? `VNC-${String(p.reg_no).padStart(4, "0")}` : "";
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => onSelect(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/60 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {phone || "—"}{reg ? ` · ${reg}` : ""}
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

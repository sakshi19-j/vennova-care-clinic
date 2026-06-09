import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { Loader2, ArrowRight, Clock, Search, UserPlus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { patientsService, type Patient } from "@/services/patients";

export const Route = createFileRoute("/doctor/queue")({
  component: CaseTakingQueue,
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
  if (u === "DONE" || u === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-muted text-foreground/70 border-border";
}

function CaseTakingQueue() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [showWalkIn, setShowWalkIn] = useState(false);

  const fetchQueue = async () => {
    try {
      const res = await api.get<unknown>("/queue/today");
      setQueue(asArray<QueueItem>(res));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 10000);
    return () => clearInterval(id);
  }, []);

  const goToConsultation = (patientId: string, visitType: string, totalVisits: number, queueId?: string) => {
    const mode = totalVisits > 0 ? "followup" : "new";
    const search: Record<string, string> = { visit_type: (visitType || "HOMEOPATHY").toUpperCase(), mode };
    if (queueId) search.queue_id = queueId;
    navigate({ to: "/consultation/$patientId", params: { patientId }, search });
  };

  const handleCallIn = async (q: QueueItem) => {
    setCallingId(q.id);
    try {
      try { await api.post("/queue/next"); } catch { /* still proceed */ }
      const p = await api.get<PatientLite>(`/patients/${encodeURIComponent(q.patient_id)}`);
      goToConsultation(q.patient_id, q.visit_type || p.patient_type || "HOMEOPATHY", Number(p?.total_visits ?? 0), q.id);
    } catch (e) {
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
            <div className="font-display text-xl">Case-taking · {queue.length}</div>
            <div className="text-xs text-muted-foreground">Live · refreshes every 10s</div>
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
                goToConsultation(
                  p.id,
                  ((p as unknown as { patient_type?: string }).patient_type || "HOMEOPATHY"),
                  Number((p as unknown as { total_visits?: number }).total_visits ?? p.visit_count ?? 0),
                );
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
              .slice()
              .sort((a, b) => (a.token_number ?? 0) - (b.token_number ?? 0))
              .map((q) => {
                const u = (q.status || "").toUpperCase();
                const isWaiting = u === "WAITING";
                return (
                  <li key={q.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap hover:bg-muted/40">
                    <span className="font-mono text-sm w-12 text-muted-foreground shrink-0">#{q.token_number}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{q.patient_name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {q.visit_type && (
                          <Tag className="bg-muted text-foreground/70 border-border">{q.visit_type}</Tag>
                        )}
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" />{q.wait_minutes ?? 0}m waiting</span>
                        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusBadge(q.status)}`}>
                          {q.status}
                        </span>
                      </div>
                    </div>
                    {isWaiting && (
                      <button
                        onClick={() => handleCallIn(q)}
                        disabled={callingId === q.id}
                        className="h-9 px-3 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {callingId === q.id ? <Loader2 className="size-4 animate-spin" /> : <>Call In <ArrowRight className="size-4" /></>}
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
                  [p.first_name, p.last_name].filter(Boolean).join(" ") || "Patient";
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
                        <div className="text-xs text-muted-foreground">
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

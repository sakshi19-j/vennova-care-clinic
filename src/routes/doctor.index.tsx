import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Avatar } from "@/components/clinic/PageHeader";
import { useQueue, queueActions } from "@/lib/queue-store";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import {
  PlayCircle, Coffee, Stethoscope, Users, BellRing, IndianRupee,
  ArrowRight, Loader2, AlertTriangle, ClipboardList, Search, History,
} from "lucide-react";

export const Route = createFileRoute("/doctor/")({
  head: () => ({ meta: [{ title: "Doctor — Vennova Clinic" }] }),
  component: DoctorDashboard,
});

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
function get(o: unknown, path: string[]): unknown {
  let cur: unknown = o;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

function DoctorDashboard() {
  const { profile, clinicName } = useAuth();
  const navigate = useNavigate();
  const list = useQueue();

  // Live KPIs straight from Railway backend — scoped to clinic by JWT.
  const statsQ = useQuery({
    queryKey: ["queue", "stats-today"],
    queryFn: () => api.get<Record<string, unknown>>("/queue/stats/today"),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  const dashQ = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get<Record<string, unknown>>("/analytics/dashboard"),
    staleTime: 60_000,
    retry: 1,
  });

  const current = useMemo(
    () => list.find((q) => q.status === "IN_TREATMENT"),
    [list],
  );
  const waiting = useMemo(
    () => list
      .filter((q) => q.status === "WAITING" || q.status === "CHECKED_IN")
      .sort((a, b) => (b.priority - a.priority) || (a.token_number - b.token_number)),
    [list],
  );

  const qs = statsQ.data ?? {};
  // FIX 3: counts come EXCLUSIVELY from /queue/stats/today. No local fallback.
  const waitingN = num(qs, ["waiting"]);
  const inTreatN = num(qs, ["in_treatment"]);
  const doneN = num(qs, ["completed"]);
  const followupsToday = num(get(dashQ.data, ["clinical", "followups_due_today"]), ["count", "total"]);
  const totalPatients = num(get(dashQ.data, ["patients", "total"]), ["count", "total"])
    || num(get(dashQ.data, ["patients"]), ["total", "count"]);
  const revenueToday = num(get(dashQ.data, ["revenue", "today"]), ["revenue", "total", "amount"]);

  const callIn = async (queueId: string, name: string) => {
    try {
      await queueActions.callIn(queueId, "ALLOPATHY");
      toast.success(`Calling ${name} · reception notified`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't call patient");
    }
  };

  const openConsult = (patientId: string, queueId: string) => {
    navigate({
      to: "/consultation/$patientId",
      params: { patientId },
      search: { queue_id: queueId } as never,
    });
  };

  const firstName = (profile?.full_name || "").split(" ")[0] || "Doctor";

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Greeting */}
      <div className="col-span-12 flex items-end justify-between flex-wrap gap-2">
        <div>
          <div className="font-display text-lg leading-tight inline-flex items-center gap-2">
            Welcome, Dr. {firstName}
            {(statsQ.isLoading || dashQ.isLoading) && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {clinicName ? `${clinicName} · ` : ""}Real-time data from your clinic.
          </div>
        </div>
        {(statsQ.error || dashQ.error) && (
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="size-3.5" /> Some widgets failed to load.
          </div>
        )}
      </div>

      {/* KPI tiles */}
      <Kpi className="col-span-6 md:col-span-3" label="Waiting" value={waitingN.toLocaleString("en-IN")} icon={<Users className="size-4" />} />
      <Kpi className="col-span-6 md:col-span-3" label="With me" value={inTreatN.toLocaleString("en-IN")} icon={<Stethoscope className="size-4" />} />
      <Kpi className="col-span-6 md:col-span-3" label="Completed today" value={doneN.toLocaleString("en-IN")} icon={<ClipboardList className="size-4" />} />
      <Kpi className="col-span-6 md:col-span-3" label="Follow-ups due" value={followupsToday.toLocaleString("en-IN")} icon={<BellRing className="size-4" />} />

      {/* Now seeing */}
      <Card className="col-span-12 lg:col-span-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Now seeing</div>
            <div className="font-display text-xl">
              {current ? `${current.patient_name} · #${current.token_number}` : "No patient with you right now"}
            </div>
          </div>
          {current ? (
            <button
              onClick={() => openConsult(current.patient_id, current.queue_id)}
              className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2"
            >
              Open consultation <ArrowRight className="size-4" />
            </button>
          ) : null}
        </div>
        {!current && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center mb-3">
              <Coffee className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              When reception sends a patient in, they'll appear here automatically.
            </p>
          </div>
        )}
      </Card>

      {/* Active queue */}
      <Card className="col-span-12 lg:col-span-4 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b clinic-divider">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Active queue</div>
            <div className="font-display text-base">{waiting.length} waiting</div>
          </div>
          <Link to="/doctor/queue" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Full queue <ArrowRight className="size-3" />
          </Link>
        </div>
        {waiting.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No one waiting. Take a breath ☕
          </div>
        ) : (
          <ul className="divide-y clinic-divider max-h-[420px] overflow-y-auto">
            {waiting.slice(0, 8).map((q) => (
              <li key={q.queue_id} className="px-4 py-3 flex items-center gap-3">
                <span className="font-mono text-xs w-8 text-right tabular-nums text-muted-foreground">#{q.token_number}</span>
                <Avatar name={q.patient_name} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{q.patient_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {q.visit_type === "APPOINTMENT" ? "Booked" : "Walk-in"} · {Math.max(0, q.wait_minutes)}m wait
                  </div>
                </div>
                <button
                  onClick={() => callIn(q.queue_id, q.patient_name)}
                  className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1.5"
                >
                  <PlayCircle className="size-3.5" /> Call in
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Practice snapshot */}
      <Card className="col-span-12 md:col-span-6">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
          <Users className="size-3.5" /> Total patients
        </div>
        <div className="font-display text-3xl mt-1 tabular-nums">{totalPatients.toLocaleString("en-IN")}</div>
        <div className="text-xs text-muted-foreground mt-1">Across all consultations.</div>
      </Card>
      <Card className="col-span-12 md:col-span-6">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
          <IndianRupee className="size-3.5" /> Today's revenue
        </div>
        <div className="font-display text-3xl mt-1 tabular-nums">{inr(revenueToday)}</div>
        <div className="text-xs text-muted-foreground mt-1">Collected through billing today.</div>
      </Card>
    </div>
  );
}

function Kpi({
  className = "", label, value, icon,
}: { className?: string; label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className={className}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-display text-2xl mt-0.5 tabular-nums">{value}</div>
    </Card>
  );
}

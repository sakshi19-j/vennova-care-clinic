import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHeader, Tag, Avatar } from "@/components/clinic/PageHeader";
import { queue, getPatient, completedToday, tagStyles } from "@/lib/clinic-data";
import { Pause, Plus, Clock, ArrowRight, UserX, Stethoscope, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/queue")({
  head: () => ({ meta: [{ title: "Live Queue — Vedic Clinic" }] }),
  component: Queue,
});

type FlowStatus = "WAITING" | "WITH DOCTOR" | "DONE" | "PAID";
const FLOW_NEXT: Record<FlowStatus, FlowStatus | null> = {
  WAITING: "WITH DOCTOR",
  "WITH DOCTOR": "DONE",
  DONE: "PAID",
  PAID: null,
};
const FLOW_BADGE: Record<FlowStatus, string> = {
  WAITING: "bg-amber-100 text-amber-800 border-amber-300",
  "WITH DOCTOR": "bg-blue-100 text-blue-800 border-blue-300",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  PAID: "bg-purple-100 text-purple-800 border-purple-300",
};

const statusColor: Record<string, string> = {
  waiting: "bg-gold/20 border-gold/40 text-[color-mix(in_oklab,var(--gold)_30%,black)]",
  "in-consult": "bg-success/20 border-success/40 text-[color-mix(in_oklab,var(--success)_70%,black)]",
  billing: "bg-primary/15 border-primary/30 text-primary",
  done: "bg-muted text-muted-foreground border-border",
  "no-show": "bg-destructive/15 border-destructive/30 text-destructive",
  emergency: "bg-saffron/30 border-saffron/40 text-[color-mix(in_oklab,var(--saffron)_70%,black)]",
};

function Queue() {
  const inConsult = queue.find((q) => q.status === "in-consult")!;
  const waiting = queue.filter((q) => q.status === "waiting");
  const inConsultPatient = getPatient(inConsult.patientId)!;
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const consultSeconds = inConsult.consultMin! * 60 + (tick % 60);
  const mm = String(Math.floor(consultSeconds / 60)).padStart(2, "0");
  const ss = String(consultSeconds % 60).padStart(2, "0");

  // Per-row flow status (WAITING → WITH DOCTOR → DONE → PAID)
  const [flowStatus, setFlowStatus] = useState<Record<string, FlowStatus>>(() => {
    const init: Record<string, FlowStatus> = {};
    waiting.forEach((q) => (init[q.token] = "WAITING"));
    return init;
  });
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const advanceFlow = async (rawToken: string | number, patientName: string) => {
    const token = String(rawToken);
    const current = flowStatus[token] ?? "WAITING";
    const next = FLOW_NEXT[current];
    if (!next) return;
    if (pending[token]) return;
    setPending((p) => ({ ...p, [token]: true }));
    try {
      await api.patch(`/queue/${encodeURIComponent(token)}/status`, { status: next });
      setFlowStatus((s) => ({ ...s, [token]: next }));
      toast.success(`${patientName} → ${next}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to update status";
      toast.error(message);
    } finally {
      setPending((p) => ({ ...p, [token]: false }));
    }
  };


  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Live · auto-refresh"
        title="Queue Board"
        subtitle="Walk-in & appointment queue. One-click call next, status colors, and live consultation timer."
        actions={
          <>
            <Button variant="outline" className="rounded-full"><Pause className="size-4 mr-1" /> Pause queue</Button>
            <Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> Add to queue</Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Now consulting hero */}
          <Card className="bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_82%,black)] text-primary-foreground border-transparent relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(800px 200px at 80% 0%, var(--saffron), transparent 60%)" }} />
            <div className="flex flex-wrap items-start justify-between gap-4 relative">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/70 mb-2 inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-success pulse-dot" /> Now consulting
                </div>
                <div className="flex items-end gap-3">
                  <span className="font-display text-saffron text-4xl">#{inConsult.token}</span>
                  <h2 className="font-display text-5xl leading-none">{inConsultPatient.name}</h2>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Tag className="bg-gold/20 text-gold border-gold/40">Follow-up</Tag>
                  {inConsultPatient.tags.includes("chronic") && <Tag className="bg-saffron/20 text-saffron border-saffron/30">Chronic</Tag>}
                  <span className="text-sm text-primary-foreground/80 inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {mm}:{ss}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/consultation/$visitId" params={{ visitId: "V-2058" }} className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/15">
                  <Stethoscope className="size-4" /> Open visit
                </Link>
                <button className="inline-flex items-center gap-2 px-5 h-10 rounded-full bg-gold text-gold-foreground font-medium hover:brightness-105">
                  Call next <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </Card>

          {/* Waiting list */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-2xl">Waiting · {waiting.length}</div>
              <div className="text-xs text-muted-foreground">Estimated next call in ~3m</div>
            </div>
            <ul className="divide-y clinic-divider">
              {waiting.map((q, idx) => {
                const p = getPatient(q.patientId)!;
                const delayed = q.waitingMin > 20;
                return (
                  <li
                    key={q.token}
                    role="button"
                    tabIndex={0}
                    onClick={() => advanceFlow(q.token, p.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        advanceFlow(q.token, p.name);
                      }
                    }}
                    aria-busy={pending[q.token] || undefined}
                    className="flex items-center gap-3 py-3 group cursor-pointer hover:bg-muted/40 rounded-md px-1 -mx-1 transition"
                  >
                    <span className="font-mono text-xs text-muted-foreground w-10">#{q.token}</span>
                    <Avatar name={p.name} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {p.name}
                        {idx === 0 && <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-gold/20 text-[color-mix(in_oklab,var(--gold)_30%,black)] border border-gold/30">Up next</span>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{p.age}/{p.sex}</span>
                        <span>·</span>
                        <span>Visit #{p.visits}</span>
                        <Tag className={tagStyles[q.type === "Follow-up" ? "follow-up" : "new"]}>{q.type}</Tag>
                        {q.priority && <Tag className={tagStyles[q.priority as keyof typeof tagStyles] || ""}>{q.priority}</Tag>}
                      </div>
                    </div>
                    <div className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full border ${delayed ? "border-destructive/40 text-destructive bg-destructive/10" : "border-border text-muted-foreground"}`}>
                      <Clock className="size-3" /> {q.waitingMin}m
                    </div>
                    <button className="px-2.5 h-8 text-xs rounded-lg border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive opacity-0 group-hover:opacity-100 transition">
                      <UserX className="size-3.5" />
                    </button>
                    <button className="px-3 h-8 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">Call</button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Completed today */}
          <Card>
            <div className="font-display text-2xl mb-3">Completed today</div>
            <ul className="divide-y clinic-divider">
              {completedToday.map((c) => {
                const p = getPatient(c.patientId)!;
                return (
                  <li key={c.token} className="flex items-center gap-3 py-3">
                    <span className="font-mono text-xs text-muted-foreground w-10">#{c.token}</span>
                    <Avatar name={p.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{c.type}</div>
                    </div>
                    <Tag className={statusColor[c.status]}>{c.status === "no-show" ? "No-show" : "Seen"}</Tag>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card>
            <div className="font-display text-2xl mb-4">Today's stats</div>
            <div className="grid grid-cols-2 gap-3">
              <KPI value={waiting.length} label="Waiting" tone="gold" />
              <KPI value="11m" label="Avg wait" tone="primary" />
              <KPI value={2} label="Seen" tone="success" />
              <KPI value={1} label="No-shows" tone="destructive" />
            </div>
          </Card>

          <Card>
            <div className="font-display text-xl mb-3">Status legend</div>
            <ul className="space-y-2 text-sm">
              {[
                ["waiting", "Waiting"],
                ["in-consult", "In consultation"],
                ["billing", "At billing"],
                ["done", "Completed"],
                ["no-show", "No-show"],
                ["emergency", "Emergency"],
              ].map(([k, l]) => (
                <li key={k} className="flex items-center gap-2">
                  <Tag className={statusColor[k]}>{l}</Tag>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-[color-mix(in_oklab,var(--saffron)_8%,var(--card))] border-saffron/30">
            <div className="font-display text-lg mb-2 inline-flex items-center gap-2"><Bell className="size-4 text-saffron" /> Smart priority</div>
            <p className="text-sm text-muted-foreground mb-3">
              The queue auto-promotes elderly, children and emergencies. Drag tokens to override.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Tag className={tagStyles.elderly}>elderly</Tag>
              <Tag className={tagStyles.child}>child</Tag>
              <Tag className={statusColor.emergency}>emergency</Tag>
              <Tag className={tagStyles["follow-up"]}>repeat follow-up</Tag>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KPI({ value, label, tone }: { value: any; label: string; tone: "gold" | "primary" | "success" | "destructive" }) {
  const colorMap = {
    gold: "from-gold/20 to-gold/5 text-foreground",
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-success/20 to-success/5 text-[color-mix(in_oklab,var(--success)_75%,black)]",
    destructive: "from-destructive/15 to-destructive/5 text-destructive",
  };
  return (
    <div className={`rounded-xl border border-border p-4 bg-gradient-to-br ${colorMap[tone]}`}>
      <div className="font-display text-3xl">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

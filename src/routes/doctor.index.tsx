import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, Avatar } from "@/components/clinic/PageHeader";
import { useQueue, queueActions } from "@/lib/queue-store";
import { getClinical, commonDrugs, frequencyLabel, type RxLine, type Frequency } from "@/lib/doctor-data";
import {
  PlayCircle, CheckCircle2, Plus, Trash2, Pill, Coffee,
} from "lucide-react";

export const Route = createFileRoute("/doctor/")({
  component: NowSeeing,
});

function NowSeeing() {
  const list = useQueue();
  const current = list.find((q) => q.status === "IN_TREATMENT");
  const nextWaiting = list
    .filter((q) => q.status === "WAITING" || q.status === "CHECKED_IN")
    .sort((a, b) => (b.priority - a.priority) || (a.token_number - b.token_number))[0];

  if (!current) return <EmptyState next={nextWaiting} />;
  return <ConsultPanel queueId={current.queue_id} key={current.queue_id} />;
}

function EmptyState({ next }: { next?: ReturnType<typeof useQueue>[number] }) {
  return (
    <Card className="text-center py-16">
      <div className="mx-auto size-16 rounded-full bg-muted grid place-items-center mb-4">
        <Coffee className="size-7 text-muted-foreground" />
      </div>
      <div className="font-display text-2xl mb-1">No patient with you right now</div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        When reception sends a patient in, they'll appear here automatically.
      </p>
      {next ? (
        <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-border p-3 pr-4 bg-card">
          <Avatar name={next.patient_name} />
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Next in line</div>
            <div className="font-medium">#{next.token_number} · {next.patient_name}</div>
          </div>
          <button
            onClick={() => { queueActions.callIn(next.queue_id, "ALLOPATHY"); toast.success(`Calling ${next.patient_name} · reception notified`); }}
            className="ml-2 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2"
          >
            <PlayCircle className="size-4" /> Call in now
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No one waiting. Take a breath ☕</p>
      )}
    </Card>
  );
}

function ConsultPanel({ queueId }: { queueId: string }) {
  const list = useQueue();
  const q = list.find((x) => x.queue_id === queueId);
  if (!q) return null;

  const rec = getClinical(q.patient_id);

  const [lines, setLines] = useState<RxLine[]>([]);
  const [advice, setAdvice] = useState("");
  const [followupDays, setFollowupDays] = useState<number | null>(7);
  const [diagnosis, setDiagnosis] = useState("");

  const addLine = (preset?: Partial<RxLine>) => {
    setLines((l) => [
      ...l,
      {
        id: `rx-${Date.now()}-${l.length}`,
        drug: preset?.drug ?? "",
        dose: preset?.dose ?? "1 tab",
        frequency: (preset?.frequency as Frequency) ?? "BD",
        duration_days: preset?.duration_days ?? 5,
        notes: preset?.notes ?? "",
      },
    ]);
  };
  const updateLine = (id: string, patch: Partial<RxLine>) =>
    setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeLine = (id: string) => setLines((l) => l.filter((x) => x.id !== id));

  const markDone = () => {
    if (!diagnosis.trim()) return toast.error("Add diagnosis before marking done");
    if (lines.length === 0) {
      const ok = window.confirm("No prescription added. Mark visit done anyway?");
      if (!ok) return;
    }
    queueActions.complete(queueId);
    toast.success(`${q.patient_name} — visit completed. Sent to billing.`);
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* LEFT: Patient at a glance */}
      <aside className="col-span-12 lg:col-span-4 space-y-4">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={q.patient_name} size={56} />
            <div className="flex-1 min-w-0">
              <div className="font-display text-2xl leading-tight truncate">{q.patient_name}</div>
            </div>
          </div>
        </Card>

        {/* History */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-lg">Patient history</div>
            <Link to="/doctor/patients/$id" params={{ id: q.patient_id }} className="text-xs text-primary hover:underline">Full record →</Link>
          </div>
          <ol className="relative pl-4 space-y-3">
            <span className="absolute left-1 top-1 bottom-1 w-px bg-border" />
            {rec.history.length === 0 && <li className="text-xs text-muted-foreground">No prior visits.</li>}
            {rec.history.map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[10px] top-1.5 size-2 rounded-full bg-muted-foreground ring-2 ring-background" />
                <div className="text-[11px] text-muted-foreground">{h.date}</div>
                <div className="text-sm">{h.complaint}</div>
                <div className="text-xs text-primary inline-flex items-center gap-1 mt-0.5"><Pill className="size-3" /> {h.rx}</div>
              </li>
            ))}
          </ol>
        </Card>
      </aside>

      {/* RIGHT: Diagnose + Prescription + Done */}
      <section className="col-span-12 lg:col-span-8 space-y-5">
        <Card>
          <Step n={1} title="Diagnosis" hint="One line is enough." />
          <input
            value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute pharyngitis with low-grade fever"
            className="w-full h-11 px-3.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Card>

        <Card>
          <Step n={2} title="Prescription" hint="Tap a common drug or add a custom one. Edit dose & duration inline." />

          <div className="flex flex-wrap gap-1.5 mb-3">
            {commonDrugs.map((d) => (
              <button key={d.drug} onClick={() => addLine(d)}
                className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-background hover:bg-muted inline-flex items-center gap-1">
                <Plus className="size-3" /> {d.drug}
              </button>
            ))}
          </div>

          {lines.length === 0 ? (
            <button onClick={() => addLine()} className="w-full h-12 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted inline-flex items-center justify-center gap-2">
              <Plus className="size-4" /> Add medicine
            </button>
          ) : (
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <li key={l.id} className="rounded-xl border border-border bg-background p-3 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 md:col-span-1 text-xs text-muted-foreground font-mono">{i + 1}.</div>
                  <input value={l.drug} onChange={(e) => updateLine(l.id, { drug: e.target.value })}
                    placeholder="Drug name + strength"
                    className="col-span-12 md:col-span-4 h-10 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
                  <input value={l.dose} onChange={(e) => updateLine(l.id, { dose: e.target.value })}
                    placeholder="Dose"
                    className="col-span-6 md:col-span-2 h-10 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
                  <select value={l.frequency} onChange={(e) => updateLine(l.id, { frequency: e.target.value as Frequency })}
                    className="col-span-6 md:col-span-2 h-10 px-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                    {(Object.keys(frequencyLabel) as Frequency[]).map((f) => (
                      <option key={f} value={f}>{f} — {frequencyLabel[f]}</option>
                    ))}
                  </select>
                  <div className="col-span-9 md:col-span-2 inline-flex items-center gap-1">
                    <input type="number" min={1} value={l.duration_days}
                      onChange={(e) => updateLine(l.id, { duration_days: Number(e.target.value) || 1 })}
                      className="w-full h-10 px-2 rounded-lg border border-input bg-card text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring/40" />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                  <button onClick={() => removeLine(l.id)} title="Remove"
                    className="col-span-3 md:col-span-1 size-10 ml-auto grid place-items-center rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
              <button onClick={() => addLine()} className="w-full h-10 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted inline-flex items-center justify-center gap-2">
                <Plus className="size-4" /> Add another
              </button>
            </ul>
          )}
        </Card>

        <Card>
          <Step n={3} title="Advice & follow-up" hint="Plain-language instructions for the patient." />
          <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3}
            placeholder="e.g. Drink warm fluids, rest 2 days, return if fever above 102°F."
            className="w-full rounded-xl border border-input bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-1">Follow-up in</span>
            {[3, 7, 15, 30].map((d) => (
              <button key={d} onClick={() => setFollowupDays(d)}
                className={`h-8 px-3 rounded-full text-xs border ${followupDays === d ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                {d} days
              </button>
            ))}
            <button onClick={() => setFollowupDays(null)}
              className={`h-8 px-3 rounded-full text-xs border ${followupDays === null ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
              No follow-up
            </button>
          </div>
        </Card>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10">
          <Card className="!p-3 flex items-center gap-3 shadow-lg">
            <div className="flex-1 text-sm">
              <div className="font-medium">{q.patient_name}</div>
              <div className="text-xs text-muted-foreground">
                {lines.length} medicine{lines.length === 1 ? "" : "s"} · {followupDays ? `Follow-up in ${followupDays}d` : "No follow-up"}
              </div>
            </div>
            <button onClick={() => queueActions.callIn(queueId)} className="hidden md:inline-flex h-10 px-3 rounded-full text-sm border border-border hover:bg-muted">
              Save draft
            </button>
            <button onClick={markDone}
              className="h-11 px-5 rounded-full bg-success text-white font-medium hover:brightness-105 inline-flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Mark done & send to billing
            </button>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium">{n}</span>
        <div className="font-display text-xl">{title}</div>
      </div>
      <p className="text-xs text-muted-foreground ml-8 mt-0.5">{hint}</p>
    </div>
  );
}

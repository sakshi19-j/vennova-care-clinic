import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Avatar } from "@/components/clinic/PageHeader";
import { useQueue, queueActions, refreshAll } from "@/lib/queue-store";
import { isHomeoPatient } from "./homeopathy";
import { api, ApiError } from "@/lib/api-client";
import { BillingModal, type BillingPaymentMode } from "@/components/clinic/BillingModal";
import {
  getCase, commonRemedies, potencies, forms, repetitions, repetitionLabel,
  modalityChips,
  type RemedyLine, type Potency, type RemedyForm, type Repetition,
} from "@/lib/homeopathy-data";
import {
  PlayCircle, CheckCircle2, Plus, Trash2, Sparkles, Coffee, Sun, CloudRain,
} from "lucide-react";

type PreviousVisit = {
  visit_id: string;
  date: string;
  chief_complaint?: string;
  remedy?: string;
  potency?: string;
};


export const Route = createFileRoute("/homeopathy/")({
  component: NowSeeing,
});

function NowSeeing() {
  const list = useQueue().filter((q) => isHomeoPatient(q.patient_id));
  const current = list.find((q) => q.status === "IN_TREATMENT");
  const nextWaiting = list
    .filter((q) => q.status === "WAITING" || q.status === "CHECKED_IN")
    .sort((a, b) => (b.priority - a.priority) || (a.token_number - b.token_number))[0];

  if (!current) return <EmptyState next={nextWaiting} />;
  return <CasePanel queueId={current.queue_id} key={current.queue_id} />;
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
            onClick={() => { queueActions.callIn(next.queue_id, "HOMEOPATHY"); toast.success(`Calling ${next.patient_name} · reception notified`); }}
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

function CasePanel({ queueId }: { queueId: string }) {
  const list = useQueue();
  const q = list.find((x) => x.queue_id === queueId);
  if (!q) return null;

  const rec = getCase(q.patient_id);

  const [lines, setLines] = useState<RemedyLine[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [mentals, setMentals] = useState("");
  const [betterFrom, setBetterFrom] = useState<string[]>([]);
  const [worseFrom, setWorseFrom] = useState<string[]>([]);
  const [advice, setAdvice] = useState("");
  const [followupDays, setFollowupDays] = useState<number | null>(15);
  const [billingOpen, setBillingOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [previous, setPrevious] = useState<PreviousVisit[]>([]);

  // Load previous visits from API (Rule 4 - Step 2)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<any>("/visits", { query: { patient_id: q.patient_id, limit: 5 } });
        const rows = Array.isArray(data) ? data : data?.visits ?? [];
        if (!cancelled && Array.isArray(rows)) {
          setPrevious(rows.map((v: any) => ({
            visit_id: String(v.visit_id ?? v.id ?? ""),
            date: String(v.date ?? v.created_at ?? "").slice(0, 10),
            chief_complaint: v.chief_complaint ?? undefined,
            remedy: v.remedy ?? v.case?.remedy ?? undefined,
            potency: v.potency ?? v.case?.potency ?? undefined,
          })));
        }
      } catch {
        // keep local mock history fallback
      }
    })();
    return () => { cancelled = true; };
  }, [q.patient_id]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const addLine = (preset?: Partial<RemedyLine>) => {
    setLines((l) => [
      ...l,
      {
        id: `rx-${Date.now()}-${l.length}`,
        remedy: preset?.remedy ?? "",
        potency: (preset?.potency as Potency) ?? "30C",
        form: (preset?.form as RemedyForm) ?? "Globules",
        dose: preset?.dose ?? "4 globules",
        repetition: (preset?.repetition as Repetition) ?? "TDS",
        duration_days: preset?.duration_days ?? 5,
        notes: preset?.notes ?? "",
      },
    ]);
  };
  const updateLine = (id: string, patch: Partial<RemedyLine>) =>
    setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeLine = (id: string) => setLines((l) => l.filter((x) => x.id !== id));

  const openBilling = () => {
    if (!diagnosis.trim()) return toast.error("Add a diagnosis / clinical impression first");
    if (lines.length === 0) {
      const ok = window.confirm("No remedy added. Send to billing anyway?");
      if (!ok) return;
    }
    setBillingOpen(true);
  };

  const handleClose = async (fee: number, mode: BillingPaymentMode) => {
    setClosing(true);
    const primary = lines[0];
    try {
      // Step 3a — create the visit
      const visitRes = await api.post<{ id?: string; visit_id?: string }>("/visits", {
        patient_id: q.patient_id,
        type: "HOMEOPATHY",
        chief_complaint: diagnosis,
        notes: [mentals, advice].filter(Boolean).join("\n\n") || null,
      });
      const visitId = visitRes?.visit_id ?? visitRes?.id ?? q.visit_id ?? q.queue_id;

      // Step 3b — save the homeopathy case (best-effort)
      try {
        await api.post("/homeopathy-cases", {
          visit_id: visitId,
          patient_id: q.patient_id,
          chief_complaint: diagnosis,
          remedy: primary?.remedy ?? null,
          potency: primary?.potency ?? null,
          repetition: primary?.repetition ?? null,
          remedies: lines.map((l) => ({
            remedy: l.remedy, potency: l.potency, form: l.form,
            dose: l.dose, repetition: l.repetition, duration_days: l.duration_days,
          })),
          rubrics: [],
          mind_symptoms: mentals || null,
          history_present: null,
          history_past: null,
          better_from: betterFrom,
          worse_from: worseFrom,
          advice: advice || null,
          followup_days: followupDays,
        });
      } catch (err) {
        console.warn("[homeopathy-cases] save failed", err);
      }

      // Step 4 — close the visit with fee + payment mode
      await api.post(`/visits/${encodeURIComponent(String(visitId))}/close`, {
        fee, payment_mode: mode,
      });

      queueActions.complete(queueId);
      setBillingOpen(false);
      toast.success("Payment collected. Follow-ups scheduled.");
      void refreshAll();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message
        : err instanceof Error ? err.message
        : "Failed to close visit";
      toast.error(msg);
    } finally {
      setClosing(false);
    }
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
            <Link to="/homeopathy/patients/$id" params={{ id: q.patient_id }} className="text-xs text-primary hover:underline">Full record →</Link>
          </div>
          <ol className="relative pl-4 space-y-3">
            <span className="absolute left-1 top-1 bottom-1 w-px bg-border" />
            {(previous.length > 0
              ? previous.map((h) => ({ date: h.date, complaint: h.chief_complaint ?? "Visit", remedy: h.remedy ?? "—" }))
              : rec.history
            ).length === 0 && <li className="text-xs text-muted-foreground">No prior visits.</li>}
            {(previous.length > 0
              ? previous.map((h) => ({ date: h.date, complaint: h.chief_complaint ?? "Visit", remedy: h.remedy ?? "—" }))
              : rec.history
            ).map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[10px] top-1.5 size-2 rounded-full bg-muted-foreground ring-2 ring-background" />
                <div className="text-[11px] text-muted-foreground">{h.date}</div>
                <div className="text-sm">{h.complaint}</div>
                <div className="text-xs text-primary inline-flex items-center gap-1 mt-0.5"><Sparkles className="size-3" /> {h.remedy}</div>
              </li>
            ))}
          </ol>

        </Card>
      </aside>

      {/* RIGHT */}
      <section className="col-span-12 lg:col-span-8 space-y-5">
        <Card>
          <Step n={1} title="Today's case" hint="Mental state & key modalities you noticed in this visit." />
          <input
            value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Clinical impression — e.g. Acute coryza on Sulphur background"
            className="w-full h-11 px-3.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <textarea
            value={mentals} onChange={(e) => setMentals(e.target.value)} rows={2}
            placeholder="Mental & emotional notes today (e.g. weeping, irritable, anxious anticipation)…"
            className="mt-2 w-full rounded-xl border border-input bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <ModalityPicker label="Better from" tone="success" icon={<Sun className="size-3" />} options={modalityChips.better} value={betterFrom} onToggle={(v) => toggle(betterFrom, setBetterFrom, v)} />
            <ModalityPicker label="Worse from" tone="destructive" icon={<CloudRain className="size-3" />} options={modalityChips.worse} value={worseFrom} onToggle={(v) => toggle(worseFrom, setWorseFrom, v)} />
          </div>
        </Card>

        <Card>
          <Step n={2} title="Remedy" hint="Tap a common remedy or build your own. Edit potency, form & repetition inline." />

          <div className="flex flex-wrap gap-1.5 mb-3">
            {commonRemedies.map((d) => (
              <button key={d.remedy} onClick={() => addLine(d)} title={d.hint}
                className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-background hover:bg-muted inline-flex items-center gap-1">
                <Plus className="size-3" /> {d.remedy} <span className="text-muted-foreground">{d.potency}</span>
              </button>
            ))}
          </div>

          {lines.length === 0 ? (
            <button onClick={() => addLine()} className="w-full h-12 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted inline-flex items-center justify-center gap-2">
              <Plus className="size-4" /> Add remedy
            </button>
          ) : (
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <li key={l.id} className="rounded-xl border border-border bg-background p-3 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 md:col-span-1 text-xs text-muted-foreground font-mono">{i + 1}.</div>
                  <input value={l.remedy} onChange={(e) => updateLine(l.id, { remedy: e.target.value })}
                    placeholder="Remedy name"
                    className="col-span-12 md:col-span-3 h-10 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
                  <select value={l.potency} onChange={(e) => updateLine(l.id, { potency: e.target.value as Potency })}
                    className="col-span-4 md:col-span-2 h-10 px-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                    {potencies.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={l.form} onChange={(e) => updateLine(l.id, { form: e.target.value as RemedyForm })}
                    className="col-span-8 md:col-span-2 h-10 px-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                    {forms.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={l.repetition} onChange={(e) => {
                      const r = e.target.value as Repetition;
                      updateLine(l.id, { repetition: r, duration_days: r === "Single Dose" || r === "Stat" ? 0 : l.duration_days || 5 });
                    }}
                    className="col-span-7 md:col-span-2 h-10 px-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                    {repetitions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="col-span-4 md:col-span-1 inline-flex items-center gap-1">
                    <input type="number" min={0} value={l.duration_days}
                      disabled={l.repetition === "Single Dose" || l.repetition === "Stat"}
                      onChange={(e) => updateLine(l.id, { duration_days: Number(e.target.value) || 0 })}
                      className="w-full h-10 px-2 rounded-lg border border-input bg-card text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50" />
                  </div>
                  <button onClick={() => removeLine(l.id)} title="Remove"
                    className="col-span-1 size-10 ml-auto grid place-items-center rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                  <input value={l.dose} onChange={(e) => updateLine(l.id, { dose: e.target.value })}
                    placeholder="Dose (e.g. 4 globules / 5 drops in water)"
                    className="col-span-12 h-9 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
                  <div className="col-span-12 text-[11px] text-muted-foreground italic">
                    {l.remedy || "Remedy"} {l.potency} · {l.form} · {repetitionLabel[l.repetition]}{l.duration_days ? ` × ${l.duration_days} days` : ""}
                  </div>
                </li>
              ))}
              <button onClick={() => addLine()} className="w-full h-10 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted inline-flex items-center justify-center gap-2">
                <Plus className="size-4" /> Add another remedy
              </button>
            </ul>
          )}
        </Card>

        <Card>
          <Step n={3} title="Advice & follow-up" hint="Diet, lifestyle, and when to return." />
          <textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3}
            placeholder="e.g. Avoid coffee, mint & camphor. Note any change in symptoms in a diary. Return if no improvement in 7 days."
            className="w-full rounded-xl border border-input bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-1">Follow-up in</span>
            {[7, 15, 30, 60].map((d) => (
              <button key={d} onClick={() => setFollowupDays(d)}
                className={`h-8 px-3 rounded-full text-xs border ${followupDays === d ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                {d} days
              </button>
            ))}
            <button onClick={() => setFollowupDays(null)}
              className={`h-8 px-3 rounded-full text-xs border ${followupDays === null ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
              Wait & watch
            </button>
          </div>
        </Card>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10">
          <Card className="!p-3 flex items-center gap-3 shadow-lg">
            <div className="flex-1 text-sm">
              <div className="font-medium">{q.patient_name}</div>
              <div className="text-xs text-muted-foreground">
                {lines.length} remedy{lines.length === 1 ? "" : "ies"} · {followupDays ? `Follow-up in ${followupDays}d` : "Wait & watch"}
              </div>
            </div>
            <button onClick={openBilling}
              className="h-11 px-5 rounded-full bg-success text-white font-medium hover:brightness-105 inline-flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Mark done & send to billing
            </button>
          </Card>
        </div>
      </section>

      <BillingModal
        open={billingOpen}
        patientName={q.patient_name}
        defaultFee={q.fee || 500}
        saving={closing}
        onCancel={() => !closing && setBillingOpen(false)}
        onConfirm={handleClose}
      />
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


function ModalityPicker({
  label, tone, icon, options, value, onToggle,
}: {
  label: string;
  tone: "success" | "destructive";
  icon: React.ReactNode;
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
}) {
  const wrap = tone === "success" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5";
  const head = tone === "success" ? "text-success" : "text-destructive";
  const active = tone === "success" ? "bg-success text-white border-success" : "bg-destructive text-white border-destructive";
  return (
    <div className={`rounded-xl border p-3 ${wrap}`}>
      <div className={`text-[11px] uppercase tracking-widest inline-flex items-center gap-1 mb-2 ${head}`}>{icon} {label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button key={o} onClick={() => onToggle(o)}
              className={`text-xs px-2 py-1 rounded-md border ${on ? active : "bg-background border-border text-foreground/80 hover:bg-muted"}`}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Tag } from "@/components/clinic/PageHeader";
import { getPatient, visitTimeline, tagStyles } from "@/lib/clinic-data";
import { Save, ArrowRight, Clock, Check, Sparkles, Sun, Sunset, Moon, Plus, Star, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/consultation/$visitId")({
  head: () => ({ meta: [{ title: "Consultation — Vedic Clinic" }] }),
  component: Consultation,
});

const steps = ["Vitals", "Allopathy", "Homeopathy", "Prescription", "Billing & Close"];

function Consultation() {
  const { visitId } = Route.useParams();
  const p = getPatient("P-1042")!;
  const [step, setStep] = useState(2);

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Sticky patient context bar */}
      <div className="sticky top-14 -mx-6 px-6 z-20 bg-background/85 backdrop-blur border-b clinic-divider mb-5">
        <div className="flex items-center gap-4 py-3">
          <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm">
            {p.name.split(" ").map((s) => s[0]).join("")}
          </div>
          <div>
            <div className="font-medium leading-tight">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.age}/{p.sex} · Visit #{p.visits} · {p.constitution} · {p.miasm}</div>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-2">
            {p.tags.map((t) => <Tag key={t} className={tagStyles[t]}>{t}</Tag>)}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> Visit timer 18:24
          </div>
        </div>
      </div>

      <PageHeader
        eyebrow={`Visit · ${visitId} · ${p.name}`}
        title="Consultation Workspace"
        subtitle="Patient history, timeline and notes — all auto-saved. Step through vitals, dual-system notes, prescription and billing."
        actions={
          <>
            <Button variant="outline" className="rounded-full"><Save className="size-4 mr-1" /> Save & exit</Button>
            <Button className="rounded-full bg-primary" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>
              Next: {steps[Math.min(steps.length - 1, step + 1)]} <ArrowRight className="size-4 ml-1" />
            </Button>
          </>
        }
      />

      {/* Stepper */}
      <Card className="mb-5">
        <ol className="flex flex-wrap items-center gap-2">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s} className="flex items-center gap-2">
                <button onClick={() => setStep(i)} className={`h-9 px-3.5 rounded-full text-sm border inline-flex items-center gap-2 transition ${
                  active ? "bg-primary text-primary-foreground border-primary"
                  : done ? "bg-success/15 border-success/30 text-[color-mix(in_oklab,var(--success)_70%,black)]"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
                }`}>
                  <span className={`size-5 rounded-full flex items-center justify-center text-[10px] ${
                    active ? "bg-white/20" : done ? "bg-success/30" : "bg-muted"
                  }`}>{done ? <Check className="size-3" /> : i + 1}</span>
                  {s}
                </button>
                {i < steps.length - 1 && <span className="w-6 h-px bg-border" />}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        {/* LEFT: Sticky history + timeline */}
        <aside className="col-span-12 lg:col-span-3 space-y-5">
          <Card>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Vitals (saved)</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Vital label="BP" value="118/76" />
              <Vital label="Pulse" value="72" />
              <Vital label="Temp" value="98.4°F" />
              <Vital label="SpO₂" value="98%" />
              <Vital label="Weight" value="58 kg" />
              <Vital label="Height" value="162 cm" />
            </div>
          </Card>

          <Card>
            <div className="font-display text-lg mb-3">Visit timeline</div>
            <ol className="relative pl-5">
              <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
              {visitTimeline.map((v, i) => (
                <li key={i} className="relative pb-4 last:pb-0">
                  <span className={`absolute -left-[14px] top-1 size-2.5 rounded-full ${v.trend === "up" ? "bg-success" : "bg-muted-foreground"} ring-2 ring-background`} />
                  <div className="text-xs text-muted-foreground">{v.date}</div>
                  <div className="text-sm mt-0.5">{v.note}</div>
                  <div className="text-[11px] mt-1 text-primary inline-flex items-center gap-1">
                    <Activity className="size-3" /> {v.remedy}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </aside>

        {/* CENTER: Active step workspace */}
        <section className="col-span-12 lg:col-span-6 space-y-5">
          {step === 2 && <HomeopathyStep />}
          {step === 3 && <PrescriptionStep />}
          {step !== 2 && step !== 3 && (
            <Card>
              <div className="font-display text-2xl mb-3">{steps[step]}</div>
              <p className="text-muted-foreground text-sm">This step auto-saves as you write.</p>
              <textarea className="mt-4 w-full min-h-[260px] rounded-xl border border-border bg-background/60 p-4 text-sm outline-none focus:ring-2 focus:ring-ring/40" placeholder={`Write ${steps[step].toLowerCase()} notes…`} />
            </Card>
          )}
        </section>

        {/* RIGHT: Shortcuts + suggestions */}
        <aside className="col-span-12 lg:col-span-3 space-y-5">
          <Card>
            <div className="font-display text-lg mb-2 inline-flex items-center gap-2"><Star className="size-4 text-saffron" /> Favourite remedies</div>
            <ul className="space-y-1 text-sm">
              {["Pulsatilla 200C — 3 doses, alt. days","Nux Vomica 30C — TDS for 5d","Sulphur 200C — single dose","Lycopodium 1M — single dose","Calc Phos 6X — BD for 14d"].map((r) => (
                <li key={r} className="flex items-center justify-between gap-2 group hover:bg-muted/60 rounded-md px-2 py-1.5">
                  <span className="truncate">{r}</span>
                  <button className="opacity-0 group-hover:opacity-100 text-xs text-primary"><Plus className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="bg-[color-mix(in_oklab,var(--saffron)_8%,var(--card))] border-saffron/30">
            <div className="font-display text-lg mb-2 inline-flex items-center gap-2"><Sparkles className="size-4 text-saffron" /> Suggested follow-up</div>
            <div className="flex flex-wrap gap-1.5">
              <Tag className={tagStyles["follow-up"]}>+7 days</Tag>
              <Tag className={tagStyles["follow-up"]}>+15 days</Tag>
              <Tag className={tagStyles["follow-up"]}>+30 days</Tag>
            </div>
          </Card>
          <Card>
            <div className="font-display text-lg mb-2">Shortcuts</div>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li><kbd className="px-1.5 py-0.5 rounded border border-border bg-background">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded border border-border bg-background">S</kbd> Save & next</li>
              <li><kbd className="px-1.5 py-0.5 rounded border border-border bg-background">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded border border-border bg-background">K</kbd> Quick search</li>
              <li><kbd className="px-1.5 py-0.5 rounded border border-border bg-background">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded border border-border bg-background">Enter</kbd> Add to RX</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5 bg-background/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-base">{value}</div>
    </div>
  );
}

function HomeopathyStep() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <span className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</span>
        <div className="font-display text-2xl">Homeopathy</div>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Constitution, miasm & remedy selection.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Constitution" value="Phosphoric" />
        <Field label="Miasm" value="Psoric" />
        <Field label="Mentals" value="Anxious, sensitive to noise" />
        <Field label="Modalities" value="Worse evening, better warmth" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Field label="Remedy" value="Pulsatilla" />
        <Field label="Potency" value="200C" />
        <Field label="Dose" value="3 doses, alt. days" />
      </div>
      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
        <textarea className="w-full min-h-[160px] rounded-xl border border-border bg-background/60 p-4 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          defaultValue="Patient reports improved sleep since last visit. Continue current potency. Re-evaluate in 2 weeks." />
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input defaultValue={value} className="w-full h-10 px-3 rounded-lg border border-border bg-background/60 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
    </div>
  );
}

function PrescriptionStep() {
  const items = [
    { name: "Pulsatilla 200C", inst: "3 doses, alternate days", schedule: { m: 1, a: 0, n: 0 } },
    { name: "Sac Lac globules", inst: "TDS for 14 days", schedule: { m: 1, a: 1, n: 1 } },
    { name: "Calc Phos 6X", inst: "BD for 14 days", schedule: { m: 1, a: 0, n: 1 } },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-2xl">Prescription</div>
          <p className="text-sm text-muted-foreground">Visual dosage with morning / afternoon / night.</p>
        </div>
        <Button variant="outline" className="rounded-full"><Plus className="size-4 mr-1" /> Add medicine</Button>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.name} className="rounded-xl border border-border p-3.5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{it.name}</div>
              <div className="text-xs text-muted-foreground">{it.inst}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <DoseChip on={!!it.schedule.m} icon={<Sun className="size-3.5" />} label="M" />
              <DoseChip on={!!it.schedule.a} icon={<Sunset className="size-3.5" />} label="A" />
              <DoseChip on={!!it.schedule.n} icon={<Moon className="size-3.5" />} label="N" />
            </div>
            <div className="font-mono text-sm tabular-nums w-14 text-right text-muted-foreground">
              {it.schedule.m}-{it.schedule.a}-{it.schedule.n}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DoseChip({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div className={`size-8 rounded-full inline-flex flex-col items-center justify-center border ${
      on ? "bg-gold/25 border-gold/50 text-[color-mix(in_oklab,var(--gold)_25%,black)]" : "bg-muted border-border text-muted-foreground/50"
    }`} title={label}>
      {icon}
    </div>
  );
}

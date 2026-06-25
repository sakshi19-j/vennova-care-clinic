import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, Rocket, SkipForward } from "lucide-react";
import {
  ONBOARDING_STEPS,
  getCompletedSteps,
  setStepComplete,
  setStepIncomplete,
  dismissOnboarding,
} from "@/lib/onboarding";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Set up your clinic — Vennova Clinic" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState(() => getCompletedSteps());
  const [idx, setIdx] = useState(() => {
    const completed = getCompletedSteps();
    const first = ONBOARDING_STEPS.findIndex((s) => !completed.has(s.id));
    return first < 0 ? 0 : first;
  });

  const step = ONBOARDING_STEPS[idx];
  const total = ONBOARDING_STEPS.length;
  const completedCount = ONBOARDING_STEPS.filter((s) => done.has(s.id)).length;
  const pct = Math.round((completedCount / total) * 100);

  const markDone = () => {
    setStepComplete(step.id);
    const next = new Set(done);
    next.add(step.id);
    setDone(next);
    if (idx < total - 1) setIdx(idx + 1);
  };

  const toggleStep = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) { next.delete(id); setStepIncomplete(id); }
    else { next.add(id); setStepComplete(id); }
    setDone(next);
  };

  const skip = () => {
    dismissOnboarding();
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10 bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 h-7 rounded-full bg-primary/10 text-primary text-[11px] uppercase tracking-widest font-medium">
            <Rocket className="size-3.5" /> First-time setup
          </div>
          <h1 className="font-display text-3xl md:text-4xl mt-3">Let's get your clinic running</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {completedCount} of {total} steps done · {pct}% complete
          </p>
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-6">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Step {idx + 1} of {total}
          </div>
          <h2 className="font-display text-2xl mt-1">{step.title}</h2>
          <p className="text-muted-foreground mt-2">{step.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              to={step.href}
              className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5 hover:opacity-90"
            >
              Open this step <ArrowRight className="size-4" />
            </Link>
            <button
              onClick={markDone}
              className="h-10 px-4 rounded-full border border-border text-sm hover:bg-muted inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-4" /> Mark done & continue
            </button>
          </div>

          <div className="mt-8 border-t clinic-divider pt-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">All steps</div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {ONBOARDING_STEPS.map((s, i) => {
                const isDone = done.has(s.id);
                const isActive = i === idx;
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm cursor-pointer ${
                      isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setIdx(i)}
                  >
                    <button onClick={(e) => { e.stopPropagation(); toggleStep(s.id); }}>
                      {isDone ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4 text-muted-foreground" />}
                    </button>
                    <span className={`flex-1 truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>{s.title}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => idx > 0 && setIdx(idx - 1)}
            disabled={idx === 0}
            className="h-9 px-4 rounded-full text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="size-4" /> Previous
          </button>
          <button
            onClick={skip}
            className="h-9 px-4 rounded-full text-sm text-muted-foreground hover:bg-muted inline-flex items-center gap-1.5"
          >
            <SkipForward className="size-4" /> Skip for now
          </button>
          <button
            onClick={() => idx < total - 1 && setIdx(idx + 1)}
            disabled={idx === total - 1}
            className="h-9 px-4 rounded-full text-sm hover:bg-muted disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            Next <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

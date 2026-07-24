import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, X, Rocket, ArrowRight } from "lucide-react";
import {
  ONBOARDING_STEPS,
  getCompletedSteps,
  setStepComplete,
  setStepIncomplete,
  dismissOnboarding,
  isOnboardingComplete,
  isOnboardingDismissed,
} from "@/lib/onboarding";
import { useAuth } from "@/hooks/use-auth";

/** Persistent setup checklist for the admin dashboard. Hides when all steps
 *  are complete OR the user explicitly dismisses it. Can be re-opened from
 *  the Help menu or /onboarding. */
export function OnboardingChecklist() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [done, setDone] = useState(() => getCompletedSteps(clinicId));
  const [dismissed, setDismissed] = useState(() => isOnboardingDismissed(clinicId));

  if (!clinicId || dismissed || isOnboardingComplete(clinicId)) return null;

  const total = ONBOARDING_STEPS.length;
  const completed = ONBOARDING_STEPS.filter((s) => done.has(s.id)).length;
  const pct = Math.round((completed / total) * 100);

  const toggle = (id: string) => {
    const s = new Set(done);
    if (s.has(id)) { s.delete(id); setStepIncomplete(clinicId, id); } else { s.add(id); setStepComplete(clinicId, id); }
    setDone(s);
  };

  return (
    <div className="col-span-12 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
            <Rocket className="size-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-tight">Finish setting up your clinic</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {completed} of {total} done · {pct}% complete
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/onboarding"
            className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90"
          >
            Open guided setup <ArrowRight className="size-3.5" />
          </Link>
          <button
            onClick={() => { dismissOnboarding(clinicId); setDismissed(true); }}
            className="size-9 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
            title="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {ONBOARDING_STEPS.map((s) => {
          const isDone = done.has(s.id);
          return (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card/60">
              <button
                onClick={() => toggle(s.id)}
                className="shrink-0"
                aria-label={isDone ? "Mark incomplete" : "Mark complete"}
              >
                {isDone ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
                  {s.title}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{s.description}</div>
              </div>
              <Link
                to={s.href}
                className="text-[11px] text-primary hover:underline shrink-0"
              >
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

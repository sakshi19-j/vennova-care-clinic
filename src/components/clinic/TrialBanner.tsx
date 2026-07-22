import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X as XIcon, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";

type SubscriptionStatus = {
  plan?: string;
  days_left?: number | null;
  subscription_status?: string;
};

const DISMISS_KEY = "vennova.trialBanner.dismissed";

/** Trial-countdown banner. Shows when days_left <= 3 and clinic is on TRIAL.
 *  Amber at 2-3 days, red/urgent at <= 1. Dismissible per session, reappears
 *  next login (sessionStorage). Auto-hides once subscription is ACTIVE. */
export function TrialBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  const q = useQuery<SubscriptionStatus>({
    queryKey: ["subscription", "status"],
    queryFn: () => api.get<SubscriptionStatus>("/subscription/status"),
    staleTime: 60_000,
    retry: 1,
  });

  const s = q.data;
  const daysLeft = s?.days_left ?? null;
  const subStatus = (s?.subscription_status || "").toUpperCase();
  if (dismissed) return null;
  if (subStatus === "ACTIVE") return null;
  if (daysLeft == null || daysLeft > 3) return null;

  const urgent = daysLeft <= 1;
  const tone = urgent
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : "border-amber-500/50 bg-amber-500/10 text-amber-900";

  const dayLabel = daysLeft <= 0 ? "less than a day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  return (
    <div className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <AlertTriangle className={`size-4 shrink-0 ${urgent ? "" : "text-amber-700"}`} />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{dayLabel} left in your trial</span>
        <span className="opacity-80"> — upgrade now to keep using Vennova without interruption.</span>
      </div>
      <Link
        to="/admin/settings/subscription"
        className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold ${
          urgent ? "bg-destructive text-destructive-foreground" : "bg-amber-600 text-white"
        }`}
      >
        Upgrade <ArrowRight className="size-3.5" />
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
          setDismissed(true);
        }}
        className="size-7 rounded-full hover:bg-black/5 grid place-items-center"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

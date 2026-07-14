import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Check, Zap, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/clinic/PageHeader";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/admin/settings/subscription")({
  component: SubscriptionPage,
});

type Plan = {
  id: "starter" | "growth" | "clinicpro";
  planKeyMonthly: string;
  planKey6month: string;
  planKeyYearly: string;
  name: string;
  monthlyPrice: number;
  price6month: number;
  yearlyPrice: number;
  tagline: string;
  icon: typeof Zap;
  devices: string;
  highlight: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    planKeyMonthly: "starter_monthly",
    planKey6month: "starter_6month",
    planKeyYearly: "starter_yearly",
    name: "Starter",
    monthlyPrice: 999,
    price6month: 2999,
    yearlyPrice: 4999,
    tagline: "For solo practitioners",
    icon: Zap,
    devices: "1 device only",
    highlight: false,
    features: [
      "Up to 100 patients/month",
      "1 staff account",
      "WhatsApp reminders",
      "Billing & receipts",
      "Email support",
    ],
  },
  {
    id: "growth",
    planKeyMonthly: "growth_monthly",
    planKey6month: "growth_6month",
    planKeyYearly: "growth_yearly",
    name: "Growth",
    monthlyPrice: 1999,
    price6month: 5999,
    yearlyPrice: 9999,
    tagline: "Most popular for growing clinics",
    icon: Sparkles,
    devices: "Up to 3 devices",
    highlight: true,
    features: [
      "Unlimited patients",
      "3 staff accounts",
      "WhatsApp Business templates",
      "Priority email support",
      "Advanced analytics",
      "Patient import",
    ],
  },
  {
    id: "clinicpro",
    planKeyMonthly: "clinicpro_monthly",
    planKey6month: "clinicpro_6month",
    planKeyYearly: "clinicpro_yearly",
    name: "ClinicPro",
    monthlyPrice: 3499,
    price6month: 9999,
    yearlyPrice: 17999,
    tagline: "Multi-clinic & enterprise",
    icon: Crown,
    devices: "Unlimited devices",
    highlight: false,
    features: [
      "Everything in Growth",
      "Unlimited staff",
      "Multi-branch dashboard",
      "Phone & chat support",
      "Custom integrations",
      "Dedicated manager",
    ],
  },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type SubscriptionStatus = {
  plan?: string;
  days_left?: number | null;
  subscription_status?: string;
};

function SubscriptionPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const statusQ = useQuery<SubscriptionStatus>({
    queryKey: ["subscription", "status"],
    queryFn: () => api.get<SubscriptionStatus>("/subscription/status"),
    staleTime: 30_000,
  });

  useEffect(() => {
    loadRazorpay();
  }, []);

  const status = statusQ.data;
  const currentPlan = (status?.plan || "trial").toLowerCase();
  const daysLeft = status?.days_left ?? null;
  const subStatus = status?.subscription_status || "TRIAL";

  const upgrade = async (plan: Plan) => {
    setUpgrading(plan.id);
    try {
      const ready = await loadRazorpay();
      if (!ready) throw new Error("Payment gateway failed to load.");
      const planKey = billing === "yearly" ? plan.planKeyYearly : plan.planKeyMonthly;
      const order = await api.post<any>("/subscription/create", { plan_key: planKey });
      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        subscription_id: order.subscription_id,
        name: "Vennova Clinic OS",
        description: `${plan.name} — ${billing === "yearly" ? "Annual" : "Monthly"}`,
        prefill: { email: order.clinic_email },
        theme: { color: "#6D28D9" },
        handler: async (response: any) => {
          try {
            await api.post("/subscription/verify", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(`Welcome to ${plan.name}! Plan is now active.`);
            statusQ.refetch();
          } catch (e) {
            toast.error((e as Error).message || "Verification failed");
          } finally {
            setUpgrading(null);
          }
        },
        modal: { ondismiss: () => setUpgrading(null) },
      });
      rzp.on("payment.failed", (r: any) => {
        toast.error(r.error?.description || "Payment failed");
        setUpgrading(null);
      });
      rzp.open();
    } catch (e) {
      toast.error((e as Error).message || "Could not start checkout");
      setUpgrading(null);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 bg-gradient-to-br from-saffron/15 via-card to-card border-saffron/30">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-saffron/20 text-[color-mix(in_oklab,var(--saffron)_30%,black)] grid place-items-center">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Current plan</div>
            <div className="font-display text-2xl capitalize">{currentPlan}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {statusQ.isLoading ? (
                "Loading…"
              ) : subStatus === "TRIAL" && daysLeft !== null ? (
                <span>
                  <strong className="text-amber-700">{daysLeft} day{daysLeft === 1 ? "" : "s"} remaining</strong> in trial
                  {daysLeft <= 5 ? " — upgrade now to keep access" : ""}
                </span>
              ) : subStatus === "ACTIVE" ? (
                <span className="text-emerald-700">Active subscription ✓</span>
              ) : (
                <span className="text-destructive">Trial expired — upgrade to restore access</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="col-span-12 flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
          <button
            onClick={() => setBilling("monthly")}
            className={`h-9 px-5 rounded-full text-sm font-medium transition-all ${billing === "monthly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`h-9 px-5 rounded-full text-sm font-medium transition-all inline-flex items-center gap-2 ${billing === "yearly" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Yearly
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700">SAVE 50%+</span>
          </button>
        </div>
      </div>

      {PLANS.map((p) => {
        const Icon = p.icon;
        const price = billing === "yearly" ? p.yearlyPrice : p.monthlyPrice;
        const period = billing === "yearly" ? "/ year" : "/ month";
        return (
          <Card
            key={p.id}
            className={`col-span-12 md:col-span-4 relative flex flex-col ${p.highlight ? "border-primary ring-1 ring-primary/30 animate-pulse-glow" : ""}`}
          >
            {p.highlight && (
              <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-widest">
                Most Popular
              </div>
            )}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Icon className="size-5" />
              </div>
              <div>
                <div className="font-display text-2xl">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{p.devices}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{p.tagline}</div>
            <div className="mt-3 mb-4">
              <span className="font-display text-4xl">₹{price.toLocaleString("en-IN")}</span>
              <span className="text-sm text-muted-foreground"> {period}</span>
            </div>
            <ul className="space-y-2 mb-5 flex-1">
              {p.features.map((f) => (
                <li key={f} className="text-sm inline-flex items-start gap-2">
                  <Check className="size-4 text-success shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => upgrade(p)}
              disabled={upgrading === p.id || currentPlan === p.id}
              className={`w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-all ${p.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25" : "border border-border hover:bg-muted"}`}
            >
              {upgrading === p.id ? (
                <><Loader2 className="size-4 animate-spin" /> Starting checkout…</>
              ) : currentPlan === p.id ? (
                "Current plan ✓"
              ) : (
                `Upgrade to ${p.name}`
              )}
            </button>
          </Card>
        );
      })}

      <Card className="col-span-12 bg-muted/40">
        <div className="text-xs text-muted-foreground">
          All plans include unlimited consultations, secure backups, free updates.
          Cancel anytime. Billing via Razorpay (cards, UPI, net-banking).
          GST invoices are emailed automatically.
        </div>
      </Card>
    </div>
  );
}

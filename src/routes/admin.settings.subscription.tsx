import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/clinic/PageHeader";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/admin/settings/subscription")({
  component: SubscriptionPage,
});

type Plan = {
  id: "starter" | "growth" | "clinicpro";
  planKeyMonthly: string;
  name: string;
  price: number;
  tagline: string;
  highlight?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    planKeyMonthly: "starter_monthly",
    name: "Starter",
    price: 999,
    tagline: "For solo practitioners getting started",
    features: ["Up to 100 patients/month", "1 staff account", "WhatsApp reminders (basic)", "Email support"],
  },
  {
    id: "growth",
    planKeyMonthly: "growth_monthly",
    name: "Growth",
    price: 1999,
    highlight: true,
    tagline: "Most popular for growing clinics",
    features: ["Unlimited patients", "3 staff accounts", "WhatsApp Business templates", "Priority email support"],
  },
  {
    id: "clinicpro",
    planKeyMonthly: "clinicpro_monthly",
    name: "ClinicPro",
    price: 3499,
    tagline: "Multi-clinic & premium support",
    features: ["Unlimited everything", "Unlimited staff", "Multi-branch dashboard", "Phone & chat support"],
  },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type SubscriptionStatus = {
  plan?: string;
  days_left?: number | null;
  subscription_status?: string;
};

function SubscriptionPage() {
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const statusQ = useQuery<SubscriptionStatus>({
    queryKey: ["subscription", "status"],
    queryFn: () => api.get<SubscriptionStatus>("/subscription/status"),
    staleTime: 30_000,
  });

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const status = statusQ.data;
  const currentPlan = (status?.plan || "trial").toLowerCase();
  const daysLeft = status?.days_left ?? null;
  const subStatus = status?.subscription_status || "TRIAL";

  const upgrade = async (plan: Plan) => {
    setUpgrading(plan.id);
    try {
      const ready = await loadRazorpayScript();
      if (!ready) throw new Error("Could not load payment gateway. Check your connection.");

      const order = await api.post<any>("/subscription/create", {
        plan_key: plan.planKeyMonthly,
      });

      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        subscription_id: order.subscription_id,
        name: "Vennova Clinic OS",
        description: `${plan.name} Plan — Monthly`,
        prefill: { email: order.clinic_email },
        theme: { color: "#6D28D9" },
        handler: async (response: any) => {
          try {
            await api.post("/subscription/verify", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success(`Welcome to ${plan.name}! Your plan is now active.`);
            statusQ.refetch();
          } catch (e) {
            toast.error((e as Error).message || "Payment verification failed");
          } finally {
            setUpgrading(null);
          }
        },
        modal: { ondismiss: () => setUpgrading(null) },
      });

      rzp.on("payment.failed", (resp: any) => {
        toast.error(resp.error?.description || "Payment failed");
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
                <span><strong className="text-amber-700">{daysLeft} day{daysLeft === 1 ? "" : "s"} remaining</strong> in trial</span>
              ) : subStatus === "ACTIVE" ? (
                <span className="text-emerald-700">Active subscription</span>
              ) : (
                <span className="text-destructive">Subscription expired — please renew</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {PLANS.map((p) => (
        <Card key={p.id} className={`col-span-12 md:col-span-4 relative ${p.highlight ? "border-primary ring-1 ring-primary/30" : ""}`}>
          {p.highlight && (
            <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-widest">
              Recommended
            </div>
          )}
          <div className="font-display text-2xl">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.tagline}</div>
          <div className="mt-3 mb-4">
            <span className="font-display text-4xl">₹{p.price.toLocaleString("en-IN")}</span>
            <span className="text-sm text-muted-foreground"> / month</span>
          </div>
          <ul className="space-y-2 mb-5">
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
            className={`w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
              p.highlight
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border hover:bg-muted"
            }`}
          >
            {upgrading === p.id ? (
              <><Loader2 className="size-4 animate-spin" /> Starting checkout…</>
            ) : currentPlan === p.id ? (
              "Current plan"
            ) : (
              `Upgrade to ${p.name}`
            )}
          </button>
        </Card>
      ))}

      <Card className="col-span-12 bg-muted/40">
        <div className="text-xs text-muted-foreground">
          All plans include unlimited consultations, secure cloud backups, and free updates.
          Cancel any time — no contract. Billing is processed securely via Razorpay
          (cards, UPI, net-banking). GST invoices are emailed automatically.
        </div>
      </Card>
    </div>
  );
}

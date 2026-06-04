import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/clinic/PageHeader";
import { Sparkles, Check, ExternalLink, Users, MessageCircle, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings/subscription")({
  component: SubscriptionPage,
});

type Plan = {
  id: "starter" | "growth" | "clinicpro";
  name: string;
  price: number;
  tagline: string;
  highlight?: boolean;
  features: string[];
  // razorpay payment link — replace with real ones in production
  razorpayUrl: string;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 999,
    tagline: "For solo practitioners getting started",
    features: ["Up to 100 patients/month", "1 staff account", "WhatsApp reminders (basic)", "Email support"],
    razorpayUrl: "https://rzp.io/l/vedic-starter",
  },
  {
    id: "growth",
    name: "Growth",
    price: 1999,
    highlight: true,
    tagline: "Most popular for growing clinics",
    features: ["Unlimited patients", "3 staff accounts", "WhatsApp Business templates", "Calendly auto-booking", "Priority email support"],
    razorpayUrl: "https://rzp.io/l/vedic-growth",
  },
  {
    id: "clinicpro",
    name: "ClinicPro",
    price: 3499,
    tagline: "Multi-clinic & premium support",
    features: ["Unlimited everything", "Unlimited staff", "Multi-branch dashboard", "Phone & chat support", "Custom integrations"],
    razorpayUrl: "https://rzp.io/l/vedic-clinicpro",
  },
];

function SubscriptionPage() {
  // In production fetch real usage from /analytics/usage
  const usage = { patients_this_month: 87, staff_count: 1, whatsapp_sent: 142, trial_days_left: 14 };
  const [billing] = useState<"monthly" | "yearly">("monthly");

  const upgrade = (plan: Plan) => {
    toast.success(`Opening Razorpay for ${plan.name} — ₹${plan.price}/month`);
    window.open(plan.razorpayUrl, "_blank", "noopener");
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Current plan banner */}
      <Card className="col-span-12 bg-gradient-to-br from-saffron/15 via-card to-card border-saffron/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-saffron/20 text-[color-mix(in_oklab,var(--saffron)_30%,black)] grid place-items-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Current plan</div>
              <div className="font-display text-2xl">Trial</div>
              <div className="text-xs text-muted-foreground mt-0.5"><strong className="text-amber-700">{usage.trial_days_left} days remaining</strong> — pick a plan below to keep access running.</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Patients (mo)" value={usage.patients_this_month} icon={<Users className="size-3.5" />} />
            <Mini label="Staff" value={usage.staff_count} icon={<Crown className="size-3.5" />} />
            <Mini label="WhatsApp sent" value={usage.whatsapp_sent} icon={<MessageCircle className="size-3.5" />} />
          </div>
        </div>
      </Card>

      {/* Plans */}
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
            className={`w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 ${p.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-muted"}`}
          >
            Upgrade to {p.name} <ExternalLink className="size-3.5" />
          </button>
        </Card>
      ))}

      <Card className="col-span-12 bg-muted/40">
        <div className="text-xs text-muted-foreground">
          All plans include unlimited consultations, secure cloud backups, and free updates. Cancel any time — no contract.
          Billing is processed securely via Razorpay (cards, UPI, net-banking). GST invoices are emailed automatically.
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2 min-w-[100px]">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">{icon}{label}</div>
      <div className="font-display text-lg mt-0.5">{value.toLocaleString("en-IN")}</div>
    </div>
  );
}

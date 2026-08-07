import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

import vennovaMark from "@/assets/vennova-mark.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Clinic Sign In — Vennova" },
      { name: "description", content: "Sign in to your clinic console or register a new clinic — owner, doctors and reception each get their own login." },
      { property: "og:title", content: "Clinic Sign In — Vennova" },
      { property: "og:description", content: "Sign in to your clinic console or register a new clinic — owner, doctors and reception each get their own login." },
      { property: "og:url", content: "https://vennova-care-clinic.lovable.app/auth" },
      { name: "twitter:title", content: "Clinic Sign In — Vennova" },
      { name: "twitter:description", content: "Sign in to your clinic console or register a new clinic — owner, doctors and reception each get their own login." },
    ],
    links: [{ rel: "canonical", href: "https://vennova-care-clinic.lovable.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();

  // Once signed in & role is loaded, send the user to their home.
  useEffect(() => {
    if (loading) return;
    if (!session) return;
    if (!role) return;
    const home =
      role === "super_admin" ? "/superadmin"
      : role === "admin" ? "/admin"
      : role === "reception" ? "/reception"
      : role === "homeopathy" ? "/admin"
      : "/doctor";
    navigate({ to: home as any, replace: true });
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen bg-background flex">
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 text-primary-foreground p-12"
        style={{ background: "linear-gradient(150deg, #0D47A1 0%, #0D2A4D 55%, #00B8A9 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-white flex items-center justify-center shadow-md shrink-0">
            <img src={vennovaMark.url} alt="Vennova" className="size-8 object-contain" />
          </div>
          <div>
            <div className="text-lg leading-none lowercase tracking-tight font-semibold">vennova</div>
            <div className="text-xs text-primary-foreground/70 mt-1">Clinic OS</div>
          </div>
        </div>
        <div>
          <h1 className="font-display text-5xl leading-tight">
            Clinic Sign In
          </h1>
          <p className="mt-3 text-primary-foreground/90 text-lg">One console for the whole clinic.</p>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Reception runs the front desk. Doctors run the consultation. The owner sees everything — revenue, queue, staff, audit. Each role gets its own login.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-primary-foreground/80">
            <ShieldCheck className="size-4" />
            Clinic accounts are provisioned by Vennova.
          </div>
        </div>
        <div className="text-xs text-primary-foreground/60">
          Patient data stays inside your clinic — every record is scoped to your account.
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoginForm />

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Clinic and staff accounts are issued by Vennova. Need access?
            Contact your clinic owner or the Vennova team.
          </p>
        </div>
      </div>
    </div>
  );
}


function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Auth listener will navigate to role home.
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-2xl">Welcome back</h2>
      <p className="text-sm text-muted-foreground -mt-2">
        Sign in with the email and password your clinic owner gave you.
      </p>
      <Field label="Email">
        <input
          type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <Field label="Password">
        <input
          type="password" required autoComplete="current-password" minLength={8}
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <button
        type="submit" disabled={busy}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <>Sign in <ArrowRight className="size-4" /></>}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactElement }) {
  const id = React.useId();
  const child = React.cloneElement(children as React.ReactElement<any>, { id });
  return (
    <div className="block">
      <label htmlFor={id} className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{label}</label>
      {child}
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

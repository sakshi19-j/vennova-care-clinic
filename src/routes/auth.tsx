import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { Leaf, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Vedic Homeopathic Clinic" },
      { name: "description", content: "Sign in to your clinic console or register a new clinic — owner, doctors and reception each get their own login." },
      { property: "og:title", content: "Sign in — Vedic Homeopathic Clinic" },
      { property: "og:description", content: "Owner registration and staff sign-in for the Vedic Clinic operating system." },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

type Mode = "login" | "register";

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>("login");

  // Once signed in & role is loaded, send the user to their home.
  useEffect(() => {
    if (loading) return;
    if (!session) return;
    if (!role) return;
    const home =
      role === "admin" ? "/admin"
      : role === "reception" ? "/reception"
      : role === "homeopathy" ? "/homeopathy"
      : "/doctor";
    navigate({ to: home as any, replace: true });
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_70%,black)] text-primary-foreground p-12">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-gold flex items-center justify-center text-gold-foreground shadow-md">
            <Leaf className="size-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">Vedic</div>
            <div className="text-xs text-primary-foreground/70 mt-1">Homeopathic Clinic OS</div>
          </div>
        </div>
        <div>
          <h1 className="font-display text-5xl leading-tight">
            One console for the whole clinic.
          </h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Reception runs the front desk. Doctors run the consultation. The owner sees everything — revenue, queue, staff, audit. Each role gets its own login.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-primary-foreground/80">
            <ShieldCheck className="size-4" />
            Owner registers the clinic, then issues staff credentials.
          </div>
        </div>
        <div className="text-xs text-primary-foreground/60">
          Patient data stays inside your clinic — every record is scoped to your account.
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex rounded-full border border-border p-1 bg-muted/40 text-sm mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 h-9 rounded-full transition ${mode === "login" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 h-9 rounded-full transition ${mode === "register" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Register clinic
            </button>
          </div>

          {mode === "login" ? <LoginForm /> : <RegisterForm onDone={() => refresh()} />}

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Staff accounts are created by the clinic owner from the admin console.
            If you're staff, ask your owner for credentials.
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

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [clinicName, setClinicName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: signUp, error: signErr } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          data: { full_name: fullName, clinic_name: clinicName },
        },
      });
      if (signErr) throw signErr;

      // Ensure we have a session (auto-confirm is on for this clinic app).
      if (!signUp.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }

      // Create clinic + admin profile + admin role server-side via SECURITY DEFINER RPC.
      const { error: rpcErr } = await supabase.rpc("register_clinic_owner", {
        _clinic_name: clinicName,
        _full_name: fullName,
      });
      if (rpcErr) throw rpcErr;

      toast.success("Clinic created. Welcome aboard.");
      await onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not register clinic.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-2xl">Register your clinic</h2>
      <p className="text-sm text-muted-foreground -mt-2">
        You become the owner / admin and can add staff later.
      </p>
      <Field label="Clinic name">
        <input
          required maxLength={120} value={clinicName} onChange={(e) => setClinicName(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <Field label="Your name">
        <input
          required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <Field label="Email">
        <input
          type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input
          type="password" required autoComplete="new-password" minLength={8}
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <button
        type="submit" disabled={busy}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <>Create clinic <ArrowRight className="size-4" /></>}
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

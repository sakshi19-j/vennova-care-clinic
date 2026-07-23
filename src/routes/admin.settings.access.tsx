import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/clinic/PageHeader";
import { UserPlus, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/settings/access")({
  component: StaffAccess,
});

type Role = "admin" | "reception";

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "admin",     label: "Admin / Owner", hint: "Full access — can manage clinic, staff, billing, settings" },
  { value: "reception", label: "Receptionist",  hint: "Queue, billing, appointments, patients" },
];

function slugifyClinic(name: string | null | undefined): string {
  return String(name || "clinic").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "") || "clinic";
}

function StaffAccess() {
  const { profile, clinicName } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("reception");
  const [counts, setCounts] = useState<{ admin: number; reception: number } | null>(null);
  const [lastSuggest, setLastSuggest] = useState<{ name: string; email: string }>({ name: "", email: "" });

  const loadCounts = async () => {
    if (!profile?.clinic_id) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("clinic_id", profile.clinic_id);
    const rows = (data ?? []) as { role: string }[];
    setCounts({
      admin: rows.filter((r) => r.role === "admin").length,
      reception: rows.filter((r) => r.role === "reception").length,
    });
  };

  useEffect(() => { void loadCounts(); }, [profile?.clinic_id]);

  // Auto-suggest full name + email whenever role changes. Only overwrite if the
  // current value is empty or matches the previous auto-suggestion — never
  // replace something the user typed manually.
  useEffect(() => {
    if (!counts) return;
    const label = role === "reception" ? "Reception" : "Admin";
    const prefix = role === "reception" ? "reception" : "admin";
    const n = (role === "reception" ? counts.reception : counts.admin) + 1;
    const slug = slugifyClinic(clinicName);
    const suggestName = `${label}${n}`;
    const suggestEmail = `${prefix}${n}@${slug}.com`;
    setName((cur) => (!cur.trim() || cur === lastSuggest.name ? suggestName : cur));
    setEmail((cur) => (!cur.trim() || cur === lastSuggest.email ? suggestEmail : cur));
    setLastSuggest({ name: suggestName, email: suggestEmail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, counts, clinicName]);

  const createStaff = useMutation({
    mutationFn: () => api.post("/auth/staff", { name, email, password, role }),
    onSuccess: async () => {
      toast.success(`${name} can now log in as ${role}`);
      setName(""); setEmail(""); setPassword(""); setRole("reception");
      setLastSuggest({ name: "", email: "" });
      await loadCounts();
    },
    onError: (e: unknown) => {
      console.error("[staff]", e);
      const raw = e instanceof ApiError ? e.message : (e as Error)?.message ?? "";
      const expected = /you can't remove yourself|only clinic admins|not found in your clinic/i;
      const technical = /supabase|postgres|environment variable|jwt|rls|policy|fetch failed|network|500|502|503/i;
      if (raw && expected.test(raw)) toast.error(raw);
      else if (!raw || technical.test(raw) || raw.length > 120) toast.error("Something went wrong — please try again or contact support.");
      else toast.error(raw);
    },
  });

  const canSubmit = name.trim() && email.trim() && password.trim().length >= 6;

  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 lg:col-span-8">
        <div className="font-display text-lg mb-4 inline-flex items-center gap-2">
          <UserPlus className="size-4 text-muted-foreground" /> Add staff or admin login
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Create a new login for this clinic — a second admin/owner account
          or a receptionist. They will be able to sign in immediately with the
          email and password you set below.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <Field label="Password (min 6 chars)" value={password} onChange={setPassword} type="password" />
          <label className="block">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Role</div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-10 px-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {ROLE_OPTIONS.find((r) => r.value === role)?.hint}
        </p>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => createStaff.mutate()}
            disabled={!canSubmit || createStaff.isPending}
            className="rounded-xl bg-primary"
          >
            {createStaff.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <UserPlus className="size-4 mr-1" />}
            Create login
          </Button>
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <div className="font-display text-sm mb-3 inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" /> How this works
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>• The new account can sign in right away with the email/password above — no confirmation email needed.</p>
          <p>• "Admin / Owner" gives full access to everything in this clinic, same as your own login.</p>
          <p>• Doctor accounts are created through a separate registration flow, not this form.</p>
          <p>• To change your OWN email or password, use your account settings in the top-right profile menu.</p>
        </div>
      </Card>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

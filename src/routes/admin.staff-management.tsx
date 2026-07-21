import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { UserPlus, Mail, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteStaffMember } from "@/lib/auth.functions";
import { api } from "@/lib/api-client";
import { useAuth, type Role } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staff-management")({
  component: StaffManagement,
});

type Member = {
  id: string;
  full_name: string;
  email: string;
  role: Role | null;
  created_at: string;
};

function StaffManagement() {
  const { profile, clinicName } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const remove = useServerFn(deleteStaffMember);

  const load = async () => {
    if (!profile?.clinic_id) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: true });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("clinic_id", profile.clinic_id);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as Role]));
    setMembers((profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })));
  };

  useEffect(() => { void load(); }, [profile?.clinic_id]);

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-2xl">Staff management</div>
          <div className="text-sm text-muted-foreground">Add staff with custom email + password and assign their role.</div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <UserPlus className="size-4" /> {open ? "Close" : "Add member"}
        </button>
      </div>

      {open && (
        <Card className="col-span-12">
          <AddStaffForm
            members={members}
            clinicName={clinicName}
            onSubmit={async (data) => {
              try {
                await api.post("/auth/staff", {
                  name: data.fullName,
                  email: data.email,
                  password: data.password,
                  role: data.role,
                  phone: "",
                });
                toast.success(`Created ${data.email}`);
                setOpen(false);
                await load();
              } catch (e: any) {
                toast.error(e?.message ?? "Failed to create staff");
              }
            }}
          />
        </Card>
      )}


      <Card className="col-span-12 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
                <th className="text-left font-medium py-2 px-5">Member</th>
                <th className="text-left font-medium py-2 px-3">Role</th>
                <th className="text-left font-medium py-2 px-3">Email</th>
                <th className="text-right font-medium py-2 px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0 clinic-divider hover:bg-muted/50">
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-medium">
                        {(m.full_name || m.email).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="font-medium">{m.full_name || "—"}</div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <Tag className="bg-muted text-muted-foreground border-border">{m.role ?? "—"}</Tag>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground inline-flex items-center gap-1">
                    <Mail className="size-3" /> {m.email}
                  </td>
                  <td className="py-3 px-5 text-right">
                    {m.id !== profile?.id && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove ${m.email}?`)) return;
                          try {
                            await remove({ data: { userId: m.id } });
                            toast.success("Removed");
                            await load();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Failed to remove");
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="size-3" /> Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No staff yet — add your first team member.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AddStaffForm({
  onSubmit,
}: {
  onSubmit: (data: { email: string; password: string; fullName: string; role: Role }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("reception");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit({ email, password, fullName, role });
        setBusy(false);
        setEmail(""); setPassword(""); setFullName(""); setRole("reception");
      }}
      className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
    >
      <Input label="Full name" value={fullName} onChange={setFullName} required maxLength={120} />
      <Input label="Email" type="email" value={email} onChange={setEmail} required />
      <Input label="Password" type="password" value={password} onChange={setPassword} required minLength={8} />
      <label className="block">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Role</div>
        <select
          value={role} onChange={(e) => setRole(e.target.value as Role)}
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm"
        >
          <option value="reception">Reception</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button
        type="submit" disabled={busy}
        className="h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Create"}
      </button>
    </form>
  );
}

function Input({
  label, value, onChange, type = "text", required, maxLength, minLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; maxLength?: number; minLength?: number;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} maxLength={maxLength} minLength={minLength}
        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

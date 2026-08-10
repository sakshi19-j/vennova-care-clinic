import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { supabase } from "@/integrations/supabase/client"
import { clinicDb } from "@/integrations/supabase/clinic-db";
import { useAuth, type Role } from "@/hooks/use-auth";


export const Route = createFileRoute("/admin/staff")({
  component: StaffPerfPage,
});

type Member = {
  id: string;
  full_name: string;
  email: string;
  role: Role | null;
  created_at: string;
};

type StaffMetric = {
  user_id?: string;
  email?: string;
  patients_today?: number;
  avg_consult_min?: number;
  collections_today?: number;
  on_duty?: boolean;
  satisfaction?: number;
};

function roleLabel(role: Role | null): string {
  switch (role) {
    case "admin": return "Owner / Admin";
    case "allopathy": return "Doctor (Allopathy)";
    case "homeopathy": return "Doctor (Homeopathy)";
    case "reception": return "Receptionist";
    default: return "Staff";
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase())
    .slice(0, 2)
    .join("") || "?";
}

function StaffPerfPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [metrics, setMetrics] = useState<Record<string, StaffMetric>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
          clinicDb
            .from("profiles")
            .select("id, full_name, email, created_at")
            .eq("clinic_id", profile.clinic_id)
            .order("created_at", { ascending: true }),
          clinicDb
            .from("user_roles")
            .select("user_id, role")
            .eq("clinic_id", profile.clinic_id),
        ]);
        if (pErr) throw pErr;
        if (rErr) throw rErr;
        const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as Role]));
        const list: Member[] = (profiles ?? []).map((p) => ({
          ...p,
          role: roleMap.get(p.id) ?? null,
        }));
        if (!alive) return;
        setMembers(list);

        // Performance metrics endpoint is not deployed yet — leave metrics empty
        // and show "—" indicators rather than calling a non-existent endpoint.
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load staff");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile?.clinic_id]);

  const enriched = useMemo(
    () =>
      members.map((m) => {
        const metric = metrics[m.id] || metrics[m.email?.toLowerCase() ?? ""] || {};
        return {
          ...m,
          patients_today: Number(metric.patients_today ?? 0),
          avg_consult_min: Number(metric.avg_consult_min ?? 0),
          collections_today: Number(metric.collections_today ?? 0),
          satisfaction: Number(metric.satisfaction ?? 0),
          on_duty: metric.on_duty ?? true,
        };
      }),
    [members, metrics],
  );

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mb-2" /> Loading staff…
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid place-items-center py-16 text-sm text-destructive gap-2">
        <AlertTriangle className="size-5" />
        {error}
      </div>
    );
  }

  if (enriched.length === 0) {
    return (
      <Card className="grid place-items-center py-16 text-center">
        <div className="size-12 rounded-full bg-muted grid place-items-center mb-3">
          <UserPlus className="size-5 text-muted-foreground" />
        </div>
        <div className="font-display text-base">No staff yet</div>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Add doctors, receptionists or pharmacists from Staff Management. They'll appear here automatically.
        </p>
        <Link
          to="/admin/staff-management"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Go to Staff Management →
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-5">
      {enriched.map((s) => (
        <Card key={s.id} className="col-span-12 md:col-span-6 lg:col-span-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-11 rounded-full bg-muted text-sm font-medium flex items-center justify-center border border-border">
              {initialsOf(s.full_name || s.email)}
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{s.full_name || s.email}</div>
              <div className="text-xs text-muted-foreground truncate">{roleLabel(s.role)}</div>
            </div>
          </div>
          <Tag
            className={
              s.on_duty
                ? "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30"
                : "bg-muted text-muted-foreground border-border"
            }
          >
            <span
              className={`size-1.5 rounded-full ${s.on_duty ? "bg-success pulse-dot" : "bg-muted-foreground"}`}
            />
            {s.on_duty ? "On duty" : "Off"}
          </Tag>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Patients</div>
              <div className="font-display text-xl">{s.patients_today || "—"}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg consult</div>
              <div className="font-display text-xl">
                {s.avg_consult_min ? `${s.avg_consult_min}m` : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2 col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Collections</div>
              <div className="font-display text-xl">
                {s.collections_today ? `₹${s.collections_today.toLocaleString("en-IN")}` : "—"}
              </div>
            </div>
          </div>

          {s.satisfaction > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Patient satisfaction</span>
                <span className="font-medium">{s.satisfaction}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-saffron"
                  style={{ width: `${s.satisfaction}%` }}
                />
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

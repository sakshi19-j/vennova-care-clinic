import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  UserCog, Settings, Search, Bell, Leaf, Command, CalendarDays,
  Building2, Activity, ShieldCheck, LogOut, Phone, X as XIcon,
  HelpCircle,
} from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { canAccess, roleMeta, type Role } from "@/lib/role-store";
import { useAuth } from "@/hooks/use-auth";
import { remindersService } from "@/services/reminders";
import { api } from "@/lib/api-client";
import { isOnboardingComplete, isOnboardingDismissed, reopenOnboarding } from "@/lib/onboarding";
import vennovaLogo from "@/assets/vennova-logo.png.asset.json";

type NavItem = { to: string; icon: React.ComponentType<{ className?: string }>; label: string; live?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groupsByRole: Record<Role, NavGroup[]> = {
  reception: [
    { label: "Reception", items: [{ to: "/reception", icon: Building2, label: "Front Office", live: true }] },
  ],
  allopathy: [
    { label: "Doctor", items: [
      { to: "/doctor", icon: Activity, label: "Allopathy OPD", live: true },
      { to: "/doctor/patients", icon: UserCog, label: "Patient Records" },
    ] },
  ],
  homeopathy: [
    { label: "Doctor", items: [
      { to: "/homeopathy", icon: Leaf, label: "Homeopathy OPD", live: true },
      { to: "/doctor/patients", icon: UserCog, label: "Patient Records" },
    ] },
  ],
  admin: [
    {
      label: "Admin",
      items: [
        { to: "/admin", icon: ShieldCheck, label: "Owner Console", live: true },
        { to: "/doctor/patients", icon: UserCog, label: "Patient Records" },
        { to: "/admin/staff-management", icon: UserCog, label: "Staff management" },
        { to: "/admin/settings", icon: Settings, label: "Settings" },
      ],
    },
  ],
};

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { session, role, profile, clinicName, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Redirect to /auth if signed out; redirect to role home if landing on / or outside scope.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      if (path !== "/auth") navigate({ to: "/auth" as any, replace: true });
      return;
    }
    if (!role) return; // profile still loading
    if (path === "/" || path === "/auth") {
      // First-time onboarding: admin lands on /onboarding until completed or dismissed.
      if (role === "admin" && !isOnboardingComplete() && !isOnboardingDismissed()) {
        navigate({ to: "/onboarding" as any, replace: true });
        return;
      }
      navigate({ to: roleMeta[role].home as any, replace: true });
      return;
    }
    if (!canAccess(role, path) && path !== "/onboarding") {
      navigate({ to: roleMeta[role].home as any, replace: true });
    }
  }, [loading, session, role, path, navigate]);

  const remindersStatsQ = useQuery({
    queryKey: ["reminders", "stats", "header"],
    queryFn: () => remindersService.stats(),
    enabled: !!session && !!role,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const pendingCount = Number((remindersStatsQ.data as any)?.pending ?? 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!session || !role) {
    // While auth page renders / role resolves, show nothing (navigation handled above).
    return path === "/auth" ? <Outlet /> : null;
  }

  const groups = groupsByRole[role];
  const meta = roleMeta[role];
  const displayName = profile?.full_name || meta.label;

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 sticky top-0 h-screen text-sidebar-foreground flex flex-col"
        style={{ background: "linear-gradient(180deg, #1e1b4b 0%, #0f0e1a 100%)" }}
      >
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="size-10 rounded-full bg-gold flex items-center justify-center text-gold-foreground shadow-md">
            <Leaf className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg leading-none font-semibold truncate">
              {clinicName || "Vedic"}
            </div>
            <div className="text-xs text-sidebar-foreground/70 mt-1">Homeopathic Clinic</div>
          </div>
        </div>
        <div className="px-5 pb-4 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">
          <img src={vennovaLogo.url} alt="Vennova" className="size-3.5 opacity-70" />
          <span>Powered by Vennova</span>
        </div>

        <nav className="px-3 flex-1 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <div className="px-3 mb-1 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">
                {g.label}
              </div>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = (it as any).end ? path === it.to : path.startsWith(it.to);
                  const Icon = it.icon;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        className={[
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary pl-[10px]"
                            : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80",
                        ].join(" ")}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1">{it.label}</span>
                        {(it as any).live && (
                          <span className="size-2 rounded-full bg-success pulse-dot" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="m-3 p-3 rounded-xl bg-sidebar-accent/40 border border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full bg-gold text-gold-foreground flex items-center justify-center text-xs font-semibold">
              {meta.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-[11px] text-sidebar-foreground/60 truncate">
                {clinicName ? `${clinicName} · ${meta.label}` : meta.label}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {(role === "admin" || role === "reception") && (
              <button
                onClick={() => { reopenOnboarding(); navigate({ to: "/onboarding" as any }); }}
                className="shrink-0 size-8 rounded-lg bg-sidebar-accent/60 hover:bg-primary/20 hover:text-primary text-sidebar-foreground/80 grid place-items-center transition-colors"
                title="Setup guide"
                aria-label="Setup guide"
              >
                <HelpCircle className="size-3.5" />
              </button>
            )}
            <button
              onClick={async () => { await signOut(); navigate({ to: "/auth" as any, replace: true }); }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-sidebar-accent/60 hover:bg-destructive/10 hover:text-destructive text-[11px] font-medium transition-colors"
            >
              <LogOut className="size-3" /> Sign out
            </button>
          </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 backdrop-blur-sm bg-background/95 border-b border-border/50">
          <div className="flex items-center gap-3 px-6 h-14">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex-1 max-w-2xl min-w-0 md:min-w-[500px] flex items-center gap-3 h-9 px-3 rounded-full bg-card/80 border border-border text-sm text-muted-foreground hover:bg-card transition"
            >
              <Search className="size-4" />
              <span className="truncate">Search patients, visits, invoices…</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border bg-background shrink-0">
                <Command className="size-3" /> K
              </span>
            </button>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-right">
                <CalendarDays className="size-4 text-muted-foreground" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Today</div>
                  <div className="text-sm font-medium">
                    {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gold/20 text-[color-mix(in_oklab,var(--gold)_30%,black)] border border-gold/30">
                {meta.label}
              </span>
              <button
                type="button"
                onClick={() => navigate({ to: "/reception/followups" as any })}
                className="relative size-9 rounded-full hover:bg-muted flex items-center justify-center"
                aria-label="Follow-ups"
              >
                <Bell className="size-4" />
                {pendingCount > 0 && (
                  <span className="absolute top-0 right-0 size-2 rounded-full bg-red-500" />
                )}
              </button>

              <div className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                {meta.initials}
              </div>
            </div>
          </div>
        </header>

        <main key={path} className="flex-1 px-6 py-6">
          {role === "reception" && <ReceptionFollowupsBanner />}
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function ReceptionFollowupsBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const q = useQuery({
    queryKey: ["followups", "upcoming", 3],
    queryFn: () => api.get<unknown>("/followups/upcoming", { query: { days: 3 } }),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  if (dismissed) return null;
  const raw = q.data as any;
  const list: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items) ? raw.items
    : Array.isArray(raw?.data) ? raw.data
    : Array.isArray(raw?.followups) ? raw.followups
    : [];
  const now = Date.now();
  const soon = list.filter((f) => {
    const d = f?.due_at || f?.due_date || f?.scheduled_for;
    if (!d) return false;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) return false;
    const diffDays = (t - now) / 86400000;
    return diffDays <= 3;
  });
  if (soon.length === 0) return null;
  const names = soon
    .map((f) => f?.patient_name || f?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const extra = soon.length > 3 ? ` +${soon.length - 3} more` : "";
  return (
    <div
      role="button"
      onClick={() => navigate({ to: "/reception/followups" as any })}
      className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm cursor-pointer hover:bg-amber-500/15 transition-colors"
    >
      <Phone className="size-4 text-amber-700 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-amber-900">
          📞 {soon.length} patient{soon.length === 1 ? "" : "s"} to call — follow-up due within 3 days
        </div>
        {names && (
          <div className="text-xs text-amber-800/80 truncate">{names}{extra}</div>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
        className="size-7 rounded-full hover:bg-amber-500/20 grid place-items-center text-amber-800"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}


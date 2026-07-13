import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Building2, DatabaseBackup, Sparkles, Upload, Users } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsLayout,
});

const tabs = [
  { to: "/admin/settings",              label: "Clinic profile",   icon: Building2,      end: true },
  { to: "/admin/settings/access",       label: "Staff & Access",   icon: Users },
  { to: "/admin/settings/import",       label: "Import patients",  icon: Upload },
  { to: "/admin/settings/backups",      label: "Backups",          icon: DatabaseBackup },
  { to: "/admin/settings/subscription", label: "Subscription",     icon: Sparkles },
];


function SettingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12">
        <div className="font-display text-2xl">Settings</div>
        <div className="text-sm text-muted-foreground">Clinic profile, prescription templates, backups and billing configuration.</div>
      </div>

      <div className="col-span-12 flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-card border border-border clinic-divider w-fit">
        {tabs.map((t) => {
          const active = t.end ? path === t.to : path.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className={[
              "inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            ].join(" ")}>
              <Icon className="size-4" /> {t.label}
            </Link>
          );
        })}
      </div>

      <div className="col-span-12">
        <Outlet />
      </div>
    </div>
  );
}

import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ListOrdered, CalendarDays, Users, Receipt, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/reception")({
  head: () => ({ meta: [{ title: "Reception — Vedic Clinic" }] }),
  component: ReceptionLayout,
});

const tabs = [
  { to: "/reception",              label: "Queue",         icon: ListOrdered,  end: true },
  { to: "/reception/appointments", label: "Appointments",  icon: CalendarDays },
  { to: "/reception/patients",     label: "Patients",      icon: Users },
  { to: "/reception/billing",      label: "Billing",       icon: Receipt },
  { to: "/reception/followups",    label: "Follow-ups",    icon: BellRing },
];

function ReceptionLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-[1500px] mx-auto">
      {/* Compact header bar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-card border border-border clinic-divider w-fit max-w-full overflow-x-auto">
          {tabs.map((t) => {
            const active = t.end ? path === t.to : path.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  "inline-flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")}
              >
                <Icon className="size-4" /> {t.label}
              </Link>
            );
          })}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Today</div>
          <div className="font-display text-lg leading-tight">
            {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  );
}

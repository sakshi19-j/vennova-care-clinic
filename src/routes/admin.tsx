import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  IndianRupee, Monitor, Users, BarChart3, ReceiptText,
} from "lucide-react";
import { AdminToolbar } from "@/components/admin/AdminToolbar";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Owner Console — Vedic Clinic" },
      { name: "description", content: "Owner console for clinic revenue, staff performance, monitoring and billing across doctors, reception and homeopathy departments." },
      { property: "og:title", content: "Owner Console — Vedic Clinic" },
      { property: "og:description", content: "Revenue, staff, monitoring and billing for clinic owners." },
      { property: "og:url", content: "https://care-flow-fix.lovable.app/admin" },
    ],
    links: [{ rel: "canonical", href: "https://care-flow-fix.lovable.app/admin" }],
  }),
  component: AdminLayout,
});

const topTabs = [
  { to: "/admin",             label: "Revenue",     icon: IndianRupee, end: true },
  { to: "/admin/monitor",     label: "Monitor",     icon: Monitor },
  { to: "/admin/staff",       label: "Staff",       icon: Users },
  { to: "/admin/performance", label: "Performance", icon: BarChart3 },
  { to: "/admin/billing",     label: "Billing",     icon: ReceiptText },
];

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Compact toolbar row */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <nav className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-card border border-border clinic-divider">
          {topTabs.map((t) => {
            const active = t.end ? path === t.to : path.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  "inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")}
              >
                <Icon className="size-3.5" /> {t.label}
              </Link>
            );
          })}
        </nav>
        <AdminToolbar />
      </div>

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

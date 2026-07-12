import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Stethoscope, ListChecks, Bell, Users } from "lucide-react";
import { useQueue } from "@/lib/queue-store";

export const Route = createFileRoute("/doctor")({
  head: () => ({ meta: [{ title: "Doctor — Vedic Clinic" }] }),
  component: DoctorLayout,
});

function DoctorLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const list = useQueue();
  const current = list.find((q) => q.status === "IN_TREATMENT");
  const waiting = list.filter((q) => q.status === "WAITING" || q.status === "CHECKED_IN").length;

  const tabs = [
    { to: "/doctor", label: "Now seeing", icon: Stethoscope, end: true },
    { to: "/doctor/queue", label: `Today's list (${waiting + (current ? 1 : 0)})`, icon: ListChecks },
    { to: "/doctor/patients", label: "Patient records", icon: Users },
  ];

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-2">Doctor · Homeopathy</div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05]">Consultation</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Reception sends patients in. You see one patient at a time — review, prescribe, click <span className="font-medium text-foreground">Mark done</span>.
          </p>
        </div>
        {current && (
          <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 inline-flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-success pulse-dot" />
            <div className="text-sm">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Currently with you</div>
              <div className="font-medium">#{current.token_number} · {current.patient_name}</div>
            </div>
          </div>
        )}
        {!current && waiting > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 inline-flex items-center gap-3">
            <Bell className="size-4 text-amber-700" />
            <div className="text-sm">
              <div className="text-[11px] uppercase tracking-widest text-amber-700/80">Waiting</div>
              <div className="font-medium">{waiting} patient{waiting > 1 ? "s" : ""} ready — call next</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-card border border-border clinic-divider mb-6 w-fit">
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

      <Outlet />
    </div>
  );
}

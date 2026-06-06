import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Stethoscope, ListChecks, Bell } from "lucide-react";
import { useQueue, refreshAll } from "@/lib/queue-store";
import { rxPatients } from "@/lib/reception-data";


export const Route = createFileRoute("/homeopathy")({
  head: () => ({ meta: [{ title: "Homeopathy — Vedic Clinic" }] }),
  component: HomeopathyLayout,
});

// Helper used across this module: only patients eligible for homeopathy
export function isHomeoPatient(patientId: string) {
  const p = rxPatients.find((x) => x.id === patientId);
  return p ? p.patient_type === "HOMEOPATHY" || p.patient_type === "BOTH" : true;
}

function HomeopathyLayout() {
  useEffect(() => { void refreshAll(); }, []);

  const path = useRouterState({ select: (s) => s.location.pathname });
  const list = useQueue();
  const homeo = list.filter((q) => isHomeoPatient(q.patient_id));
  const current = homeo.find((q) => q.status === "IN_TREATMENT");
  const waiting = homeo.filter((q) => q.status === "WAITING" || q.status === "CHECKED_IN").length;

  const tabs = [
    { to: "/homeopathy", label: "Now seeing", icon: Stethoscope, end: true },
    { to: "/homeopathy/queue", label: `Today's list (${waiting + (current ? 1 : 0)})`, icon: ListChecks },
  ];

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-2">Doctor · Homeopathy</div>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05]">Case-taking</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Reception sends patients in. Take the case, choose a remedy & potency, click <span className="font-medium text-foreground">Mark done</span>.
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

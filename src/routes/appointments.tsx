import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Tag, Avatar } from "@/components/clinic/PageHeader";
import { appointments, getPatient, todaySchedule, tagStyles } from "@/lib/clinic-data";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — Vedic Clinic" },
      { name: "description", content: "Weekly appointment grid with drag-and-drop slots, urgency cues, follow-up suggestions and one-click next available booking." },
      { property: "og:title", content: "Appointments — Vedic Clinic" },
      { property: "og:description", content: "Weekly slot grid, follow-up suggestions, and instant booking." },
    ],
    links: [{ rel: "canonical", href: "/appointments" }],
  }),
  component: Appointments,
});

const days = ["Mon 11", "Tue 12", "Wed 13", "Thu 14", "Fri 15", "Sat 16", "Sun 17"];
const slots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"];

function Appointments() {
  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Week of 11–17 May"
        title="Appointments"
        subtitle="Drag-and-drop slots, urgency colours, follow-up auto-suggestions, and one-click next available slot."
        actions={
          <>
            <Button variant="outline" className="rounded-full"><Zap className="size-4 mr-1" /> Next available · Today 11:30</Button>
            <Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> Book slot</Button>
          </>
        }
      />
      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8 p-0 overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(7, minmax(0,1fr))` }}>
            <div className="bg-muted/50 border-b clinic-divider" />
            {days.map((d) => (
              <div key={d} className="bg-muted/50 border-b clinic-divider px-3 py-2 text-xs font-medium text-center">{d}</div>
            ))}
            {slots.map((t) => (
              <div key={t} className="contents">
                <div className="text-[11px] text-muted-foreground px-3 py-3 border-b clinic-divider font-mono">{t}</div>
                {days.map((_, di) => {
                  const appt = appointments.find((a) => a.day === di && a.time === t);
                  return (
                    <div key={di} className="border-b border-l clinic-divider px-1.5 py-1.5 min-h-[44px]">
                      {appt && (() => {
                        const p = getPatient(appt.patientId)!;
                        const c = appt.type === "Follow-up"
                          ? "bg-primary/12 border-primary/25 text-primary"
                          : "bg-gold/20 border-gold/30 text-[color-mix(in_oklab,var(--gold)_30%,black)]";
                        return (
                          <div className={`text-[11px] rounded-md px-2 py-1.5 border ${c}`}>
                            <div className="font-medium truncate">{p.name.split(" ")[0]} {p.name.split(" ")[1]?.[0]}.</div>
                            <div className="opacity-70">{appt.type}</div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card>
            <h2 className="font-display text-xl mb-3">Today's schedule</h2>
            <ul className="space-y-1">
              {todaySchedule.map((s, i) => {
                const p = getPatient(s.patientId)!;
                return (
                  <li key={i} className="flex items-center gap-3 py-2 border-b last:border-0 clinic-divider">
                    <div className="font-mono text-sm text-muted-foreground w-12">{s.time}</div>
                    <Avatar name={p.name} size={28} />
                    <div className="flex-1 min-w-0 text-sm font-medium truncate">{p.name}</div>
                    <Tag className={tagStyles[s.type === "Follow-up" ? "follow-up" : "new"]}>{s.type}</Tag>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <h2 className="font-display text-xl mb-3">Quick stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3"><div className="font-display text-3xl">14</div><div className="text-xs text-muted-foreground">Booked today</div></div>
              <div className="rounded-xl border border-border p-3"><div className="font-display text-3xl">2</div><div className="text-xs text-muted-foreground">No-shows</div></div>
            </div>
          </Card>
          <Card className="bg-[color-mix(in_oklab,var(--saffron)_8%,var(--card))] border-saffron/30">
            <h2 className="font-display text-lg mb-2">Follow-up suggestions</h2>
            <p className="text-sm text-muted-foreground mb-3">Based on prescription dates, suggest:</p>
            <div className="flex flex-wrap gap-1.5">
              <Tag className={tagStyles["follow-up"]}>+7 days</Tag>
              <Tag className={tagStyles["follow-up"]}>+15 days</Tag>
              <Tag className={tagStyles["follow-up"]}>+30 days</Tag>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

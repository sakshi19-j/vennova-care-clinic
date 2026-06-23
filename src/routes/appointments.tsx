import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Avatar, Tag } from "@/components/clinic/PageHeader";
import { Plus, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardService, type Appointment } from "@/services/dashboard";

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — Vennova Clinic" },
      { name: "description", content: "Today's appointment list from the Vennova backend." },
    ],
    links: [{ rel: "canonical", href: "/appointments" }],
  }),
  component: Appointments,
});

function Appointments() {
  const todayQ = useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => dashboardService.appointmentsToday(),
    staleTime: 30_000, retry: 1,
  });

  const items = todayQ.data ?? [];

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow={`Today · ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`}
        title="Appointments"
        subtitle="Today's scheduled appointments — live from your backend."
        actions={
          <Link to="/reception/appointments" className="inline-flex">
            <Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> Book slot</Button>
          </Link>
        }
      />

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b clinic-divider flex items-center justify-between">
          <h2 className="font-display text-lg">Today's schedule</h2>
          <span className="text-xs text-muted-foreground">/appointments/today</span>
        </div>
        {todayQ.isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <div className="size-10 rounded-full bg-muted mx-auto mb-3 grid place-items-center">
              <CalendarIcon className="size-5" />
            </div>
            No appointments scheduled today.
          </div>
        ) : (
          <ul className="divide-y clinic-divider">
            {items.map((a, i) => <Row key={String(a.id ?? a.appointment_id ?? i)} a={a} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ a }: { a: Appointment }) {
  const name = a.patient_name || a.name || "Patient";
  const when = a.slot_at || a.time;
  const time = when ? new Date(String(when)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
  const status = String(a.status ?? "").toUpperCase();
  return (
    <li className="px-5 py-3 flex items-center gap-3">
      <div className="font-mono text-sm text-muted-foreground w-16 tabular-nums">{time}</div>
      <Avatar name={name} size={32} />
      <div className="flex-1 min-w-0 text-sm font-medium truncate">{name}</div>
      {status && <Tag className="bg-muted border-border text-foreground">{status}</Tag>}
    </li>
  );
}

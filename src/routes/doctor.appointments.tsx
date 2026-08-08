import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, RefreshCw } from "lucide-react";
import { Card, PageHeader, Avatar, Tag } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import { AppointmentCalendar, type CalendarMode } from "@/components/clinic/AppointmentCalendar";
import { useAuth } from "@/hooks/use-auth";
import {
  apptDate, apptStartTime, fetchAppointments, formatSlotLabel, isWorkingDay,
  loadAppointmentSettings, localIsoDate, uiStatus, uiStatusLabel, uiStatusStyles,
} from "@/lib/appointments";

export const Route = createFileRoute("/doctor/appointments")({
  head: () => ({
    meta: [
      { title: "My schedule — Vennova Clinic" },
      { name: "description", content: "Doctor's appointment schedule: today's and upcoming patients at a glance." },
      { property: "og:title", content: "My schedule — Vennova Clinic" },
      { property: "og:description", content: "Doctor's appointment schedule: today's and upcoming patients at a glance." },
      { name: "twitter:title", content: "My schedule — Vennova Clinic" },
      { name: "twitter:description", content: "Doctor's appointment schedule: today's and upcoming patients at a glance." },
    ],
  }),
  component: DoctorSchedule,
});

function DoctorSchedule() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<CalendarMode>("week");
  const [selectedDate, setSelectedDate] = useState(localIsoDate());

  const settingsQ = useQuery({
    queryKey: ["appointment-settings", profile?.clinic_id ?? null],
    queryFn: () => loadAppointmentSettings(profile?.clinic_id ?? null),
    staleTime: 60_000,
  });

  const apptQ = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: fetchAppointments,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const appointments = apptQ.data ?? [];

  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of appointments) {
      if (a.status === "CANCELLED") continue;
      const d = apptDate(a);
      map[d] = (map[d] ?? 0) + 1;
    }
    return map;
  }, [appointments]);

  const dayList = useMemo(
    () =>
      appointments
        .filter((a) => apptDate(a) === selectedDate)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [appointments, selectedDate],
  );

  const upcoming = useMemo(() => {
    const today = localIsoDate();
    return appointments
      .filter((a) => apptDate(a) > today && uiStatus(a.status) !== "CANCELLED")
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, 6);
  }, [appointments]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Doctor"
        title="My schedule"
        subtitle="Today's and upcoming patients, live from the clinic backend."
        actions={
          <Button variant="outline" className="h-9 rounded-full" onClick={() => void apptQ.refetch()}>
            <RefreshCw className={["size-4", apptQ.isFetching ? "animate-spin" : ""].join(" ")} />
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 space-y-4 lg:col-span-4">
          <AppointmentCalendar
            mode={mode}
            onModeChange={setMode}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            countsByDate={countsByDate}
            closedDates={(iso) => (settingsQ.data ? !isWorkingDay(settingsQ.data, iso) : false)}
          />

          <Card className="p-4">
            <h2 className="mb-2 font-display text-base">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled after today.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(a.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
                      {formatSlotLabel(apptStartTime(a))}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{a.patient_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b clinic-divider px-4 py-3 sm:px-5">
              <h2 className="font-display text-base sm:text-lg">
                {selectedDate === localIsoDate()
                  ? "Today's patients"
                  : new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
              </h2>
              <span className="text-xs text-muted-foreground">{dayList.length} scheduled</span>
            </div>
            {apptQ.isLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
                ))}
              </div>
            ) : dayList.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-muted">
                  <CalendarClock className="size-5" />
                </div>
                No appointments on this date.
              </div>
            ) : (
              <ul className="divide-y clinic-divider">
                {dayList.map((a) => {
                  const st = uiStatus(a.status);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="w-20 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                        {formatSlotLabel(apptStartTime(a))}
                      </div>
                      <Avatar name={a.patient_name} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.patient_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.chief_complaint ||
                            (a.visit_type === "ALLOPATHY" ? "Allopathy consultation" : "Homeopathy consultation")}
                        </div>
                      </div>
                      <Tag className={uiStatusStyles[st]}>{uiStatusLabel[st]}</Tag>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Avatar } from "@/components/clinic/PageHeader";
import { patientsService, patientDisplayName, patientPhone } from "@/services/patients";
import { ArrowLeft, Pill, Phone, MapPin, Calendar } from "lucide-react";

export const Route = createFileRoute("/doctor/patients/$id")({
  component: PatientRecord,
});

function PatientRecord() {
  const { id } = Route.useParams();

  const patientQ = useQuery({
    queryKey: ["patient", id],
    queryFn: () => patientsService.get(id),
    staleTime: 30_000,
  });

  const historyQ = useQuery({
    queryKey: ["patient", id, "history"],
    queryFn: () => patientsService.history(id),
    staleTime: 30_000,
  });

  if (patientQ.isLoading) {
    return (
      <Card>
        <div className="h-20 rounded-xl bg-muted/40 animate-pulse" />
      </Card>
    );
  }

  const p = patientQ.data;
  if (!p) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Link to="/doctor/queue" className="text-sm text-primary hover:underline">
          ← Back to today's list
        </Link>
      </Card>
    );
  }

  const h = (historyQ.data as any) || {};
  const visits: any[] = Array.isArray(h) ? h : (h.visits ?? h.history ?? []);
  const totalVisits = h.total_visits ?? p.visit_count ?? visits.length;
  const lastVisit = h.last_visit ?? p.last_visit_at ?? null;
  const name = patientDisplayName(p);
  const phone = patientPhone(p);
  const city = (p as any).res_city || "";
  const regNo = p.reg_no ? `VNC-${String(p.reg_no).padStart(4, "0")}` : "";

  return (
    <div className="space-y-5">
      <Link to="/doctor/queue" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Today's list
      </Link>

      <Card>
        <div className="flex items-start gap-4">
          <Avatar name={name} size={64} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{regNo}</div>
            <div className="font-display text-3xl leading-tight">{name}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {p.age ? `${p.age}y` : ""} {p.gender ? `· ${p.gender}` : ""}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {phone && <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {phone}</span>}
              {city && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {city}</span>}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Last visit {lastVisit ? new Date(lastVisit).toLocaleDateString("en-IN") : "—"}
              </span>
              {(p as any).added_by_staff_name ? (
                <span>Added by: {(p as any).added_by_staff_name}</span>
              ) : null}
            </div>

          </div>
          <div className="text-right">
            <div className="font-display text-3xl">{totalVisits}</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Total visits</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="font-display text-lg mb-3">Visit history</div>
        {historyQ.isLoading ? (
          <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />
        ) : visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prior visits recorded.</p>
        ) : (
          <ol className="relative pl-5 space-y-4">
            <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
            {visits.map((v, i) => {
              const date = v.visit_date || v.closed_at || v.created_at || v.date;
              const rx = v.remedy || v.prescription || (Array.isArray(v.medicines) && v.medicines[0]?.name) || "—";
              return (
                <li key={v.id ?? i} className="relative">
                  <span className="absolute -left-[14px] top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
                  <div className="text-xs text-muted-foreground">
                    {date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </div>
                  <div className="text-sm font-medium mt-0.5">{v.chief_complaint || v.diagnosis || "Consultation"}</div>
                  <div className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                    <Pill className="size-3" /> {rx}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

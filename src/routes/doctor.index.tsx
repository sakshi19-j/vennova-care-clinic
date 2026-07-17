import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useQueue } from "@/lib/queue-store";
import { Search, ArrowRight, User, PlayCircle } from "lucide-react";
import { Card } from "@/components/clinic/PageHeader";

export const Route = createFileRoute("/doctor/")({
  component: DoctorHomePage,
});

function DoctorHomePage() {
  const { profile, clinicName } = useAuth();
  const firstName = (profile?.full_name || "Doctor").split(" ")[0];
  const navigate = useNavigate();
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [activePatientName, setActivePatientName] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const queue = useQueue();
  const inTreatment = queue.find((q) => q.status === "IN_TREATMENT");
  const waiting = queue.filter(
    (q) => q.status === "WAITING" || q.status === "CHECKED_IN",
  ).length;

  useEffect(() => {
    const vid = sessionStorage.getItem("active_visit_id");
    const vname = sessionStorage.getItem("active_patient_name");
    if (vid) setActiveVisitId(vid);
    if (vname) setActivePatientName(vname);
  }, []);

  const patientsQ = useQuery({
    queryKey: ["patients", "all"],
    queryFn: () => api.get<any>("/patients"),
    staleTime: 60_000,
  });

  const patients = useMemo(() => {
    const raw = patientsQ.data;
    const arr = Array.isArray(raw) ? raw : raw?.patients ?? [];
    return arr.map((p: any) => ({
      id: p.id,
      full_name:
        p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      reg_no: p.reg_no ? `VNC-${String(p.reg_no).padStart(4, "0")}` : "",
      last_visit: p.last_visit || null,
      phone: p.phone_mobile || p.phone || "",
      total_visits: p.total_visits || 0,
    }));
  }, [patientsQ.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients.slice(0, 15);
    const q = search.toLowerCase();
    return patients
      .filter(
        (p: any) =>
          p.full_name.toLowerCase().includes(q) ||
          p.reg_no.toLowerCase().includes(q) ||
          p.phone.includes(q),
      )
      .slice(0, 15);
  }, [patients, search]);

  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-2xl">Welcome, Dr. {firstName}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {clinicName || "Vennova Clinic"} · Real-time data from your clinic.
        </div>
      </div>

      {/* Active consultation banner (session storage) */}
      {activeVisitId && (
        <Card className="border-primary/30 bg-primary/5 shadow-[0_0_20px_-4px] shadow-primary/30">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
              <User className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-primary/80">
                Active consultation
              </div>
              <div className="font-display text-lg truncate">
                {activePatientName || "Current patient"}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                activeVisitId
                  ? navigate({ to: "/consultation/edit/$visitId", params: { visitId: activeVisitId } })
                  : navigate({ to: "/doctor/queue" })
              }
              className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2"
            >
              Continue consultation <ArrowRight className="size-4" />
            </button>
          </div>
        </Card>
      )}

      {/* IN_TREATMENT banner from live queue */}
      {!activeVisitId && inTreatment && inTreatment.visit_id && (
        <Card className="border-success/40 bg-success/10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="size-2.5 rounded-full bg-success pulse-dot shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Currently with you
              </div>
              <div className="font-display text-lg truncate">
                #{inTreatment.token_number} · {inTreatment.patient_name}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (inTreatment.visit_id) {
                  navigate({
                    to: "/consultation/edit/$visitId",
                    params: { visitId: inTreatment.visit_id },
                  });
                }
              }}
              className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90"
            >
              Go to consultation <ArrowRight className="size-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Queue shortcut — always visible, prominent */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
        <Link
          to="/doctor/queue"
          className="flex items-center gap-3 -m-2 p-2 rounded-xl hover:bg-primary/5 transition-colors"
        >
          <div className="size-11 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
            <PlayCircle className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg">Today's queue</div>
            <div className="text-xs text-muted-foreground">
              {waiting > 0
                ? `${waiting} patient${waiting === 1 ? "" : "s"} waiting — call next`
                : "No patients waiting right now"}
            </div>
          </div>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>
      </Card>

      {/* Patient history search */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-lg">Patient history</div>
          <Link
            to="/doctor/patients"
            className="text-xs text-primary hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, reg no or phone…"
            className="h-10 pl-9 pr-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {patientsQ.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading patients…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No patients found.
          </div>
        ) : (
          <ul className="mt-4 divide-y clinic-divider">
            {filtered.map((p: any) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/doctor/patients" })}
                  className="w-full flex items-center gap-3 px-1 py-3 hover:bg-muted/50 rounded-lg transition-colors text-left"
                >
                  <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-medium shrink-0">
                    {(p.full_name[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.reg_no}
                      {p.phone ? ` · ${p.phone}` : ""}
                      {p.total_visits > 0
                        ? ` · ${p.total_visits} visit${p.total_visits === 1 ? "" : "s"}`
                        : ""}
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

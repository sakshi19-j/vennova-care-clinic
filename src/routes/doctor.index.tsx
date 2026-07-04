import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Search, ArrowRight, Clock, User } from "lucide-react";
import { Card } from "@/components/clinic/PageHeader";

export const Route = createFileRoute("/doctor/")({
  component: DoctorHomePage,
});

type PatientRow = {
  id: string;
  full_name: string;
  reg_no: string;
  last_visit: string | null;
  phone: string;
};

function DoctorHomePage() {
  const { profile, clinicName } = useAuth();
  const navigate = useNavigate();
  const firstName = (profile?.full_name || "Doctor").split(" ")[0];
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [activePatientName, setActivePatientName] = useState<string | null>(null);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const vid = sessionStorage.getItem("active_visit_id");
    const vname = sessionStorage.getItem("active_patient_name");
    const pid = sessionStorage.getItem("active_patient_id");
    if (vid) setActiveVisitId(vid);
    if (vname) setActivePatientName(vname);
    if (pid) setActivePatientId(pid);
  }, []);

  const patientsQ = useQuery({
    queryKey: ["patients", "all"],
    queryFn: () => api.get<any>("/patients"),
    staleTime: 60_000,
  });

  const patients: PatientRow[] = useMemo(() => {
    const raw = patientsQ.data;
    const arr = Array.isArray(raw) ? raw : raw?.patients ?? raw?.items ?? [];
    return arr.map((p: any) => ({
      id: p.id,
      full_name:
        p.full_name ||
        `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
        "",
      reg_no: p.reg_no ? `VNC-${String(p.reg_no).padStart(4, "0")}` : "",
      last_visit: p.last_visit || null,
      phone: p.phone_mobile || p.phone || "",
    }));
  }, [patientsQ.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients.slice(0, 20);
    const q = search.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.reg_no.toLowerCase().includes(q) ||
          p.phone.includes(q),
      )
      .slice(0, 20);
  }, [patients, search]);

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div>
        <div className="font-display text-2xl">Welcome, Dr. {firstName}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {clinicName || "Vennova Clinic"} · Real-time data from your clinic.
        </div>
      </div>

      {/* Active consultation banner */}
      {activeVisitId && activePatientId && (
        <Card className="border-primary/30 bg-primary/5 shadow-[0_0_20px_-4px] shadow-primary/30 animate-pulse">
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
              onClick={() => navigate({ to: "/doctor/queue" })}
              className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2"
            >
              Continue consultation <ArrowRight className="size-4" />
            </button>
          </div>
        </Card>
      )}


      {/* Go to queue */}
      <Card>
        <Link
          to="/doctor/queue"
          className="flex items-center gap-3 -m-2 p-2 rounded-xl hover:bg-muted/60 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg">Today's queue</div>
            <div className="text-xs text-muted-foreground">
              Call patients in and start consultations
            </div>
          </div>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>
      </Card>

      {/* Patient history search */}
      <Card>
        <div className="font-display text-lg mb-3">Patient history</div>
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
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  to="/doctor/patients/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/40 rounded-lg px-2 -mx-2"
                >
                  <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-medium shrink-0">
                    {(p.full_name[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.reg_no}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </div>
                  </div>
                  {p.last_visit && (
                    <div className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="size-3" />
                      {new Date(p.last_visit).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  )}
                  <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Search, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Card } from "@/components/clinic/PageHeader";

export const Route = createFileRoute("/doctor/patients")({
  component: DoctorPatientsPage,
});

function DoctorPatientsPage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      phone: p.phone_mobile || p.phone || "",
      last_visit: p.last_visit || null,
      total_visits: p.total_visits || 0,
    }));
  }, [patientsQ.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients.slice(0, 30);
    const q = search.toLowerCase();
    return patients
      .filter(
        (p: any) =>
          p.full_name.toLowerCase().includes(q) ||
          p.reg_no.toLowerCase().includes(q) ||
          p.phone.includes(q),
      )
      .slice(0, 30);
  }, [patients, search]);

  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-2xl">Patient Records</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Search any patient and open their full consultation history.
        </div>
      </div>

      <Card>
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, reg no or phone…"
            className="h-11 pl-9 pr-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {patientsQ.isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <ul className="mt-4 divide-y clinic-divider">
            {filtered.map((p: any) => (
              <PatientCard
                key={p.id}
                patient={p}
                expanded={expandedId === p.id}
                onToggle={() =>
                  setExpandedId(expandedId === p.id ? null : p.id)
                }
              />
            ))}
            {filtered.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                No patients found.
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PatientCard({
  patient,
  expanded,
  onToggle,
}: {
  patient: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();

  const visitsQ = useQuery({
    queryKey: ["visits", "patient", patient.id],
    queryFn: () =>
      api.get<any>(`/visits/patient/${encodeURIComponent(patient.id)}`),
    enabled: expanded,
    staleTime: 30_000,
  });

  const visits = useMemo(() => {
    const raw = visitsQ.data;
    return Array.isArray(raw) ? raw : raw?.visits ?? [];
  }, [visitsQ.data]);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
      >
        <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center font-medium shrink-0">
          {(patient.full_name[0] || "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{patient.full_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {patient.reg_no}
            {patient.phone ? ` · ${patient.phone}` : ""}
            {patient.total_visits > 0
              ? ` · ${patient.total_visits} visit${patient.total_visits === 1 ? "" : "s"}`
              : " · No visits yet"}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="pb-4 pl-13 pr-2">
          {visitsQ.isLoading ? (
            <div className="py-4 text-sm text-muted-foreground">
              Loading visits…
            </div>
          ) : visits.length === 0 ? (
            <div className="py-4 text-sm text-muted-foreground">
              No visits recorded yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {visits.map((v: any) => {
                const date = v.visit_date || v.created_at;
                const displayDate = date
                  ? new Date(date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";
                return (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                  >
                    <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                      <FileText className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{displayDate}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {v.chief_complaint || v.visit_type || "Consultation"}
                        {v.payment_status === "PAID" ? " · Paid" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/consultation/edit/$visitId",
                          params: { visitId: v.id },
                        })
                      }
                      className="h-8 px-3 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors shrink-0"
                    >
                      Open
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

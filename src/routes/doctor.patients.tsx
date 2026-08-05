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
      added_by: (p.added_by_staff_name || "").trim(),
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
          {patient.added_by ? (
            <div className="text-[11px] text-muted-foreground truncate">
              Added by: {patient.added_by}
            </div>
          ) : null}
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
              Loading visit timeline…
            </div>
          ) : visits.length === 0 ? (
            <div className="py-4 text-sm text-muted-foreground">
              No visits recorded yet.
            </div>
          ) : (
            <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Visit timeline · {visits.length} visit{visits.length === 1 ? "" : "s"} · newest first
            </div>
          )}
          {visits.length > 0 && (
            <ul className="space-y-2">
              {visits
                .slice()
                .sort((a: any, b: any) => {
                  const da = new Date(a.visit_date || a.created_at || 0).getTime();
                  const db = new Date(b.visit_date || b.created_at || 0).getTime();
                  return db - da;
                })
                .map((v: any, idx: number) => (
                  <VisitTimelineCard
                    key={v.id || idx}
                    visit={v}
                    visitNumber={visits.length - idx}
                    onOpen={() =>
                      navigate({
                        to: "/consultation/edit/$visitId",
                        params: { visitId: v.id },
                      })
                    }
                  />
                ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function VisitTimelineCard({
  visit,
  visitNumber,
  onOpen,
}: {
  visit: any;
  visitNumber: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rawDate = visit.closed_at || visit.visit_date || visit.created_at;
  let displayDate = "—";
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        displayDate = d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch {
      displayDate = "—";
    }
  }
  const visitType =
    visit.visit_type ||
    (visitNumber === 1 ? "New" : "Follow-up");
  const paid = String(visit.payment_status || "").toUpperCase() === "PAID";
  const homeo = visit.homeopathy || {};
  const remedy = homeo.remedy || visit.remedy;
  const potency = homeo.potency || visit.potency;
  const advice = homeo.advice || visit.advice;
  const followupDate = visit.followup_date || visit.next_followup;

  return (
    <li className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-sm hover:border-primary/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <div className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 font-medium text-xs tabular-nums">
          #{visitNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{displayDate}</div>
          <div className="text-xs text-muted-foreground truncate">
            {visitType}
            {visit.chief_complaint ? ` · ${visit.chief_complaint}` : ""}
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${
            paid
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
              : "bg-amber-500/10 text-amber-700 border-amber-500/30"
          }`}
        >
          {paid ? "Paid" : visit.payment_status || "—"}
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t clinic-divider space-y-2 text-sm animate-in fade-in">
          <TimelineField label="Chief complaint" value={visit.chief_complaint} />
          <TimelineField label="Diagnosis" value={visit.diagnosis} />
          <TimelineField label="Symptoms" value={visit.symptoms} />
          <TimelineField label="Vitals" value={visit.vitals} />
          <TimelineField label="Remedy" value={remedy} />
          <TimelineField label="Potency" value={potency} />
          <TimelineField label="Advice" value={advice} />
          <TimelineField label="Prescription" value={visit.prescription} />
          <TimelineField label="Clinical notes" value={visit.clinical_notes || visit.notes} />
          {visit.medicines && Array.isArray(visit.medicines) && visit.medicines.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground pt-0.5">
                Medicines
              </div>
              <div className="col-span-2 space-y-1.5">
                {visit.medicines.map((m: any, mi: number) => (
                  <div key={mi} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">{m.name}</span>
                    {m.potency ? <span className="text-muted-foreground"> · {m.potency}</span> : ""}
                    {m.timing ? <span className="text-muted-foreground"> · {m.timing}</span> : ""}
                    {m.days ? <span className="text-muted-foreground"> · {m.days} days</span> : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
          <TimelineField
            label="Follow-up date"
            value={
              followupDate
                ? new Date(followupDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : null
            }
          />
          <TimelineField label="Doctor" value={visit.doctor_name} />
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpen}
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
            >
              <FileText className="size-3.5" /> Open consultation
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function TimelineField({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  const display =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground pt-0.5">
        {label}
      </div>
      <div className="col-span-2 text-sm">{display}</div>
    </div>
  );
}


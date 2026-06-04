import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, Tag, Avatar } from "@/components/clinic/PageHeader";
import { usePatients, type ExtendedPatient } from "@/lib/queue-store";
import { Search, UserPlus, AlertTriangle, Phone, MapPin, X, Clock, Stethoscope, Pill, IndianRupee, ChevronRight } from "lucide-react";
import { RegisterPatientModal } from "@/components/reception/RegisterPatientModal";

export const Route = createFileRoute("/reception/patients")({
  component: PatientsPage,
});

const typeStyle: Record<string, string> = {
  HOMEOPATHY: "bg-primary/10 text-primary border-primary/20",
  ALLOPATHY: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  BOTH: "bg-gold/20 text-[color-mix(in_oklab,var(--gold)_30%,black)] border-gold/30",
};

function PatientsPage() {
  const patients = usePatients();
  const [q, setQ] = useState("");
  const [regOpen, setRegOpen] = useState(false);
  const [selected, setSelected] = useState<ExtendedPatient | null>(null);

  const results = useMemo(() => {
    const s = q.toLowerCase();
    if (!s) return patients;
    return patients.filter((p) =>
      p.full_name.toLowerCase().includes(s) ||
      p.phone.includes(s) ||
      p.reg_no.toLowerCase().includes(s) ||
      p.city.toLowerCase().includes(s),
    );
  }, [q, patients]);

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className={selected ? "col-span-12 lg:col-span-7" : "col-span-12"}>
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b clinic-divider">
            <div className="relative flex-1 max-w-xl">
              <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, reg no or city…"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <span className="text-xs text-muted-foreground">{results.length} patients</span>
            <button
              onClick={() => setRegOpen(true)}
              className="ml-auto h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90"
            >
              <UserPlus className="size-4" /> New patient
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-5 py-2.5 font-medium">Patient</th>
                  <th className="px-3 py-2.5 font-medium">Reg no</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium hidden md:table-cell">City</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium text-right">Visits</th>
                  <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Last visit</th>
                  <th className="px-3 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(selected?.id === p.id ? null : p)}
                    className={[
                      "border-t clinic-divider hover:bg-muted/40 cursor-pointer transition-colors",
                      p.is_missed ? "bg-amber-500/5" : "",
                      selected?.id === p.id ? "bg-primary/5 ring-1 ring-primary/20 ring-inset" : "",
                    ].join(" ")}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.full_name} size={32} />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {p.full_name}
                            {p.is_missed && (
                              <Tag className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                                <AlertTriangle className="size-3" /> missed
                              </Tag>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {p.age ? `${p.age}y` : ""}
                            {p.age && p.gender ? " · " : ""}
                            {p.gender ?? ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{p.reg_no}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="size-3" /> {p.phone}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {p.city || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Tag className={typeStyle[p.patient_type]}>{p.patient_type}</Tag>
                    </td>
                    <td className="px-3 py-3 text-right font-display text-base">{p.total_visits}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">{p.last_visit ?? "—"}</td>
                    <td className="px-3 py-3">
                      <ChevronRight className={["size-4 transition-transform text-muted-foreground", selected?.id === p.id ? "rotate-90 text-primary" : ""].join(" ")} />
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Patient history panel */}
      {selected && (
        <div className="col-span-12 lg:col-span-5">
          <PatientHistoryPanel patient={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      <RegisterPatientModal open={regOpen} onOpenChange={setRegOpen} />
    </div>
  );
}

function PatientHistoryPanel({ patient, onClose }: { patient: ExtendedPatient; onClose: () => void }) {
  return (
    <div className="sticky top-20 space-y-4">
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar name={patient.full_name} size={44} />
            <div>
              <div className="font-display text-xl">{patient.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {patient.reg_no}
                {patient.age ? ` · ${patient.age}y` : ""}
                {patient.gender ? ` · ${patient.gender}` : ""}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full hover:bg-muted grid place-items-center">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <InfoItem icon={<Phone className="size-3.5" />} label="Phone" value={patient.phone} />
          <InfoItem icon={<MapPin className="size-3.5" />} label="City" value={patient.city || "—"} />
          <InfoItem icon={<Clock className="size-3.5" />} label="Total visits" value={String(patient.total_visits)} />
          <InfoItem icon={<Clock className="size-3.5" />} label="Last visit" value={patient.last_visit ?? "No visits yet"} />
        </div>

        <Tag className={typeStyle[patient.patient_type]}>{patient.patient_type}</Tag>
        {patient.is_missed && (
          <Tag className="ml-2 bg-amber-500/15 text-amber-700 border-amber-500/30">
            <AlertTriangle className="size-3" /> Missed follow-up
          </Tag>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b clinic-divider">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Visit history</div>
          <div className="font-display text-lg mt-0.5">{patient.history.length} recorded visits</div>
        </div>
        {patient.history.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No visit history yet.</div>
        ) : (
          <ul className="divide-y clinic-divider max-h-[500px] overflow-y-auto">
            {patient.history.map((visit) => (
              <li key={visit.visit_id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {new Date(visit.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  {visit.fee !== undefined && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-emerald-700 font-medium">
                      <IndianRupee className="size-3" />{visit.fee}
                      {visit.paid_with && <span className="text-muted-foreground ml-1">· {visit.paid_with}</span>}
                    </span>
                  )}
                </div>
                {visit.doctor_name && (
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Stethoscope className="size-3" /> {visit.doctor_name}
                  </div>
                )}
                {visit.chief_complaint && (
                  <div className="text-sm font-medium mb-1">{visit.chief_complaint}</div>
                )}
                {visit.diagnosis && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">Diagnosis:</span> {visit.diagnosis}
                  </div>
                )}
                {visit.prescription && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                    <Pill className="size-3 mt-0.5 shrink-0" />
                    <span>{visit.prescription}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

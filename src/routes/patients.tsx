import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Search, Plus, Stethoscope, ArrowRight, Users, Loader2, AlertTriangle, ChevronLeft, ChevronRight, UserPlus, Upload, Download,
} from "lucide-react";
import { toast } from "sonner";
import { Card, PageHeader, Avatar } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import { RegisterPatientModal } from "@/components/reception/RegisterPatientModal";
import { patientsService, patientDisplayName, patientPhone, type Patient } from "@/services/patients";
import { importsExportsService } from "@/services/imports-exports";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients — Vennova Clinic" },
      { name: "description", content: "Search, register and manage all your clinic's patient records." },
      { property: "og:title", content: "Patients — Vennova Clinic" },
      { property: "og:description", content: "Search, register and manage all your clinic's patient records." },
      { property: "og:url", content: "https://vennova-care-clinic.lovable.app/patients" },
      { name: "twitter:title", content: "Patients — Vennova Clinic" },
      { name: "twitter:description", content: "Search, register and manage all your clinic's patient records." },
    ],
    links: [{ rel: "canonical", href: "https://vennova-care-clinic.lovable.app/patients" }],
  }),
  component: PatientsPage,
});

const PAGE_SIZE = 25;

function PatientsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [regOpen, setRegOpen] = useState(false);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const listQ = useQuery({
    queryKey: ["patients", "list", debounced, page],
    queryFn: () =>
      patientsService.list({
        search: debounced || undefined,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total;
  const hasNext = items.length === PAGE_SIZE; // backend doesn't always return total
  const hasPrev = page > 0;

  const emptyAccount = !listQ.isLoading && !listQ.error && !debounced && page === 0 && items.length === 0;

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={total != null ? `${total.toLocaleString("en-IN")} records` : items.length > 0 ? "Patient directory" : ""}
        title="Patients"
        subtitle="Search, register and open patient records — connected live to your clinic."
        actions={
          <>
            <Link to="/imports" className="inline-flex">
              <Button variant="outline" className="rounded-full">
                <Upload className="size-4 mr-1" /> Import
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                const tid = toast.loading("Preparing patients CSV…");
                try {
                  await importsExportsService.downloadPatientsCsv();
                  toast.success("Download started", { id: tid });
                } catch (e) {
                  toast.error((e as Error).message || "Export failed", { id: tid });
                }
              }}
            >
              <Download className="size-4 mr-1" /> Export
            </Button>
            <Button onClick={() => setRegOpen(true)} className="rounded-full bg-primary">
              <Plus className="size-4 mr-1" /> Add patient
            </Button>
          </>
        }
      />

      {emptyAccount ? (
        <EmptyAccount onCreate={() => setRegOpen(true)} />
      ) : (
        <Card>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, phone, registration no…"
                aria-label="Search patients"
                maxLength={120}
                className="w-full h-10 pl-9 pr-3 rounded-full border border-border bg-background/60 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              {listQ.isFetching && (
                <Loader2 className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {debounced ? <>Showing results for "<span className="text-foreground">{debounced}</span>"</> : "All patients"}
            </div>
          </div>

          {/* Table / states */}
          {listQ.isLoading ? (
            <TableSkeleton />
          ) : listQ.error ? (
            <ErrorPane onRetry={() => listQ.refetch()} message={(listQ.error as Error).message} />
          ) : items.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              No patients match "{debounced}". Try a different search.
            </div>
          ) : (
            <PatientsTable items={items} onOpen={(id) => navigate({ to: "/patients/$patientId", params: { patientId: id } })} />
          )}

          {/* Pagination */}
          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-between pt-4 border-t clinic-divider mt-4">
              <div className="text-xs text-muted-foreground tabular-nums">
                Page {page + 1}
                {total != null && ` of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!hasPrev}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="h-8 px-3 rounded-full border border-border text-xs inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" /> Prev
                </button>
                <button
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 px-3 rounded-full border border-border text-xs inline-flex items-center gap-1 disabled:opacity-40"
                >
                  Next <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      <RegisterPatientModal
        open={regOpen}
        onOpenChange={setRegOpen}
        onRegistered={(p) => {
          setRegOpen(false);
          if (p?.id) navigate({ to: "/patients/$patientId", params: { patientId: p.id } });
          else listQ.refetch();
        }}
      />
    </div>
  );
}

function PatientsTable({ items, onOpen }: { items: Patient[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
            <th className="text-left font-medium py-2 px-3">Patient</th>
            <th className="text-left font-medium py-2 px-3">Reg. No</th>
            <th className="text-left font-medium py-2 px-3">Phone</th>
            <th className="text-left font-medium py-2 px-3">City</th>
            <th className="text-left font-medium py-2 px-3">Type</th>
            <th className="text-left font-medium py-2 px-3">Last visit</th>
            <th className="text-left font-medium py-2 px-3">Visits</th>
            <th className="text-right font-medium py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            // Backend canonical fields: full_name, phone, city, patient_type,
            // total_visits, last_visit, is_missed, reg_no
            const rec = p as unknown as Record<string, unknown>;
            const name =
              (typeof rec.full_name === "string" && rec.full_name) ||
              patientDisplayName(p);
            const phone =
              (typeof rec.phone === "string" && rec.phone) ||
              patientPhone(p);
            const city = (typeof rec.city === "string" && rec.city) || "";
            const patientType = (typeof rec.patient_type === "string" && rec.patient_type) || "";
            const visits =
              typeof rec.total_visits === "number"
                ? rec.total_visits
                : typeof p.visit_count === "number"
                ? p.visit_count
                : null;
            const lastVisitRaw =
              (typeof rec.last_visit === "string" && rec.last_visit) ||
              p.last_visit_at ||
              null;
            const lastVisit = lastVisitRaw
              ? new Date(lastVisitRaw).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "—";
            const regNo =
              typeof p.reg_no === "number" && p.reg_no > 0
                ? `VNC-${String(p.reg_no).padStart(4, "0")}`
                : "—";
            const isMissed = rec.is_missed === true;

            return (
              <tr key={p.id} className="border-b clinic-divider hover:bg-muted/50 transition group cursor-pointer"
                onClick={() => onOpen(p.id)}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />
                    <div>
                      <div className="font-medium group-hover:text-primary flex items-center gap-2">
                        {name}
                        {isMissed && (
                          <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            Missed
                          </span>
                        )}
                      </div>
                      {p.email && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{p.email}</div>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{regNo}</td>
                <td className="py-3 px-3 text-muted-foreground tabular-nums">{phone || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground">{city || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground uppercase text-[11px]">{patientType || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground">{lastVisit}</td>
                <td className="py-3 px-3 tabular-nums">{visits ?? "—"}</td>
                <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    <Link
                      to="/patients/$patientId"
                      params={{ patientId: p.id }}
                      className="h-8 px-3 rounded-full border border-border inline-flex items-center text-xs hover:bg-background"
                    >
                      Open
                    </Link>
                    <Link
                      to="/consultation/$patientId"
                      params={{ patientId: p.id }}
                      search={(() => {
                        const ALLOWED = ["HOMEOPATHY", "ALLOPATHY", "AYURVEDIC"] as const;
                        const upper = (patientType || "HOMEOPATHY").toUpperCase();
                        const safe = (ALLOWED as readonly string[]).includes(upper) ? upper : "HOMEOPATHY";
                        return { visit_type: safe } as Record<string, string>;
                      })()}
                      className="h-8 px-3 rounded-full bg-primary text-primary-foreground inline-flex items-center gap-1 text-xs hover:bg-primary/90"
                    >
                      <Stethoscope className="size-3.5" /> Consult
                      <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

function ErrorPane({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
        <AlertTriangle className="size-4" /> Couldn't load patients: {message}
      </div>
      <div className="mt-3">
        <Button variant="outline" onClick={onRetry} className="rounded-full">Retry</Button>
      </div>
    </div>
  );
}

function EmptyAccount({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="py-14">
      <div className="max-w-md mx-auto text-center">
        <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-4">
          <Users className="size-6" />
        </div>
        <div className="font-display text-2xl">Create your first patient</div>
        <p className="text-sm text-muted-foreground mt-2">
          Patient records, visits, prescriptions and billing all begin here.
          Register a patient to start building your clinic's history.
        </p>
        <Button onClick={onCreate} className="rounded-full bg-primary mt-5">
          <UserPlus className="size-4 mr-1" /> Register first patient
        </Button>
      </div>
    </Card>
  );
}

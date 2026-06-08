import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Search, Plus, Stethoscope, ArrowRight, Users, Loader2, AlertTriangle, ChevronLeft, ChevronRight, UserPlus,
} from "lucide-react";
import { Card, PageHeader, Avatar } from "@/components/clinic/PageHeader";
import { Button } from "@/components/ui/button";
import { RegisterPatientModal } from "@/components/reception/RegisterPatientModal";
import { patientsService, patientDisplayName, patientPhone, type Patient } from "@/services/patients";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients — Vennova Clinic" },
      { name: "description", content: "Search, register and manage all your clinic's patient records." },
    ],
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
          <Button onClick={() => setRegOpen(true)} className="rounded-full bg-primary">
            <Plus className="size-4 mr-1" /> Add patient
          </Button>
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
            <th className="text-left font-medium py-2 px-3">Gender · Age</th>
            <th className="text-left font-medium py-2 px-3">Last visit</th>
            <th className="text-left font-medium py-2 px-3">Visits</th>
            <th className="text-right font-medium py-2 px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const name = patientDisplayName(p);
            const phone = patientPhone(p);
            const visits = typeof p.visit_count === "number" ? p.visit_count : null;
            const lastVisit = p.last_visit_at ? new Date(p.last_visit_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
            return (
              <tr key={p.id} className="border-b clinic-divider hover:bg-muted/50 transition group cursor-pointer"
                onClick={() => onOpen(p.id)}>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />
                    <div>
                      <div className="font-medium group-hover:text-primary">{name}</div>
                      {p.email && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{p.email}</div>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{p.reg_no ?? "—"}</td>
                <td className="py-3 px-3 text-muted-foreground tabular-nums">{phone || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground">
                  {(p.gender || "—")}{p.age != null ? ` · ${p.age}y` : ""}
                </td>
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
                      to="/homeopathy/queue"
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

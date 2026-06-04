import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHeader, Tag, Avatar } from "@/components/clinic/PageHeader";
import { patients, tagStyles, type PatientTag } from "@/lib/clinic-data";
import { Search, SlidersHorizontal, Upload, Plus, Stethoscope, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients — Vedic Clinic" },
      { name: "description", content: "Search and manage your clinic's patient records, clinical history, follow-up status and visit frequency." },
      { property: "og:title", content: "Patient Directory — Vedic Clinic" },
      { property: "og:description", content: "Search, filter and open patient records with chronicity and follow-up cues." },
    ],
    links: [{ rel: "canonical", href: "/patients" }],
  }),
  component: Patients,
});

const filters: { key: "all" | PatientTag; label: string }[] = [
  { key: "all", label: "All" },
  { key: "chronic", label: "Chronic" },
  { key: "follow-up", label: "Follow-up" },
  { key: "lapsed", label: "Lapsed" },
  { key: "vip", label: "VIP" },
];

function Patients() {
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const list = patients.filter((p) => {
    const matchesFilter = filter === "all" ? true : p.tags.includes(filter);
    const matchesQ = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.phone.includes(q) || p.id.toLowerCase().includes(q.toLowerCase());
    return matchesFilter && matchesQ;
  });

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={`${patients.length.toLocaleString("en-IN")} records`}
        title="Patients"
        subtitle="Search, filter, and recognise patients clinically — chronicity, follow-up status and visit frequency at a glance."
        actions={
          <>
            <Button variant="outline" className="rounded-full"><Upload className="size-4 mr-1" /> Import CSV</Button>
            <Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> Add patient</Button>
          </>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, phone, ID…"
              aria-label="Search patients by name, phone, or ID"
              className="w-full h-10 pl-9 pr-3 rounded-full border border-border bg-background/60 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <button className="h-10 px-3 rounded-full border border-border bg-background/60 text-sm inline-flex items-center gap-2">
            <SlidersHorizontal className="size-4" /> Filters
          </button>
          <div className="flex gap-1.5 flex-wrap">
            {filters.map((f) => {
              const active = f.key === filter;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`h-9 px-3 rounded-full text-sm border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/60 border-border text-foreground/80 hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
                <th className="text-left font-medium py-2 px-3">Patient</th>
                <th className="text-left font-medium py-2 px-3">ID</th>
                <th className="text-left font-medium py-2 px-3">Contact</th>
                <th className="text-left font-medium py-2 px-3">Visits</th>
                <th className="text-left font-medium py-2 px-3">Last visit</th>
                <th className="text-left font-medium py-2 px-3">Tags</th>
                <th className="text-right font-medium py-2 px-3"> </th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b clinic-divider hover:bg-muted/50 transition group">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} />
                      <div>
                        <Link to="/patients/$patientId" params={{ patientId: p.id }} className="font-medium hover:text-primary">{p.name}</Link>
                        <div className="text-xs text-muted-foreground">{p.age} · {p.sex}{p.constitution ? ` · ${p.constitution}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                  <td className="py-3 px-3 text-muted-foreground">{p.phone}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.visits}</span>
                      <VisitBars count={p.visits} />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{p.lastVisit}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <Tag key={t} className={tagStyles[t]}>{t}</Tag>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Link to="/patients/$patientId" params={{ patientId: p.id }} className="h-8 px-3 rounded-full border border-border inline-flex items-center text-xs hover:bg-background">
                        Open
                      </Link>
                      <Link to="/consultation/$visitId" params={{ visitId: "V-2058" }} className="h-8 px-3 rounded-full bg-primary text-primary-foreground inline-flex items-center gap-1 text-xs hover:bg-primary/90">
                        <Stethoscope className="size-3.5" /> Consult
                        <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="text-xs text-muted-foreground">Showing {list.length} of {patients.length}</div>
          <div className="flex gap-2">
            <button className="h-8 px-3 rounded-full border border-border text-xs">Prev</button>
            <button className="h-8 px-3 rounded-full border border-border text-xs">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function VisitBars({ count }: { count: number }) {
  // 5-bar histogram showing recency/frequency
  const bars = [3, 5, 4, 6, Math.min(8, count)];
  const max = Math.max(...bars, 8);
  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-gradient-to-t from-primary/40 to-primary"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

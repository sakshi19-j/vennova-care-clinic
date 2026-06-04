import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Avatar } from "@/components/clinic/PageHeader";
import { rxPatients } from "@/lib/reception-data";
import { getCase } from "@/lib/homeopathy-data";
import { ArrowLeft, Sparkles, Phone, MapPin, Calendar, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/homeopathy/patients/$id")({
  component: PatientRecord,
});

function PatientRecord() {
  const { id } = Route.useParams();
  const p = rxPatients.find((x) => x.id === id);
  const rec = getCase(id);

  if (!p) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Link to="/homeopathy/queue" className="text-sm text-primary hover:underline">← Back to today's list</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/homeopathy/queue" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Today's list
      </Link>

      <Card>
        <div className="flex items-start gap-4">
          <Avatar name={p.full_name} size={64} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{p.reg_no}</div>
            <div className="font-display text-3xl leading-tight">{p.full_name}</div>
            <div className="text-sm text-muted-foreground mt-1">{p.age}y · {p.gender} · {p.patient_type}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {p.phone}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {p.city}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> Last visit {p.last_visit ?? "—"}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl">{p.total_visits}</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Total visits</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-5 space-y-3">
          <div className="font-display text-lg">Constitution & miasm</div>
          <Field label="Constitution" value={rec.constitution ?? "—"} />
          <Field label="Miasm" value={rec.miasm ?? "—"} />
          <Field label="Thermal" value={rec.thermal ?? "—"} />
          <Field label="Mental state" value={rec.mental_state ?? "—"} />
          <div className="grid grid-cols-2 gap-2">
            <ChipBlock label="Desires" tone="primary" items={rec.desires?.length ? rec.desires : ["—"]} />
            <ChipBlock label="Aversions" tone="muted" items={rec.aversions?.length ? rec.aversions : ["—"]} />
          </div>
          <ChipBlock label="Allergies" tone={rec.allergies.length ? "destructive" : "muted"} items={rec.allergies.length ? rec.allergies : ["None"]} />
          {rec.last_visit_summary && (
            <div className="rounded-xl bg-muted/40 border border-border p-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Last visit summary</div>
              <p className="text-sm">{rec.last_visit_summary}</p>
            </div>
          )}
        </Card>

        <Card className="col-span-12 lg:col-span-7">
          <div className="font-display text-lg mb-3">Modalities</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl border border-success/30 bg-success/5 p-3">
              <div className="text-[11px] uppercase tracking-widest text-success inline-flex items-center gap-1 mb-1.5"><ArrowUp className="size-3" /> Better from</div>
              <div className="flex flex-wrap gap-1.5">
                {(rec.modalities.better_from.length ? rec.modalities.better_from : ["—"]).map((m) => (
                  <span key={m} className="text-xs px-2 py-1 rounded-md bg-background border border-success/30">{m}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="text-[11px] uppercase tracking-widest text-destructive inline-flex items-center gap-1 mb-1.5"><ArrowDown className="size-3" /> Worse from</div>
              <div className="flex flex-wrap gap-1.5">
                {(rec.modalities.worse_from.length ? rec.modalities.worse_from : ["—"]).map((m) => (
                  <span key={m} className="text-xs px-2 py-1 rounded-md bg-background border border-destructive/30">{m}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="font-display text-lg mb-3">Prescription history</div>
          <ol className="relative pl-5 space-y-4">
            <span className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
            {rec.history.length === 0 && <li className="text-sm text-muted-foreground">No prior visits recorded.</li>}
            {rec.history.map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[14px] top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
                <div className="text-xs text-muted-foreground">{h.date}</div>
                <div className="text-sm font-medium mt-0.5">{h.complaint}</div>
                <div className="text-xs text-primary inline-flex items-center gap-1 mt-1"><Sparkles className="size-3" /> {h.remedy}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ChipBlock({ label, items, tone }: { label: string; items: string[]; tone: "destructive" | "primary" | "muted" }) {
  const map = {
    destructive: "bg-destructive/10 border-destructive/30 text-destructive",
    primary: "bg-primary/10 border-primary/20 text-primary",
    muted: "bg-muted border-border text-muted-foreground",
  } as const;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => <span key={x} className={`text-xs px-2 py-1 rounded-md border ${map[tone]}`}>{x}</span>)}
      </div>
    </div>
  );
}

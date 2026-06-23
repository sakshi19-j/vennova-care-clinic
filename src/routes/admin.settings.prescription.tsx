import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/clinic/PageHeader";
import { FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/settings/prescription")({
  component: RxTemplate,
});

const templates = [
  { id: "t1", name: "Default — Allopathy",   updated: "2026-04-21", sections: ["Header", "Patient", "Rx", "Advice", "Signature"] },
  { id: "t2", name: "Default — Homeopathy",  updated: "2026-05-02", sections: ["Header", "Patient", "Symptoms", "Remedy", "Repetition", "Signature"] },
  { id: "t3", name: "Lab investigation",     updated: "2026-03-11", sections: ["Header", "Patient", "Tests", "Notes"] },
];

function RxTemplate() {
  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 lg:col-span-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-lg inline-flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" /> Templates
          </div>
          <button className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
            <Plus className="size-3.5" /> New
          </button>
        </div>
        <ul className="space-y-2">
          {templates.map((t, i) => (
            <li key={t.id} className={`p-3 rounded-xl border ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40"}`}>
              <div className="font-medium text-sm">{t.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Updated {t.updated}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{t.sections.join(" · ")}</div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="col-span-12 lg:col-span-7">
        <div className="font-display text-lg mb-3">Editor — Default Allopathy</div>
        <div className="rounded-xl border border-border bg-card p-5 min-h-[420px] font-mono text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
{`{{clinic.name}}                          Reg #{{clinic.reg_no}}
{{clinic.address}}                        {{clinic.phone}}
────────────────────────────────────────────────────────────────
Patient   : {{patient.name}}   Age/Sex : {{patient.age}}/{{patient.gender}}
Reg No    : {{patient.reg_no}} Date    : {{visit.date}}
Doctor    : {{doctor.name}}    Visit # : {{visit.no}}
────────────────────────────────────────────────────────────────

Chief complaint
  {{visit.chief_complaint}}

Rx
  1. {{medicines[0]}}
  2. {{medicines[1]}}
  3. {{medicines[2]}}

Advice
  {{advice}}

Follow-up: {{followup.date}}                  Dr. {{doctor.name}}`}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="h-10 px-4 rounded-xl border border-border text-sm hover:bg-muted">Preview PDF</button>
          <button className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Save template</button>
        </div>
      </Card>
    </div>
  );
}

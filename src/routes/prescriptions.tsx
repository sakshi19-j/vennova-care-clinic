import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Tag } from "@/components/clinic/PageHeader";
import { prescriptions, getPatient, tagStyles } from "@/lib/clinic-data";
import { Plus, Eye, Download, Send, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/prescriptions")({
  head: () => ({
    meta: [
      { title: "Prescriptions — Vedic Clinic" },
      { name: "description", content: "Branded prescription PDFs with WhatsApp delivery, dosage shortcuts and saved templates for fast Rx writing." },
      { property: "og:title", content: "Prescriptions — Vedic Clinic" },
      { property: "og:description", content: "Generate, deliver and track Rx with branded PDF templates." },
    ],
    links: [{ rel: "canonical", href: "/prescriptions" }],
  }),
  component: Prescriptions,
});

function Prescriptions() {
  const featured = prescriptions[0];
  const fp = getPatient(featured.patientId)!;
  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="Auto-generated PDFs" title="Prescriptions"
        subtitle="Branded RX PDFs with WhatsApp delivery, dosage shortcuts and saved templates."
        actions={<Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> New Prescription</Button>} />

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-7 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b clinic-divider"><h2 className="font-display text-lg">Recent prescriptions</h2></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
                <th className="text-left font-medium py-2 px-5">ID</th>
                <th className="text-left font-medium py-2 px-3">Patient</th>
                <th className="text-left font-medium py-2 px-3">Date</th>
                <th className="text-left font-medium py-2 px-3">Remedy</th>
                <th className="text-left font-medium py-2 px-3">Status</th>
                <th className="py-2 px-5"> </th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((rx) => {
                const p = getPatient(rx.patientId)!;
                return (
                  <tr key={rx.id} className="border-b clinic-divider hover:bg-muted/50">
                    <td className="py-3 px-5 font-mono text-xs text-muted-foreground">{rx.id}</td>
                    <td className="py-3 px-3 font-medium">{p.name}</td>
                    <td className="py-3 px-3 text-muted-foreground">{rx.date}</td>
                    <td className="py-3 px-3">{rx.remedy} {rx.potency}</td>
                    <td className="py-3 px-3"><Tag className={rx.status === "Sent" ? tagStyles.active : tagStyles["follow-up"]}>{rx.status}</Tag></td>
                    <td className="py-3 px-5">
                      <div className="flex justify-end gap-1">
                        <button aria-label={`Preview prescription ${rx.id}`} className="size-8 rounded-full hover:bg-background border border-transparent hover:border-border inline-flex items-center justify-center"><Eye className="size-4" /></button>
                        <button aria-label={`Download prescription ${rx.id}`} className="size-8 rounded-full hover:bg-background border border-transparent hover:border-border inline-flex items-center justify-center"><Download className="size-4" /></button>
                        <button aria-label={`Send prescription ${rx.id} on WhatsApp`} className="size-8 rounded-full hover:bg-background border border-transparent hover:border-border inline-flex items-center justify-center"><Send className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* Preview */}
        <Card className="col-span-12 lg:col-span-5 p-0 overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_82%,black)] text-primary-foreground flex items-center gap-2">
            <Leaf className="size-5 text-gold" />
            <div>
              <div className="font-display text-xl leading-tight">Vedic Homeopathic Clinic</div>
              <div className="text-xs text-primary-foreground/70">Dr. R. Sharma · Reg. 12345 · Pune</div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between text-sm mb-4">
              <div><span className="text-muted-foreground">Patient:</span> {fp.name}, {fp.age}/{fp.sex}</div>
              <div className="text-muted-foreground">10 May 2026</div>
            </div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">RX</div>
            <ol className="space-y-1.5 text-sm mb-4">
              <li>1. Pulsatilla 200C — 3 doses, alternate days</li>
              <li>2. Sac Lac globules — TDS for 14 days</li>
              <li>3. Calc Phos 6X — BD for 14 days</li>
            </ol>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Advice</div>
            <p className="text-sm">Avoid coffee & strong perfumes. Light early dinner. Walk for 30 min daily.</p>
            <div className="flex items-center justify-between mt-5 text-sm">
              <div className="text-muted-foreground">Follow-up: 24 May 2026</div>
              <div className="font-display italic">Dr. R. Sharma</div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="rounded-full flex-1"><Download className="size-4 mr-1" /> PDF</Button>
              <Button className="rounded-full flex-1 bg-primary"><Send className="size-4 mr-1" /> WhatsApp</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

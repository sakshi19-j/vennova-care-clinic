import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader } from "@/components/clinic/PageHeader";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Clinic Settings — Vedic Clinic" },
      { name: "description", content: "Configure clinic branding, working hours, prescription templates, WhatsApp/SMS, billing and backups." },
      { property: "og:title", content: "Clinic Settings — Vedic Clinic" },
      { property: "og:description", content: "Clinic profile, working hours, prescription templates, billing and integrations." },
      { property: "og:url", content: "https://care-flow-fix.lovable.app/settings" },
    ],
    links: [{ rel: "canonical", href: "https://care-flow-fix.lovable.app/settings" }],
  }),
  component: () => (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader eyebrow="Clinic" title="Settings" subtitle="Branding, working hours, prescription templates and integrations." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { t: "Clinic profile", d: "Name, address, registration." },
          { t: "Working hours", d: "Slot lengths, break times, holidays." },
          { t: "Prescription templates", d: "Saved sets, dosages, instructions." },
          { t: "WhatsApp & SMS", d: "Twilio integration and sender ID." },
          { t: "Billing", d: "GST, invoice numbering, modes." },
          { t: "Backups", d: "Daily exports and recovery." },
        ].map((s) => (
          <Card key={s.t}>
            <div className="font-display text-xl">{s.t}</div>
            <p className="text-sm text-muted-foreground mt-1">{s.d}</p>
          </Card>
        ))}
      </div>
    </div>
  ),
});

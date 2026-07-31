import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { Download, Loader2, Users, Stethoscope, Receipt, BellRing, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importsExportsService } from "@/services/imports-exports";

export const Route = createFileRoute("/exports")({
  head: () => ({
    meta: [
      { title: "Export Center — Vennova Clinic" },
      { name: "description", content: "Download CSV exports of patients, visits, billing and follow-ups." },
      { property: "og:title", content: "Export Center — Vennova Clinic" },
      { property: "og:description", content: "Download CSV exports of patients, visits, billing and follow-ups." },
      { property: "og:url", content: "https://vennova-care-clinic.lovable.app/exports" },
      { name: "twitter:title", content: "Export Center — Vennova Clinic" },
      { name: "twitter:description", content: "Download CSV exports of patients, visits, billing and follow-ups." },
    ],
    links: [{ rel: "canonical", href: "https://vennova-care-clinic.lovable.app/exports" }],
  }),
  component: Exports,
});

function Exports() {
  const [busy, setBusy] = useState(false);
  const onPatients = async () => {
    setBusy(true);
    const tid = toast.loading("Preparing patients CSV…");
    try {
      await importsExportsService.downloadPatientsCsv();
      toast.success("Download started", { id: tid });
    } catch (e) {
      toast.error((e as Error).message || "Export failed", { id: tid });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        eyebrow="CSV downloads"
        title="Export Center"
        subtitle="Download clinic data for accounting, backups and external analytics."
        actions={
          <Link to="/imports" className="inline-flex">
            <Button variant="outline" className="rounded-full">
              Import Patients <ArrowRight className="size-4 ml-1" />
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ExportCard
          icon={Users}
          title="Patients"
          description="All patient records with contact, demographics and visit counts."
          endpoint="GET /exports/patients/csv"
        >
          <Button onClick={onPatients} disabled={busy} className="rounded-full bg-primary">
            {busy ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />}
            Download CSV
          </Button>
        </ExportCard>

        <ExportCard
          icon={Stethoscope}
          title="Visits"
          description="Consultation records with diagnosis and fees."
          endpoint="Coming soon"
          disabled
        />
        <ExportCard
          icon={Receipt}
          title="Billing"
          description="All collected payments and pending bills."
          endpoint="Coming soon"
          disabled
        />
        <ExportCard
          icon={BellRing}
          title="Followups"
          description="Followup schedule and reminder delivery status."
          endpoint="Coming soon"
          disabled
        />
      </div>
    </div>
  );
}

function ExportCard({
  icon: Icon, title, description, endpoint, children, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description: string; endpoint: string;
  children?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <Card className={disabled ? "opacity-60" : ""}>
      <div className="flex items-start gap-3">
        <span className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Icon className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg">{title}</div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          <div className="text-[11px] text-muted-foreground font-mono mt-2">{endpoint}</div>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
      {disabled && <div className="mt-4"><Button variant="outline" className="rounded-full" disabled>Coming soon</Button></div>}
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { DatabaseBackup, CheckCircle2, Cloud, Download } from "lucide-react";

export const Route = createFileRoute("/admin/settings/backups")({
  component: Backups,
});

const backups = [
  { id: "b1", at: "Today · 02:00", size: "412 MB", status: "OK" as const,    target: "Cloud" },
  { id: "b2", at: "Yesterday · 02:00", size: "408 MB", status: "OK" as const, target: "Cloud" },
  { id: "b3", at: "2 days ago · 02:00", size: "402 MB", status: "OK" as const, target: "Cloud" },
  { id: "b4", at: "3 days ago · 02:00", size: "398 MB", status: "OK" as const, target: "Cloud" },
];

function Backups() {
  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 lg:col-span-4">
        <div className="font-display text-lg mb-3 inline-flex items-center gap-2">
          <DatabaseBackup className="size-4 text-muted-foreground" /> Backup policy
        </div>
        <Row label="Schedule"     value="Daily at 02:00 IST" />
        <Row label="Destination"  value="Encrypted cloud (S3)" />
        <Row label="Retention"    value="30 days rolling" />
        <Row label="Encryption"   value="AES-256" />
        <div className="mt-4 flex gap-2">
          <button className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Cloud className="size-4" /> Run backup now
          </button>
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-8 p-0 overflow-hidden">
        <div className="px-5 py-4 border-b clinic-divider font-display text-lg">Recent backups</div>
        <ul className="divide-y clinic-divider">
          {backups.map((b) => (
            <li key={b.id} className="px-5 py-3 flex items-center gap-3 text-sm">
              <CheckCircle2 className="size-4 text-success" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{b.at}</div>
                <div className="text-xs text-muted-foreground">{b.target} · {b.size}</div>
              </div>
              <Tag className="bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30">{b.status}</Tag>
              <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Download className="size-3.5" /> Download
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

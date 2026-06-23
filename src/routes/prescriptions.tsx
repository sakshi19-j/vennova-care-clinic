import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader, Tag } from "@/components/clinic/PageHeader";
import { Eye, Download, Send, Loader2, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prescriptionsService, type Prescription } from "@/services/prescriptions";

export const Route = createFileRoute("/prescriptions")({
  head: () => ({
    meta: [
      { title: "Prescriptions — Vennova Clinic" },
      { name: "description", content: "Branded prescription PDFs with WhatsApp delivery." },
    ],
    links: [{ rel: "canonical", href: "/prescriptions" }],
  }),
  component: Prescriptions,
});

const statusTag: Record<string, string> = {
  SENT: "bg-green-100 border-green-300 text-green-800",
  SIGNED: "bg-green-100 border-green-300 text-green-800",
  DRAFT: "bg-amber-100 border-amber-300 text-amber-800",
};

function Prescriptions() {
  const listQ = useQuery({
    queryKey: ["prescriptions", "recent"],
    queryFn: () => prescriptionsService.recent({ limit: 50 }),
    staleTime: 30_000, retry: 1,
  });

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="Live" title="Prescriptions"
        subtitle="Branded Rx PDFs with WhatsApp delivery — pulled live from your backend." />

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b clinic-divider flex items-center justify-between">
          <h2 className="font-display text-lg">Recent prescriptions</h2>
          <span className="text-xs text-muted-foreground">/prescriptions</span>
        </div>
        {listQ.isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : listQ.error ? (
          <ErrPane msg={(listQ.error as Error).message} onRetry={() => listQ.refetch()} />
        ) : (listQ.data ?? []).length === 0 ? (
          <EmptyState />
        ) : (
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
              {(listQ.data ?? []).map((rx) => <Row key={String(rx.id ?? rx.prescription_id ?? rx.visit_id)} rx={rx} />)}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Row({ rx }: { rx: Prescription }) {
  const id = String(rx.id ?? rx.prescription_id ?? rx.visit_id ?? "");
  const visitId = String(rx.visit_id ?? rx.id ?? "");
  const pdfUrl = visitId ? prescriptionsService.pdfUrl(visitId) : null;
  const status = String(rx.status ?? "DRAFT").toUpperCase();
  const date = rx.created_at || rx.visit_date || rx.date;

  const wa = useMutation({
    mutationFn: () => prescriptionsService.sendWhatsApp(visitId),
    onSuccess: () => toast.success("Prescription sent on WhatsApp"),
    onError: (e: Error) => toast.error(e.message || "WhatsApp send failed"),
  });

  return (
    <tr className="border-b clinic-divider hover:bg-muted/50">
      <td className="py-3 px-5 font-mono text-xs text-muted-foreground">{id.slice(0, 8) || "—"}</td>
      <td className="py-3 px-3 font-medium">{rx.patient_name || "—"}</td>
      <td className="py-3 px-3 text-muted-foreground">{date ? new Date(String(date)).toLocaleDateString("en-IN") : "—"}</td>
      <td className="py-3 px-3">{[rx.remedy, rx.potency].filter(Boolean).join(" ") || rx.diagnosis || "—"}</td>
      <td className="py-3 px-3"><Tag className={statusTag[status] || "bg-muted text-foreground border-border"}>{status}</Tag></td>
      <td className="py-3 px-5">
        <div className="flex justify-end gap-1">
          {pdfUrl && (
            <>
              <a href={pdfUrl} target="_blank" rel="noreferrer" aria-label="Open prescription"
                className="size-8 rounded-full hover:bg-background border border-transparent hover:border-border inline-flex items-center justify-center">
                <Eye className="size-4" />
              </a>
              <a href={pdfUrl} download aria-label="Download prescription"
                className="size-8 rounded-full hover:bg-background border border-transparent hover:border-border inline-flex items-center justify-center">
                <Download className="size-4" />
              </a>
            </>
          )}
          <button
            onClick={() => wa.mutate()}
            disabled={wa.isPending || !visitId}
            aria-label="Send prescription on WhatsApp"
            className="size-8 rounded-full hover:bg-background border border-transparent hover:border-border inline-flex items-center justify-center disabled:opacity-50"
          >
            {wa.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center text-sm text-muted-foreground">
      <div className="size-10 rounded-full bg-muted mx-auto mb-3 grid place-items-center">
        <FileText className="size-5" />
      </div>
      No prescriptions yet. Start a consultation to write your first Rx.
    </div>
  );
}

function ErrPane({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
        <AlertTriangle className="size-4" /> {msg}
      </div>
      <div className="mt-3"><Button variant="outline" onClick={onRetry} className="rounded-full">Retry</Button></div>
    </div>
  );
}

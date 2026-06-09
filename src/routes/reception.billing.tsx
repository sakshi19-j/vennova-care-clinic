import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, Tag, Avatar } from "@/components/clinic/PageHeader";
import { rxRevenueToday } from "@/lib/reception-data";
import type { PaymentMode } from "@/lib/reception-data";
import { queueActions, useQueue } from "@/lib/queue-store";
import {
  X, CheckCircle2, IndianRupee,
  Smartphone, Banknote, CreditCard, Globe, RotateCw, Eye, FileText, ArrowRight, Download,
  Clock, AlertCircle,
} from "lucide-react";
import jsPDF from "jspdf";

export const Route = createFileRoute("/reception/billing")({
  component: BillingPage,
});

function BillingPage() {
  const queue = useQueue();

  // Patients the doctor has marked done, awaiting payment
  const pending = queue
    .filter((r) => (r.status === "DONE" || r.status === "COMPLETED") && !r.paid)
    .sort((a, b) => a.token_number - b.token_number);

  // Bills already collected → invoices sent automatically
  const queuePaid = queue
    .filter((r) => r.paid && (r.status === "DONE" || r.status === "COMPLETED"))
    .sort((a, b) => (b.invoice_sent_at ?? 0) - (a.invoice_sent_at ?? 0));

  const [revenue] = useState({ ...rxRevenueToday });
  const [viewingInvoice, setViewingInvoice] = useState<typeof queuePaid[number] | null>(null);

  const collect = (row: typeof pending[number], mode: PaymentMode) => {
    const res = queueActions.collectPayment(row.queue_id, mode);
    if (res) {
      toast.success(
        `${mode} ₹${res.amount} collected · invoice sent to ${row.patient_name.split(" ")[0]}`,
      );
    }
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* ── Main column ── */}
      <div className="col-span-12 lg:col-span-8 space-y-5">
        {/* Pending payment */}
        {pending.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b clinic-divider">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sent from doctor — awaiting payment</div>
                <div className="font-display text-lg">Collect payment</div>
              </div>
              <Tag className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                <Clock className="size-3" /> {pending.length}
              </Tag>
            </div>
            <ul className="divide-y clinic-divider">
              {pending.map((r) => (
                <li key={r.queue_id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-mono text-sm w-10 text-muted-foreground shrink-0">#{r.token_number}</span>
                  <Avatar name={r.patient_name} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.patient_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.visit_type} · {r.patient_phone}
                    </div>
                  </div>
                  <div className="hidden sm:block font-display text-lg text-foreground tabular-nums shrink-0">
                    ₹{r.fee}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => collect(r, "CASH")}
                      className="h-8 px-3 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
                    >
                      <Banknote className="size-3.5" /> Cash
                    </button>
                    <button
                      onClick={() => collect(r, "UPI")}
                      className="h-8 px-3 text-xs rounded-md bg-amber-500 text-white hover:bg-amber-600 inline-flex items-center gap-1.5"
                    >
                      <Smartphone className="size-3.5" /> UPI
                    </button>
                    <button
                      onClick={() => collect(r, "CARD")}
                      className="h-8 px-2.5 text-xs rounded-md border border-border hover:bg-muted inline-flex items-center gap-1.5 text-muted-foreground"
                    >
                      <CreditCard className="size-3.5" /> Card
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <div className="size-12 rounded-full bg-muted grid place-items-center mb-3">
              <AlertCircle className="size-5 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base">No payments pending</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Patients sent from the doctor will appear here for collection.
            </p>
          </div>
        )}

        {/* Invoices sent */}
        {queuePaid.length > 0 ? (
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b clinic-divider">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Today — invoices sent</div>
                <div className="font-display text-lg">Paid visits</div>
              </div>
              <Tag className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">{queuePaid.length}</Tag>
            </div>
            <ul className="divide-y clinic-divider">
              {queuePaid.map((r) => (
                <li key={r.queue_id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-mono text-sm w-10 text-muted-foreground shrink-0">#{r.token_number}</span>
                  <Avatar name={r.patient_name} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{r.patient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.visit_type} · Paid {r.paid_with} ₹{r.fee}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Tag className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                      <CheckCircle2 className="size-3" /> Invoice sent
                    </Tag>
                    <button
                      onClick={() => setViewingInvoice(r)}
                      title="View invoice"
                      className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-muted inline-flex items-center gap-1.5 text-muted-foreground"
                    >
                      <Eye className="size-3.5" /> View
                    </button>
                    <button
                      onClick={() => {
                        queueActions.resendInvoice(r.queue_id);
                        toast.success(`Invoice re-sent on WhatsApp to ${r.patient_name.split(" ")[0]}`);
                      }}
                      title="Re-send invoice manually"
                      className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-muted inline-flex items-center gap-1.5 text-muted-foreground"
                    >
                      <RotateCw className="size-3.5" /> Resend
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <div className="size-12 rounded-full bg-muted grid place-items-center mb-3">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base">No invoices yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Once you collect a payment above, the invoice is generated and sent automatically.
            </p>
            <a
              href="/reception"
              className="mt-4 h-9 px-5 rounded-full bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:bg-primary/90"
            >
              Go to queue <ArrowRight className="size-3.5" />
            </a>
          </div>
        )}
      </div>


      {/* ── Revenue sidebar ── */}
      <div className="col-span-12 lg:col-span-4 space-y-5">
        <Card>
          <div className="font-display text-xl mb-1">Today's revenue</div>
          <div className="font-display text-5xl text-primary inline-flex items-center mt-1">
            <IndianRupee className="size-7" />{revenue.total.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{revenue.count} paid visits</div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {(["CASH", "UPI", "CARD", "ONLINE"] as const).map((m) => (
              <div key={m} className="rounded-xl border border-border p-3 flex items-center gap-2">
                <PayIcon mode={m} />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{m}</div>
                  <div className="font-display text-base inline-flex items-center">
                    <IndianRupee className="size-3" />{(revenue[m] ?? 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Invoice viewer ── */}
      {viewingInvoice && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4"
          onClick={() => setViewingInvoice(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md clinic-card p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Invoice</div>
                <h2 className="font-display text-2xl">{viewingInvoice.patient_name}</h2>
                <div className="text-xs text-muted-foreground">Token #{viewingInvoice.token_number}</div>
              </div>
              <button onClick={() => setViewingInvoice(null)} className="size-9 rounded-full hover:bg-muted grid place-items-center"><X className="size-4" /></button>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-display text-base">Vedic Homeopathic Clinic</div>
                  <div className="text-xs text-muted-foreground">Invoice #{viewingInvoice.queue_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Date</div>
                  <div className="text-xs">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
              </div>
              <div className="border-t border-border pt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{viewingInvoice.patient_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Consultation ({viewingInvoice.visit_type})</span><span>₹{viewingInvoice.fee}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid via</span><span>{viewingInvoice.paid_with}</span></div>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-display text-base">
                <span>Total</span>
                <span className="text-primary">₹{viewingInvoice.fee}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => downloadInvoicePdf(viewingInvoice)}
                className="flex-1 h-10 rounded-full border border-border text-sm hover:bg-muted inline-flex items-center justify-center gap-1.5"
              >
                <Download className="size-4" /> Download PDF
              </button>
              <button onClick={() => setViewingInvoice(null)} className="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm hover:bg-primary/90">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PayIcon({ mode }: { mode: string }) {
  const icons: Record<string, React.ReactNode> = {
    CASH: <Banknote className="size-4 text-emerald-600" />,
    UPI: <Smartphone className="size-4 text-amber-600" />,
    CARD: <CreditCard className="size-4 text-blue-600" />,
    ONLINE: <Globe className="size-4 text-violet-600" />,
  };
  return <>{icons[mode] ?? null}</>;
}

function downloadInvoicePdf(r: { queue_id: string; patient_name: string; token_number: number; visit_type: string; fee: number; paid_with?: string | null }) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Vedic Homeopathic Clinic", 40, 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Invoice #${r.queue_id}`, 40, 68);
  doc.text(`Date: ${date}`, 40, 82);
  doc.line(40, 95, 380, 95);
  doc.setFontSize(11);
  doc.text(`Patient: ${r.patient_name}`, 40, 115);
  doc.text(`Token: #${r.token_number}`, 40, 132);
  doc.text(`Consultation (${r.visit_type})`, 40, 160);
  doc.text(`Rs. ${r.fee}`, 320, 160, { align: "right" });
  doc.text(`Paid via`, 40, 178);
  doc.text(r.paid_with ?? "—", 320, 178, { align: "right" });
  doc.line(40, 195, 380, 195);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("Total", 40, 215);
  doc.text(`Rs. ${r.fee}`, 320, 215, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Thank you for your visit.", 40, 250);
  doc.save(`invoice-${r.queue_id}.pdf`);
}


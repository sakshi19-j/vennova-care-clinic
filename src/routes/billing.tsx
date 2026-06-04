import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, Tag } from "@/components/clinic/PageHeader";
import { invoices, getPatient, tagStyles } from "@/lib/clinic-data";
import { Plus, Banknote, Smartphone, CreditCard, Clock, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Receipts — Vedic Clinic" },
      { name: "description", content: "One-click cash, UPI and card payments with GST-ready receipts and auto-print after every transaction." },
      { property: "og:title", content: "Billing & Receipts — Vedic Clinic" },
      { property: "og:description", content: "Take payments, generate GST-ready receipts and track collections." },
    ],
    links: [{ rel: "canonical", href: "/billing" }],
  }),
  component: Billing,
});

function Billing() {
  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="Receipts auto-generated" title="Billing & Receipts"
        subtitle="One-click payment modes, GST-ready receipts, and auto-print after payment."
        actions={<Button className="rounded-full bg-primary"><Plus className="size-4 mr-1" /> New invoice</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { l: "Today", v: "₹27,400" },
          { l: "This week", v: "₹1,18,200" },
          { l: "UPI", v: "₹14,200" },
          { l: "Cash", v: "₹9,800" },
        ].map((s) => (
          <Card key={s.l}><div className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.l}</div><div className="font-display text-3xl mt-1">{s.v}</div></Card>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b clinic-divider"><h2 className="font-display text-lg">Recent invoices</h2></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
                <th className="text-left font-medium py-2 px-5">Invoice</th>
                <th className="text-left font-medium py-2 px-3">Patient</th>
                <th className="text-left font-medium py-2 px-3">Amount</th>
                <th className="text-left font-medium py-2 px-3">Mode</th>
                <th className="text-left font-medium py-2 px-3">Status</th>
                <th className="text-left font-medium py-2 px-3">Date</th>
                <th className="py-2 px-5"> </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((iv) => {
                const p = getPatient(iv.patientId)!;
                return (
                  <tr key={iv.id} className="border-b clinic-divider hover:bg-muted/50">
                    <td className="py-3 px-5 font-mono text-xs text-muted-foreground">{iv.id}</td>
                    <td className="py-3 px-3 font-medium">{p.name}</td>
                    <td className="py-3 px-3">₹{iv.amount}</td>
                    <td className="py-3 px-3">{iv.mode}</td>
                    <td className="py-3 px-3"><Tag className={iv.status === "Paid" ? tagStyles.active : tagStyles["follow-up"]}>{iv.status}</Tag></td>
                    <td className="py-3 px-3 text-muted-foreground">{iv.date}</td>
                    <td className="py-3 px-5 text-right">
                      <button aria-label={`Download invoice ${iv.id}`} className="size-8 rounded-full hover:bg-background border border-transparent hover:border-border inline-flex items-center justify-center"><Download className="size-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card>
            <h2 className="font-display text-xl mb-3">Take payment</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { i: Banknote, l: "Cash" },
                { i: Smartphone, l: "UPI" },
                { i: CreditCard, l: "Card" },
                { i: Clock, l: "Pending" },
              ].map((b) => (
                <button key={b.l} className="rounded-xl border border-border px-3 py-3 hover:bg-muted/60 text-sm font-medium inline-flex items-center gap-2">
                  <span className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><b.i className="size-4" /></span>
                  {b.l}
                </button>
              ))}
            </div>
            <Button variant="outline" className="rounded-full w-full mt-3"><Printer className="size-4 mr-1" /> Print receipt</Button>
          </Card>
          <Card className="bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_82%,black)] text-primary-foreground border-transparent">
            <div className="text-[11px] uppercase tracking-widest text-primary-foreground/70">Subscription</div>
            <div className="font-display text-3xl mt-1">ClinicPro</div>
            <div className="text-sm text-primary-foreground/80 mt-1">Renews 12 Jun 2026 · ₹1,499/mo</div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {["Unlimited patients","WhatsApp reminders","Advanced analytics","Multi-staff access","Priority support"].map((f) => (
                <li key={f} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-gold" />{f}</li>
              ))}
            </ul>
            <Button variant="outline" className="rounded-full w-full mt-4 bg-white/10 border-white/20 text-primary-foreground hover:bg-white/15">Manage plan</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

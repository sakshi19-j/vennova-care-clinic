import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/clinic/PageHeader";
import { ReceiptText } from "lucide-react";

export const Route = createFileRoute("/admin/settings/billing")({
  component: BillingSettings,
});

function BillingSettings() {
  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 lg:col-span-7">
        <div className="font-display text-lg mb-3 inline-flex items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground" /> GST & invoice configuration
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="GSTIN"               defaultValue="27ABCDE1234F1Z5" />
          <Field label="State code"          defaultValue="27 — Maharashtra" />
          <Field label="PAN"                 defaultValue="ABCDE1234F" />
          <Field label="HSN / SAC"           defaultValue="9993 — Human health" />
          <Field label="Invoice prefix"      defaultValue="INV-" />
          <Field label="Next invoice number" defaultValue="9825" />
          <Field label="Default tax rate"    defaultValue="18%" />
          <Field label="Reverse charge"      defaultValue="No" />
          <Field label="Currency"            defaultValue="INR (₹)" />
          <Field label="Rounding"            defaultValue="Nearest ₹1" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="h-10 px-4 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
          <button className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Save</button>
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-5">
        <div className="font-display text-lg mb-3">Invoice preview</div>
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display text-lg">Vedic Clinic</div>
              <div className="text-xs text-muted-foreground">GSTIN 27ABCDE1234F1Z5</div>
            </div>
            <div className="text-right">
              <div className="font-medium">INV-9825</div>
              <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN")}</div>
            </div>
          </div>
          <div className="border-t border-b clinic-divider py-3 my-3">
            <div className="flex justify-between"><span>Consultation</span><span>₹600</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>CGST 9%</span><span>₹54</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>SGST 9%</span><span>₹54</span></div>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span><span>₹708</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input
        defaultValue={defaultValue}
        className="h-10 px-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

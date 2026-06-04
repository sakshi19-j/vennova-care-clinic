import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/clinic/PageHeader";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/admin/settings/")({
  component: ClinicProfile,
});

function ClinicProfile() {
  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 lg:col-span-8">
        <div className="font-display text-lg mb-4 inline-flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" /> Clinic profile
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Clinic name"          defaultValue="Vedic Homeo & Allopathy Clinic" />
          <Field label="Registration number"  defaultValue="MH/CLN/2021/00782" />
          <Field label="Owner"                defaultValue="Dr. R. Sharma" />
          <Field label="Primary phone"        defaultValue="+91 98201 11000" />
          <Field label="Email"                defaultValue="contact@vedicclinic.in" />
          <Field label="Website"              defaultValue="vedicclinic.in" />
          <Field label="Address line 1"       defaultValue="12, Aaradhya Heights" wide />
          <Field label="Address line 2"       defaultValue="JM Road, Shivaji Park" wide />
          <Field label="City"                 defaultValue="Mumbai" />
          <Field label="State"                defaultValue="Maharashtra" />
          <Field label="Pincode"              defaultValue="400016" />
          <Field label="Operating hours"      defaultValue="Mon–Sat · 09:00 – 20:00" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="h-10 px-4 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
          <button className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Save changes</button>
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <div className="font-display text-lg mb-3">Branding</div>
        <div className="rounded-xl border border-dashed border-border bg-muted/40 h-40 flex items-center justify-center text-sm text-muted-foreground">
          Drop your logo here (PNG / SVG)
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Brand color</span><span className="size-5 rounded-full bg-primary border border-border" /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Accent color</span><span className="size-5 rounded-full bg-amber-500 border border-border" /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Theme</span><span>Vedic Cream</span></div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, defaultValue, wide }: { label: string; defaultValue: string; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input
        defaultValue={defaultValue}
        className="h-10 px-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

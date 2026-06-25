import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/clinic/PageHeader";
import { Building2, Loader2, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/admin/settings/")({
  component: ClinicProfile,
});

type ClinicSettings = {
  clinic_name?: string;
  registration_number?: string;
  owner_name?: string;
  primary_phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  operating_hours?: string;
  logo_url?: string;
  signature_url?: string;
  footer_text?: string;
  [k: string]: unknown;
};

const FIELDS: Array<{ key: keyof ClinicSettings; label: string; wide?: boolean }> = [
  { key: "clinic_name", label: "Clinic name" },
  { key: "registration_number", label: "Registration number" },
  { key: "owner_name", label: "Owner / Doctor name" },
  { key: "primary_phone", label: "Primary phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "address_line1", label: "Address line 1", wide: true },
  { key: "address_line2", label: "Address line 2", wide: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "operating_hours", label: "Operating hours" },
  { key: "footer_text", label: "Prescription footer", wide: true },
];

function ClinicProfile() {
  const settingsQ = useQuery({
    queryKey: ["settings", "clinic"],
    queryFn: () => api.get<ClinicSettings>("/settings/clinic"),
    retry: 1,
  });

  const [form, setForm] = useState<ClinicSettings>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const update = (key: keyof ClinicSettings, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const tid = toast.loading("Saving clinic profile…");
    try {
      await api.put(`/settings/clinic`, form);
      toast.success("Clinic profile saved ✓", { id: tid });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error)?.message ?? "Failed to save";
      toast.error(msg, { id: tid });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 lg:col-span-8">
        <div className="font-display text-lg mb-4 inline-flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" /> Clinic profile
          {settingsQ.isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <Field
              key={String(f.key)}
              label={f.label}
              value={String(form[f.key] ?? "")}
              onChange={(v) => update(f.key, v)}
              wide={f.wide}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => settingsQ.data && setForm(settingsQ.data)}
            className="h-10 px-4 rounded-xl border border-border text-sm hover:bg-muted"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </button>
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <div className="font-display text-lg mb-3">Branding</div>
        <div className="rounded-xl border border-dashed border-border bg-muted/40 h-40 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Clinic logo" className="max-h-32 object-contain" />
          ) : (
            "Logo upload — configure clinic-branding bucket in Supabase Storage to enable"
          )}
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Brand color</span>
            <span className="size-5 rounded-full bg-primary border border-border" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Theme</span>
            <span>Vedic Cream</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-4">
          Branding assets (logo + signature) are stored in a private <code>clinic-branding</code> bucket
          and embedded in prescription PDFs & receipts via signed URLs.
        </p>
      </Card>
    </div>
  );
}

function Field({
  label, value, onChange, wide,
}: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

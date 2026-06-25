import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { Loader2, Save, Upload, Image as ImageIcon, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicProfileService, type ClinicProfile } from "@/services/clinic-profile";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Clinic Settings — Vennova" },
      { name: "description", content: "Clinic profile, branding, logo, signature and footer text." },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
  component: Settings,
});

const FIELDS: Array<{ key: keyof ClinicProfile; label: string; wide?: boolean }> = [
  { key: "clinic_name", label: "Clinic name" },
  { key: "doctor_name", label: "Doctor name" },
  { key: "qualification", label: "Qualification" },
  { key: "registration_number", label: "Registration number" },
  { key: "primary_phone", label: "Phone" },
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

function Settings() {
  const profileQ = useQuery({
    queryKey: ["settings", "clinic"],
    queryFn: () => clinicProfileService.get(),
    retry: 1,
  });
  const [form, setForm] = useState<ClinicProfile>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profileQ.data) setForm(profileQ.data);
  }, [profileQ.data]);

  const set = (k: keyof ClinicProfile, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    const tid = toast.loading("Saving clinic profile…");
    try {
      await clinicProfileService.update(form);
      toast.success("Clinic profile saved", { id: tid });
    } catch (e) {
      toast.error((e as Error).message || "Save failed", { id: tid });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader eyebrow="Branding" title="Clinic Settings"
        subtitle="Clinic profile, logo, signature and branding — saved to the Vennova backend." />

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-8">
          <div className="font-display text-lg mb-4 inline-flex items-center gap-2">
            Clinic profile
            {profileQ.isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <Field
                key={String(f.key)}
                label={f.label}
                value={String(form[f.key] ?? "")}
                onChange={(v) => set(f.key, v)}
                wide={f.wide}
              />
            ))}
            <ColorField label="Primary color" value={String(form.primary_color ?? "")} onChange={(v) => set("primary_color", v)} />
            <ColorField label="Secondary color" value={String(form.secondary_color ?? "")} onChange={(v) => set("secondary_color", v)} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => profileQ.data && setForm(profileQ.data)}
              className="h-10 px-4 rounded-xl border border-border text-sm hover:bg-muted"
            >Reset</button>
            <Button onClick={onSave} disabled={saving} className="rounded-xl bg-primary">
              {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />} Save changes
            </Button>
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-4 space-y-5">
          <BrandingUploader
            kind="logo" label="Clinic logo" icon={ImageIcon}
            url={form.logo_url}
            onUploaded={(url) => set("logo_url", url)}
          />
          <BrandingUploader
            kind="signature" label="Doctor signature" icon={PenTool}
            url={form.signature_url}
            onUploaded={(url) => set("signature_url", url)}
          />
          <p className="text-[11px] text-muted-foreground">
            Logo and signature are uploaded to the Supabase <code>clinic-branding</code> bucket and
            their public URLs are saved to the clinic profile. Receipt and prescription PDFs read
            <code> logo_url</code> and <code>signature_url</code> automatically.
          </p>
        </div>
      </div>
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#3F6F4A";
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-xl border border-border bg-muted/60 cursor-pointer"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          className="h-10 px-3 flex-1 rounded-xl bg-muted/60 border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </label>
  );
}

function BrandingUploader({
  kind, label, icon: Icon, url, onUploaded,
}: {
  kind: "logo" | "signature";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  url?: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File) => {
    setUploading(true);
    const tid = toast.loading(`Uploading ${label.toLowerCase()}…`);
    try {
      const publicUrl = await clinicProfileService.uploadBrandingAsset(kind, file);
      onUploaded(publicUrl);
      toast.success(`${label} uploaded — remember to Save changes`, { id: tid });
    } catch (e) {
      toast.error((e as Error).message || "Upload failed", { id: tid });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <div className="font-display text-sm mb-3 inline-flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" /> {label}
      </div>
      <div className="rounded-xl border border-dashed border-border bg-muted/40 h-40 flex items-center justify-center text-xs text-muted-foreground text-center px-4 overflow-hidden">
        {url ? (
          <img src={url} alt={label} className="max-h-36 object-contain" />
        ) : (
          <span>No {label.toLowerCase()} uploaded yet.</span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="rounded-full w-full mt-3"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
        {url ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      </Button>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/clinic/PageHeader";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/settings/import")({
  component: ImportPage,
});

type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; error: string }[];
};

function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel (.xlsx/.xls) or CSV file");
      return;
    }
    setLoading(true);
    setResult(null);
    const tid = toast.loading("Importing patients…");
    try {
      const base = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token ?? "";
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${base}/imports/patients`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ImportResult;
      setResult({
        created: Number(data.created ?? 0),
        skipped: Number(data.skipped ?? 0),
        errors: Array.isArray(data.errors) ? data.errors : [],
      });
      toast.success(`Import complete: ${data.created ?? 0} added, ${data.skipped ?? 0} skipped`, { id: tid });
    } catch (e) {
      toast.error((e as Error).message || "Import failed", { id: tid });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-12 lg:col-span-8">
        <div className="font-display text-xl inline-flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-primary" /> Import patients from Excel / CSV
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Upload an Excel or CSV file with your existing patients. Duplicates (same phone number) are skipped automatically.
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="mt-5 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/30 hover:bg-primary/5 transition-all cursor-pointer p-10 text-center"
        >
          <Upload className="size-8 text-primary mx-auto mb-3" />
          <div className="font-medium">Click to upload or drag and drop</div>
          <div className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv — max 10 MB</div>
          {loading && <Loader2 className="size-5 animate-spin mx-auto mt-4 text-primary" />}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {result && (
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="size-4" /> {result.created} patients imported
            </div>
            {result.skipped > 0 && (
              <div className="text-xs text-muted-foreground">{result.skipped} skipped (already exist)</div>
            )}
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {result.errors.slice(0, 5).map((e, i) => (
                  <div key={i} className="inline-flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="size-3.5" /> Row {e.row}: {e.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <div className="font-display text-base mb-3">Required columns</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="py-1.5">Column name</th>
              <th className="py-1.5">Required</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["first_name", "Yes"],
              ["last_name", "No"],
              ["phone", "Yes"],
              ["age", "No"],
              ["gender", "No (MALE/FEMALE)"],
            ].map(([col, req]) => (
              <tr key={col} className="border-t clinic-divider">
                <td className="py-1.5 font-mono text-xs">{col}</td>
                <td className="py-1.5 text-xs text-muted-foreground">{req}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 text-xs text-muted-foreground">
          Patients with the same phone number as an existing patient will be skipped automatically.
        </div>
      </Card>
    </div>
  );
}

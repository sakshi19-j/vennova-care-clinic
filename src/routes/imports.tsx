import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/imports")({
  head: () => ({
    meta: [
      { title: "Import Patients — Vennova Clinic" },
      { name: "description", content: "Bulk-import patient records from CSV or Excel." },
    ],
    links: [{ rel: "canonical", href: "/imports" }],
  }),
  component: Imports,
});

type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; error: string }[];
};

function Imports() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel (.xlsx/.xls) or CSV file");
      return;
    }
    setUploading(true);
    setResult(null);
    const tid = toast.loading("Importing patients…");
    try {
      const base = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token ?? "";
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${base}/imports/patients`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (payload && (payload.detail || payload.message || payload.error)) ||
          `Import failed (${res.status})`;
        throw new Error(typeof msg === "string" ? msg : `Import failed (${res.status})`);
      }
      const data = payload as ImportResult;
      const parsed: ImportResult = {
        created: Number(data.created ?? 0),
        skipped: Number(data.skipped ?? 0),
        errors: Array.isArray(data.errors) ? data.errors : [],
      };
      setResult(parsed);
      toast.success(`Import complete: ${parsed.created} added, ${parsed.skipped} skipped`, { id: tid });
      qc.invalidateQueries({ queryKey: ["patients"] });
    } catch (e) {
      toast.error((e as Error).message || "Import failed", { id: tid });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        eyebrow="Bulk loader"
        title="Import Patients"
        subtitle="Upload a CSV or Excel file of patient records. We'll dedupe by phone number."
      />

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-7">
          <div className="font-display text-lg mb-2">Upload file</div>
          <p className="text-xs text-muted-foreground mb-4">
            Upload your existing patient list — we'll automatically match your column names
            (Name, Phone, Age, Gender, etc.), in any order.
          </p>

          <div
            className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center hover:bg-muted/50 transition cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f);
            }}
          >
            <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3">
              <FileSpreadsheet className="size-6" />
            </div>
            <div className="font-medium">Click to choose a file, or drag & drop</div>
            <div className="text-xs text-muted-foreground mt-1">CSV / XLSX, up to 10MB</div>
            {uploading && <Loader2 className="size-5 animate-spin mx-auto mt-4 text-primary" />}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-full bg-primary">
              {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
              Choose file
            </Button>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <div className="font-display text-lg mb-3">Results</div>
          {!result && !uploading && (
            <div className="text-sm text-muted-foreground">Upload a file to see results here.</div>
          )}
          {uploading && (
            <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Importing…
            </div>
          )}
          {result && (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="size-4" /> {result.created} patients imported
              </div>
              {result.skipped > 0 && (
                <div className="text-xs text-muted-foreground">{result.skipped} skipped (already exist)</div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-1 max-h-64 overflow-auto">
                  <div className="text-xs font-medium text-muted-foreground">Errors ({result.errors.length})</div>
                  {result.errors.map((e, i) => (
                    <div key={i} className="inline-flex items-start gap-2 text-xs text-destructive">
                      <AlertCircle className="size-3.5 mt-0.5 shrink-0" /> Row {e.row}: {e.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

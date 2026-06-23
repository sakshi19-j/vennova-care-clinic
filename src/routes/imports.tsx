import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/clinic/PageHeader";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importsExportsService, type ImportJob } from "@/services/imports-exports";

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

function Imports() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const jobQ = useQuery({
    queryKey: ["imports", "job", jobId],
    queryFn: () => importsExportsService.jobStatus(jobId as string),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = String((q.state.data as ImportJob | undefined)?.status ?? "").toUpperCase();
      return s === "COMPLETED" || s === "FAILED" ? false : 2000;
    },
    retry: 1,
  });

  const onFile = async (file: File) => {
    setUploading(true);
    const tid = toast.loading("Uploading patients file…");
    try {
      const res = await importsExportsService.importPatients(file);
      const id = String(res.job_id ?? res.id ?? "");
      if (!id) throw new Error("Server did not return a job id");
      setJobId(id);
      toast.success("Import job started", { id: tid });
      qc.invalidateQueries({ queryKey: ["patients"] });
    } catch (e) {
      toast.error((e as Error).message || "Import failed", { id: tid });
    } finally {
      setUploading(false);
    }
  };

  const job = jobQ.data;
  const status = String(job?.status ?? "").toUpperCase();
  const processed = Number(job?.rows_processed ?? 0);
  const success = Number(job?.success ?? 0);
  const failed = Number(job?.failed ?? 0);
  const total = Number(job?.total ?? 0);
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : status === "COMPLETED" ? 100 : 0;

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
            Accepted formats: <code>.csv</code>, <code>.xlsx</code>, <code>.xls</code>. First row should be a header.
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
            <span className="text-xs text-muted-foreground">POST /imports/patients</span>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <div className="font-display text-lg mb-3">Job status</div>
          {!jobId ? (
            <div className="text-sm text-muted-foreground">Upload a file to track progress here.</div>
          ) : jobQ.isLoading && !job ? (
            <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Fetching status…
            </div>
          ) : jobQ.error ? (
            <div className="text-sm text-amber-600 inline-flex items-center gap-2">
              <AlertTriangle className="size-4" /> {(jobQ.error as Error).message}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Job ID</span>
                <span className="font-mono text-xs">{jobId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium inline-flex items-center gap-1.5">
                  {status === "COMPLETED" ? <CheckCircle2 className="size-3.5 text-success" /> :
                   status === "FAILED" ? <AlertTriangle className="size-3.5 text-destructive" /> :
                   <Loader2 className="size-3.5 animate-spin" />}
                  {status || "QUEUED"}
                </span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Stat label="Processed" value={processed} />
                <Stat label="Success" value={success} positive />
                <Stat label="Failed" value={failed} negative />
              </div>
              {job?.error && <div className="text-xs text-destructive mt-2">{String(job.error)}</div>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl tabular-nums ${positive ? "text-success" : negative && value > 0 ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}

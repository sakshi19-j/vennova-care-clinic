// Imports / exports service — patient CSV/XLSX bulk loader and CSV exporter.
import { api } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";

export type ImportJob = {
  job_id?: string;
  id?: string;
  status?: string; // QUEUED | RUNNING | COMPLETED | FAILED
  rows_processed?: number;
  success?: number;
  failed?: number;
  total?: number;
  error?: string;
  [k: string]: unknown;
};

function getBaseUrl(): string {
  return (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const importsExportsService = {
  async importPatients(file: File): Promise<ImportJob> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${getBaseUrl()}/imports/patients`, {
      method: "POST",
      headers: { ...(await authHeader()) },
      body: form,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (payload && (payload.detail || payload.message || payload.error)) ||
        `Import failed (${res.status})`;
      throw new Error(typeof msg === "string" ? msg : `Import failed (${res.status})`);
    }
    return payload as ImportJob;
  },

  jobStatus: (jobId: string) =>
    api.get<ImportJob>(`/imports/${encodeURIComponent(jobId)}/status`),

  exportPatientsCsvUrl: () => `${getBaseUrl()}/exports/patients/csv`,

  async downloadPatientsCsv(): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/exports/patients/csv`, {
      headers: { ...(await authHeader()) },
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

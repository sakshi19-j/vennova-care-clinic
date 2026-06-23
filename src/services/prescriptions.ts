// Prescriptions service — wraps /prescriptions/* endpoints.
import { api } from "@/lib/api-client";

export type Prescription = {
  id?: string;
  prescription_id?: string;
  visit_id?: string;
  patient_id?: string;
  patient_name?: string;
  doctor_name?: string;
  remedy?: string;
  potency?: string;
  diagnosis?: string;
  status?: string; // DRAFT | SENT | SIGNED
  created_at?: string;
  visit_date?: string;
  date?: string;
  [k: string]: unknown;
};

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "rows", "prescriptions"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

export const prescriptionsService = {
  recent: (params: { skip?: number; limit?: number } = {}) =>
    api
      .get<unknown>("/prescriptions", {
        query: { skip: params.skip ?? 0, limit: params.limit ?? 50 },
      })
      .then((d) => asArray<Prescription>(d)),
  get: (id: string) => api.get<Prescription>(`/prescriptions/${encodeURIComponent(id)}`),
  pdfUrl: (visitId: string) => {
    const base = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
    return `${base}/prescriptions/${encodeURIComponent(visitId)}/pdf`;
  },
  sendWhatsApp: (visitId: string) =>
    api.post<unknown>(`/prescriptions/${encodeURIComponent(visitId)}/whatsapp`),
};

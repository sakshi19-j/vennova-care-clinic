// Billing service — wraps /billing/* backend endpoints.
import { api } from "@/lib/api-client";

export type PaymentMode = "CASH" | "UPI" | "CARD" | "ONLINE";

export type BillingRecord = {
  id?: string;
  visit_id?: string;
  patient_id?: string;
  patient_name?: string;
  reg_no?: number | string;
  phone?: string;
  amount?: number;
  fee?: number;
  total?: number;
  payment_mode?: string;
  status?: string;
  paid_at?: string;
  created_at?: string;
  visit_date?: string;
  date?: string;
  doctor_name?: string;
  visit_type?: string;
  [k: string]: unknown;
};

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["items", "data", "results", "rows", "bills", "invoices"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

export const billingService = {
  pending: () =>
    api.get<unknown>("/billing/pending").then((d) => asArray<BillingRecord>(d)),
  history: (params: { skip?: number; limit?: number } = {}) =>
    api
      .get<unknown>("/billing/history", {
        query: { skip: params.skip ?? 0, limit: params.limit ?? 50 },
      })
      .then((d) => asArray<BillingRecord>(d)),
  collect: (visitId: string, mode: PaymentMode) =>
    api.post<unknown>(`/billing/collect/${encodeURIComponent(visitId)}`, {
      payment_mode: mode,
    }),
  receiptUrl: (visitId: string) => {
    const base = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
    return `${base}/billing/receipt/${encodeURIComponent(visitId)}/download`;
  },
};

export function billingAmount(r: BillingRecord): number {
  return Number(r.amount ?? r.total ?? r.fee ?? 0) || 0;
}

export function billingPatientName(r: BillingRecord): string {
  return (r.patient_name as string) || "—";
}

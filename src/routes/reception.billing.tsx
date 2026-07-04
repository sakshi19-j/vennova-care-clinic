import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Tag, Avatar } from "@/components/clinic/PageHeader";
import {
  CheckCircle2,
  IndianRupee,
  Smartphone,
  Banknote,
  CreditCard,
  Globe,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { loadQueue } from "@/lib/queue-store";
import { billingService } from "@/services/billing";
import { dashboardService } from "@/services/dashboard";

export const Route = createFileRoute("/reception/billing")({
  component: BillingPage,
});

type PaymentMode = "CASH" | "UPI" | "CARD" | "ONLINE";

type PendingBill = {
  visit_id?: string;
  id?: string;
  patient_id?: string;
  patient_name?: string;
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  patient_first_name?: string;
  patient_last_name?: string;
  patient_phone?: string;
  phone?: string;
  patient?: {
    id?: string;
    full_name?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    phone?: string;
    phone_mobile?: string;
  };
  token_number?: number;
  fee?: number;
  amount?: number;
  consultation_fee?: number;
  total_amount?: number;
  visit_type?: string;
  closed_at?: string;
  created_at?: string;
};

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.data as { detail?: unknown } | null;
    if (typeof d?.detail === "string") return d.detail;
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

async function openReceipt(visitId: string) {
  try {
    const blob = await api.getBlob(`/billing/receipt/${encodeURIComponent(visitId)}/download`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (e) {
    toast.error("Could not open receipt: " + errMsg(e));
  }
}

function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    for (const k of ["pending_visits", "items", "data", "results", "pending", "bills"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
  }
  return [];
}

function billId(b: PendingBill): string {
  return String(b.visit_id || b.id || "");
}
function billName(b: PendingBill): string {
  const direct = b.patient_name || b.full_name || b.patient?.full_name;
  if (direct && direct.trim()) return direct.trim();
  const parts = [
    b.patient?.first_name ?? b.first_name ?? b.patient_first_name,
    b.patient?.middle_name ?? b.middle_name,
    b.patient?.last_name ?? b.last_name ?? b.patient_last_name,
  ].filter(Boolean);
  return parts.join(" ").trim();
}
function billPatientId(b: PendingBill): string {
  return b.patient_id || b.patient?.id || "";
}
function billFee(b: PendingBill): number {
  const raw = Number(
    b.fee ?? b.consultation_fee ?? b.amount ?? b.total_amount ?? 0,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function BillingPage() {
  const qc = useQueryClient();

  const pendingQ = useQuery({
    queryKey: ["billing-pending"],
    queryFn: async () => asArray<PendingBill>(await api.get("/billing/pending")),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    staleTime: 0,
  });


  // Poll a bit faster than the query interval so doctor finalizations show
  // up in the billing queue within seconds, not the next minute.
  useEffect(() => {
    const id = setInterval(() => qc.invalidateQueries({ queryKey: ["billing-pending"] }), 8000);
    return () => clearInterval(id);
  }, [qc]);

  const [paying, setPaying] = useState<string | null>(null);
  const [todayPaid, setTodayPaid] = useState<
    Array<{ id: string; name: string; fee: number; mode: PaymentMode; at: number; receiptUrl: string }>
  >([]);

  const summaryQ = useQuery({
    queryKey: ["analytics", "summary", "today"],
    queryFn: () => dashboardService.summaryToday(),
    refetchInterval: 15_000,
    retry: 1,
  });

  const pending = (pendingQ.data ?? []).filter(
    (b) => billId(b) && billName(b).trim().length > 0,
  );

  const markPaid = async (bill: PendingBill, mode: PaymentMode) => {
    const id = billId(bill);
    const pid = billPatientId(bill);
    if (!id) {
      toast.error("Missing visit id");
      return;
    }
    setPaying(id);
    const toastId = toast.loading(`Collecting ${mode} ₹${billFee(bill)}…`);

    // Optimistically remove from billing queue so it disappears INSTANTLY.
    qc.setQueryData<PendingBill[]>(["billing-pending"], (prev) =>
      (prev ?? []).filter((b) => billId(b) !== id),
    );

    try {
      // 1) Close visit with chosen payment_mode + fee → status COMPLETED
      await api.post(`/visits/${encodeURIComponent(id)}/close`, {
        fee: billFee(bill),
        payment_mode: mode,
        disease_type: "default",
        followup_channel: "WHATSAPP",
      });

      // 2) Mark paid (canonical billing endpoint) — receipt PDF is generated server-side.
      await api.post(`/billing/${encodeURIComponent(id)}/mark-paid`, {
        payment_mode: mode,
        amount: billFee(bill),
      });

      // 3) Thank-you WhatsApp (non-fatal)
      if (pid) {
        try {
          await api.post(`/whatsapp/send/thankyou/${encodeURIComponent(pid)}`);
        } catch (e) {
          console.warn("thank-you whatsapp failed", e);
        }
      }

      // 4) Schedule follow-up reminders (non-fatal)
      try {
        await api.post("/reminders/schedule", {
          visit_id: id,
          patient_id: pid,
          offsets_days: [3, 7, 15],
          channel: "WHATSAPP",
        });
      } catch (e) {
        console.warn("reminders/schedule failed", e);
      }

      const receiptUrl = billingService.receiptUrl(id);
      toast.success(`${mode} ₹${billFee(bill)} collected · receipt ready`, {
        id: toastId,
        action: { label: "View receipt", onClick: () => window.open(receiptUrl, "_blank", "noreferrer") },
      });
      setTodayPaid((arr) => [
        { id, name: billName(bill), fee: billFee(bill), mode, at: Date.now(), receiptUrl },
        ...arr,
      ]);
      // Broad invalidation — refresh every screen that mirrors visit/payment state.
      qc.invalidateQueries({ queryKey: ["billing-pending"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
      // Hard refetch shared queue store so doctor + reception stay in sync.
      void loadQueue();

    } catch (e) {
      // Roll back the optimistic removal on failure.
      qc.invalidateQueries({ queryKey: ["billing-pending"] });
      toast.error(errMsg(e), { id: toastId });
    } finally {
      setPaying(null);
    }
  };

  const backendRevenueToday = Number(
    summaryQ.data?.revenue_today ?? summaryQ.data?.revenue ?? 0,
  ) || 0;
  const sessionTotal = todayPaid.reduce((s, p) => s + p.fee, 0);
  const totalToday = Math.max(backendRevenueToday, sessionTotal);
  const byMode: Record<PaymentMode, number> = { CASH: 0, UPI: 0, CARD: 0, ONLINE: 0 };
  for (const p of todayPaid) byMode[p.mode] += p.fee;

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-8 space-y-5">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b clinic-divider">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Awaiting payment
              </div>
              <div className="font-display text-lg">Collect payment</div>
            </div>
            <Tag className="bg-amber-500/15 text-amber-700 border-amber-500/30">
              <Clock className="size-3" /> {pending.length}
            </Tag>
          </div>

          {pendingQ.isLoading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="size-4 animate-spin" /> Loading pending bills…
            </div>
          ) : pendingQ.error ? (
            <div className="px-5 py-10 text-center text-sm text-destructive">
              {errMsg(pendingQ.error)}
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <div className="size-12 rounded-full bg-muted grid place-items-center mb-3">
                <AlertCircle className="size-5 text-muted-foreground" />
              </div>
              <h3 className="font-display text-base">No pending payments</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Patients sent from the doctor will appear here for collection.
              </p>
            </div>
          ) : (
            <ul className="divide-y clinic-divider">
              {pending.map((r) => {
                const id = billId(r);
                const busy = paying === id;
                return (
                  <li
                    key={id || billName(r)}
                    className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap"
                  >
                    {r.token_number !== undefined && (
                      <span className="font-mono text-sm w-14 text-right tabular-nums text-muted-foreground shrink-0">
                        #{r.token_number}
                      </span>
                    )}
                    <Avatar name={billName(r) || "?"} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{billName(r)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.visit_type || "Consultation"}
                      </div>
                    </div>
                    <div className="hidden sm:block font-display text-lg text-foreground tabular-nums shrink-0">
                      ₹{billFee(r)}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(["CASH", "UPI", "CARD"] as const).map((m) => (
                        <button
                          key={m}
                          disabled={busy}
                          onClick={() => markPaid(r, m)}
                          className={`h-9 px-3 text-xs rounded-md inline-flex items-center gap-1.5 disabled:opacity-50 ${
                            m === "CASH"
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : m === "UPI"
                              ? "bg-amber-500 text-white hover:bg-amber-600"
                              : "border border-border hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : m === "CASH" ? (
                            <Banknote className="size-3.5" />
                          ) : m === "UPI" ? (
                            <Smartphone className="size-3.5" />
                          ) : (
                            <CreditCard className="size-3.5" />
                          )}
                          {m === "CASH" ? "Mark Paid · Cash" : m === "UPI" ? "UPI" : "Card"}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {todayPaid.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b clinic-divider">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  This session
                </div>
                <div className="font-display text-lg">Receipts sent</div>
              </div>
              <Tag className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                {todayPaid.length}
              </Tag>
            </div>
            <ul className="divide-y clinic-divider">
              {todayPaid.map((p) => (
                <li key={p.id + p.at} className="px-5 py-3 flex items-center gap-3">
                  <Avatar name={p.name} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Paid {p.mode} ₹{p.fee} · reminders scheduled
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReceipt(p.id)}
                    className="h-8 px-3 rounded-full border border-border text-xs inline-flex items-center gap-1.5 hover:bg-muted"
                  >
                    Receipt
                  </button>
                  <Tag className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                    <CheckCircle2 className="size-3" /> Done
                  </Tag>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-5">
        <Card>
          <div className="font-display text-xl mb-1">Today's revenue</div>
          <div className={`font-display text-5xl text-primary inline-flex items-center mt-1 transition-all duration-500 ${todayPaid.length > 0 ? "drop-shadow-sm" : ""}`}>
            <IndianRupee className="size-7" />
            {totalToday.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {summaryQ.isLoading ? "Syncing with backend…" : `Live from /analytics/summary/today · ${todayPaid.length} this session`}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {(["CASH", "UPI", "CARD", "ONLINE"] as const).map((m) => (
              <div
                key={m}
                className="rounded-xl border border-border p-3 flex items-center gap-2"
              >
                <PayIcon mode={m} />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m}
                  </div>
                  <div className="font-display text-base inline-flex items-center">
                    <IndianRupee className="size-3" />
                    {byMode[m].toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PayIcon({ mode }: { mode: string }) {
  const icons: Record<string, React.ReactNode> = {
    CASH: <Banknote className="size-4 text-emerald-600" />,
    UPI: <Smartphone className="size-4 text-amber-600" />,
    CARD: <CreditCard className="size-4 text-blue-600" />,
    ONLINE: <Globe className="size-4 text-violet-600" />,
  };
  return <>{icons[mode] ?? null}</>;
}

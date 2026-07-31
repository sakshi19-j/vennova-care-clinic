import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader, Tag } from "@/components/clinic/PageHeader";
import { Banknote, Smartphone, CreditCard, Globe, Download, Loader2, AlertTriangle, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  billingService, billingAmount, billingPatientName,
  type BillingRecord, type PaymentMode,
} from "@/services/billing";
import { dashboardService } from "@/services/dashboard";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Receipts — Vennova Clinic" },
      { name: "description", content: "Collect payments, download GST-ready receipts and track collections." },
      { property: "og:title", content: "Billing & Receipts — Vennova Clinic" },
      { property: "og:description", content: "Collect payments, download GST-ready receipts and track collections." },
      { property: "og:url", content: "https://vennova-care-clinic.lovable.app/billing" },
      { name: "twitter:title", content: "Billing & Receipts — Vennova Clinic" },
      { name: "twitter:description", content: "Collect payments, download GST-ready receipts and track collections." },
    ],
    links: [{ rel: "canonical", href: "https://vennova-care-clinic.lovable.app/billing" }],
  }),
  component: Billing,
});

const MODES: { mode: PaymentMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { mode: "CASH", label: "Cash", icon: Banknote },
  { mode: "UPI", label: "UPI", icon: Smartphone },
  { mode: "CARD", label: "Card", icon: CreditCard },
  { mode: "ONLINE", label: "Online", icon: Globe },
];

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function pickRevenue(d: unknown): number {
  if (!d || typeof d !== "object") return 0;
  const o = d as Record<string, unknown>;
  for (const k of ["total", "amount", "revenue", "value", "today", "this_week", "this_month"]) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function Billing() {
  const qc = useQueryClient();
  const pendingQ = useQuery({
    queryKey: ["billing", "pending"],
    queryFn: () => billingService.pending(),
    staleTime: 15_000, retry: 1,
  });
  const historyQ = useQuery({
    queryKey: ["billing", "history"],
    queryFn: () => billingService.history({ limit: 50 }),
    staleTime: 30_000, retry: 1,
  });
  const todayQ = useQuery({
    queryKey: ["analytics", "summary", "today"],
    queryFn: () => dashboardService.summaryToday(),
    staleTime: 30_000, retry: 1,
  });
  const weekQ = useQuery({
    queryKey: ["analytics", "revenue", "weekly"],
    queryFn: () => dashboardService.weeklyRevenue(),
    staleTime: 60_000, retry: 1,
  });
  const monthQ = useQuery({
    queryKey: ["analytics", "revenue", "monthly"],
    queryFn: () => dashboardService.monthlyRevenue(),
    staleTime: 60_000, retry: 1,
  });

  const todayRev = Number(todayQ.data?.revenue_today ?? todayQ.data?.revenue ?? 0) || 0;
  const weekRev = pickRevenue(weekQ.data);
  const monthRev = pickRevenue(monthQ.data);

  return (
    <div className="max-w-[1500px] mx-auto">
      <PageHeader eyebrow="Live · Railway backend" title="Billing & Receipts"
        subtitle="Collect pending payments, download GST-ready receipts and track collections." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KPI label="Today" value={inr(todayRev)} loading={todayQ.isLoading} />
        <KPI label="This week" value={inr(weekRev)} loading={weekQ.isLoading} />
        <KPI label="This month" value={inr(monthRev)} loading={monthQ.isLoading} />
        <KPI label="Pending bills" value={String(pendingQ.data?.length ?? 0)} loading={pendingQ.isLoading} />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-7 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b clinic-divider flex items-center justify-between">
            <h2 className="font-display text-lg">Pending billing</h2>
            <span className="text-xs text-muted-foreground">/billing/pending</span>
          </div>
          {pendingQ.isLoading ? <RowSkeleton /> :
           pendingQ.error ? <ErrPane msg={(pendingQ.error as Error).message} onRetry={() => pendingQ.refetch()} /> :
           (pendingQ.data ?? []).length === 0 ? <EmptyState icon={Receipt} text="No pending bills. All collections are up to date." /> :
           <PendingTable rows={pendingQ.data ?? []} onCollected={() => {
             qc.invalidateQueries({ queryKey: ["billing"] });
             qc.invalidateQueries({ queryKey: ["analytics"] });
           }} />}
        </Card>

        <Card className="col-span-12 lg:col-span-5 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b clinic-divider flex items-center justify-between">
            <h2 className="font-display text-lg">Recent receipts</h2>
            <span className="text-xs text-muted-foreground">/billing/history</span>
          </div>
          {historyQ.isLoading ? <RowSkeleton /> :
           historyQ.error ? <ErrPane msg={(historyQ.error as Error).message} onRetry={() => historyQ.refetch()} /> :
           (historyQ.data ?? []).length === 0 ? <EmptyState icon={Receipt} text="No receipts yet." /> :
           <HistoryTable rows={historyQ.data ?? []} />}
        </Card>
      </div>
    </div>
  );
}

function PendingTable({ rows, onCollected }: { rows: BillingRecord[]; onCollected: () => void }) {
  return (
    <ul className="divide-y clinic-divider">
      {rows.map((r) => (
        <PendingRow key={String(r.visit_id ?? r.id)} r={r} onCollected={onCollected} />
      ))}
    </ul>
  );
}

function PendingRow({ r, onCollected }: { r: BillingRecord; onCollected: () => void }) {
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const visitId = String(r.visit_id ?? r.id ?? "");
  const collect = useMutation({
    mutationFn: () => billingService.collect(visitId, mode),
    onSuccess: () => {
      toast.success(`Collected ${inr(billingAmount(r))} via ${mode}`);
      onCollected();
    },
    onError: (e: Error) => toast.error(e.message || "Collection failed"),
  });
  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{billingPatientName(r)}</div>
          <div className="text-xs text-muted-foreground">
            Visit <span className="font-mono">{visitId.slice(0, 8) || "—"}</span>
            {r.visit_type && <> · {String(r.visit_type)}</>}
          </div>
        </div>
        <div className="font-display text-xl tabular-nums">{inr(billingAmount(r))}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.mode}
            onClick={() => setMode(m.mode)}
            className={`h-8 px-3 rounded-full border text-xs inline-flex items-center gap-1.5 ${
              mode === m.mode ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60"
            }`}
          >
            <m.icon className="size-3.5" /> {m.label}
          </button>
        ))}
        <Button
          onClick={() => collect.mutate()}
          disabled={collect.isPending || !visitId}
          className="ml-auto rounded-full bg-primary h-8 px-4 text-xs"
        >
          {collect.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
          Collect
        </Button>
      </div>
    </li>
  );
}

function HistoryTable({ rows }: { rows: BillingRecord[] }) {
  return (
    <ul className="divide-y clinic-divider">
      {rows.map((r) => {
        const visitId = String(r.visit_id ?? r.id ?? "");
        const url = visitId ? billingService.receiptUrl(visitId) : null;
        const when = r.paid_at || r.created_at || r.visit_date || r.date;
        return (
          <li key={visitId} className="px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{billingPatientName(r)}</div>
              <div className="text-xs text-muted-foreground">
                {when ? new Date(String(when)).toLocaleString("en-IN") : "—"}
                {r.payment_mode && <> · <Tag className="bg-muted text-foreground border-border">{String(r.payment_mode)}</Tag></>}
              </div>
            </div>
            <div className="tabular-nums text-sm">{inr(billingAmount(r))}</div>
            {url && (
              <a
                href={url} target="_blank" rel="noreferrer"
                className="size-8 rounded-full border border-border inline-flex items-center justify-center hover:bg-muted"
                aria-label="Download receipt"
              >
                <Download className="size-4" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function KPI({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-1">{loading ? <span className="text-muted-foreground">…</span> : value}</div>
    </Card>
  );
}

function RowSkeleton() {
  return (
    <div className="p-5 space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

function ErrPane({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="inline-flex items-center gap-2 text-amber-600 text-sm">
        <AlertTriangle className="size-4" /> {msg}
      </div>
      <div className="mt-3"><Button variant="outline" onClick={onRetry} className="rounded-full">Retry</Button></div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">
      <div className="size-10 rounded-full bg-muted mx-auto mb-3 grid place-items-center"><Icon className="size-5" /></div>
      {text}
    </div>
  );
}

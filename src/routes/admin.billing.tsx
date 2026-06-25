import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Tag } from "@/components/clinic/PageHeader";
import { api } from "@/lib/api-client";
import { asArray } from "@/services/dashboard";
import { Search, Download, Receipt, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/billing")({
  component: BillingPage,
});

type Invoice = {
  id?: string;
  invoice_id?: string;
  invoice_no?: string;
  patient_name?: string;
  patient_reg?: string;
  doctor?: string;
  branch?: string;
  amount?: number;
  total?: number;
  gst?: number;
  mode?: string;
  payment_mode?: string;
  status?: string;
  issued_at?: string;
  created_at?: string;
};

type ModeFilter = "ALL" | "CASH" | "UPI" | "CARD" | "ONLINE";
type StatusFilter = "ALL" | "PAID" | "PENDING" | "REFUNDED";

const statusStyles: Record<string, string> = {
  PAID: "bg-success/15 text-[color-mix(in_oklab,var(--success)_70%,black)] border-success/30",
  PENDING: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  REFUNDED: "bg-muted text-muted-foreground border-border",
};

function BillingPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<ModeFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const invoicesQ = useQuery({
    queryKey: ["billing", "invoices"],
    queryFn: () => api.get<unknown>("/billing/invoices"),
    staleTime: 30_000,
    retry: 1,
  });

  const invoices = asArray<Invoice>(invoicesQ.data);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices.filter((i) => {
      const m = (i.mode ?? i.payment_mode ?? "").toUpperCase();
      const s = (i.status ?? "").toUpperCase();
      if (mode !== "ALL" && m !== mode) return false;
      if (status !== "ALL" && s !== status) return false;
      if (!needle) return true;
      return (
        (i.invoice_no ?? "").toLowerCase().includes(needle) ||
        (i.patient_name ?? "").toLowerCase().includes(needle) ||
        (i.patient_reg ?? "").toLowerCase().includes(needle) ||
        (i.doctor ?? "").toLowerCase().includes(needle)
      );
    });
  }, [q, mode, status, invoices]);

  const totals = useMemo(() => {
    const sum = (arr: Invoice[]) => arr.reduce((s, i) => s + (Number(i.amount ?? i.total) || 0), 0);
    return {
      paid: sum(filtered.filter((i) => (i.status ?? "").toUpperCase() === "PAID")),
      pending: sum(filtered.filter((i) => (i.status ?? "").toUpperCase() === "PENDING")),
    };
  }, [filtered]);

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12">
        <div className="font-display text-lg leading-tight">Billing — invoices</div>
        <div className="text-xs text-muted-foreground">Live from /billing/invoices.</div>
      </div>

      <Card className="col-span-6 md:col-span-6">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Paid</div>
        <div className="font-display text-xl mt-0.5">₹{totals.paid.toLocaleString("en-IN")}</div>
      </Card>
      <Card className="col-span-6 md:col-span-6">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pending</div>
        <div className="font-display text-xl mt-0.5">₹{totals.pending.toLocaleString("en-IN")}</div>
      </Card>

      <Card className="col-span-12">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoice no, patient, reg, doctor…"
              className="h-10 pl-9 pr-3 w-full rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <Pills label="Mode" value={mode} onChange={(v) => setMode(v as ModeFilter)} options={["ALL", "CASH", "UPI", "CARD", "ONLINE"]} />
          <Pills label="Status" value={status} onChange={(v) => setStatus(v as StatusFilter)} options={["ALL", "PAID", "PENDING", "REFUNDED"]} />
          <button className="inline-flex items-center gap-2 h-10 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Download className="size-4" /> Export
          </button>
        </div>
      </Card>

      <Card className="col-span-12 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b clinic-divider flex items-center justify-between">
          <div className="font-display text-base inline-flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" /> Invoices · {filtered.length}
          </div>
          {invoicesQ.isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        {invoicesQ.error ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="size-4 inline mr-1.5" />
            Unable to load /billing/invoices. Backend may not be reachable.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b clinic-divider">
                  <th className="text-left font-medium py-2 px-4">Invoice</th>
                  <th className="text-left font-medium py-2 px-2">Patient</th>
                  <th className="text-left font-medium py-2 px-2">Doctor</th>
                  <th className="text-right font-medium py-2 px-2">Amount</th>
                  <th className="text-left font-medium py-2 px-2">Mode</th>
                  <th className="text-left font-medium py-2 px-2">Status</th>
                  <th className="text-left font-medium py-2 px-2">Issued</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => {
                  const s = (i.status ?? "").toUpperCase();
                  return (
                    <tr key={i.id ?? i.invoice_id ?? idx} className="border-b last:border-0 clinic-divider hover:bg-muted/50">
                      <td className="py-2 px-4 font-medium">{i.invoice_no ?? "—"}</td>
                      <td className="py-2 px-2">
                        <div className="font-medium">{i.patient_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{i.patient_reg ?? ""}</div>
                      </td>
                      <td className="py-2 px-2">{i.doctor ?? "—"}</td>
                      <td className="py-2 px-2 text-right tabular-nums">₹{(Number(i.amount ?? i.total) || 0).toLocaleString("en-IN")}</td>
                      <td className="py-2 px-2">{(i.mode ?? i.payment_mode ?? "—").toString()}</td>
                      <td className="py-2 px-2"><Tag className={statusStyles[s] ?? "bg-muted text-muted-foreground border-border"}>{s.toLowerCase() || "—"}</Tag></td>
                      <td className="py-2 px-2 text-muted-foreground tabular-nums">
                        {(() => {
                          const t = i.issued_at ?? i.created_at;
                          return t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
                        })()}
                      </td>
                    </tr>
                  );
                })}
                {!invoicesQ.isLoading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No invoices match the filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Pills({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-card border border-border">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={[
            "px-2.5 h-7 rounded-lg text-xs font-medium",
            value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
          ].join(" ")}
        >
          {o.toLowerCase()}
        </button>
      ))}
    </div>
  );
}

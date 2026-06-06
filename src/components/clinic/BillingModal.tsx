import { useState } from "react";
import { X, IndianRupee, Loader2, CheckCircle2 } from "lucide-react";

export type BillingPaymentMode = "CASH" | "UPI" | "CARD";

type Props = {
  open: boolean;
  patientName: string;
  defaultFee?: number;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (fee: number, mode: BillingPaymentMode) => void;
};

const MODES: BillingPaymentMode[] = ["CASH", "UPI", "CARD"];

export function BillingModal({
  open, patientName, defaultFee = 500, saving = false, onCancel, onConfirm,
}: Props) {
  const [fee, setFee] = useState<number>(defaultFee);
  const [mode, setMode] = useState<BillingPaymentMode>("CASH");

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fee || fee <= 0) return;
    onConfirm(fee, mode);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4"
      onClick={() => !saving && onCancel()}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md clinic-card p-6 bg-card"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
              <IndianRupee className="size-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Send to billing</div>
              <h2 className="font-display text-2xl leading-tight">{patientName}</h2>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={saving}
            className="size-9 rounded-full hover:bg-muted grid place-items-center disabled:opacity-50">
            <X className="size-4" />
          </button>
        </div>

        <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
          Consultation fee (₹)
        </label>
        <input
          type="number" min={0} inputMode="numeric" autoFocus
          value={fee}
          onChange={(e) => setFee(Number(e.target.value) || 0)}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring/40"
        />

        <label className="text-[11px] uppercase tracking-widest text-muted-foreground mt-4 mb-1.5 block">
          Payment mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m} type="button" onClick={() => setMode(m)}
              className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-6 border-t clinic-divider pt-4">
          <button type="button" disabled={saving} onClick={onCancel}
            className="h-10 px-5 rounded-full border border-border text-sm hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving || fee <= 0}
            className="h-10 px-6 rounded-full bg-success text-white text-sm font-medium hover:brightness-105 inline-flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {saving ? "Closing visit…" : `Collect ₹${fee}`}
          </button>
        </div>
      </form>
    </div>
  );
}

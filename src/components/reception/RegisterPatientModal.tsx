import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { queueActions } from "@/lib/queue-store";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRegistered?: (p: { id: string; full_name: string; reg_no: string; phone: string }) => void;
};

const T = "h-11 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";
const L = "text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5 block";

/**
 * Minimal patient registration — name + mobile only.
 * Full demographics can be collected later by the doctor during consultation.
 */
export function RegisterPatientModal({ open, onOpenChange, onRegistered }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (!open) return null;

  const reset = () => { setName(""); setPhone(""); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) return toast.error("Patient name is required");
    if (!/^[0-9+\s-]{7,}$/.test(trimmedPhone)) return toast.error("Enter a valid mobile number");

    const { patient, created } = queueActions.createPatient(trimmedName, trimmedPhone);
    toast.success(created ? `Patient ${patient.reg_no} registered` : `Existing patient ${patient.reg_no} selected`);
    onRegistered?.({ id: patient.id, full_name: patient.full_name, reg_no: patient.reg_no, phone: patient.phone });
    onOpenChange(false);
    reset();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm p-4"
      onClick={() => onOpenChange(false)}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md clinic-card p-6 bg-card"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
              <UserPlus className="size-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">New patient</div>
              <h2 className="font-display text-2xl leading-tight">Quick register</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-9 rounded-full hover:bg-muted grid place-items-center"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Capture just the essentials. Full demographics can be added later from the consultation.
        </p>

        <label className={L}>Full name *</label>
        <input
          autoFocus
          className={`${T} w-full`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Anjali Mehta"
        />

        <label className={`${L} mt-4`}>Mobile number *</label>
        <input
          className={`${T} w-full`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98xxx xxxxx"
          inputMode="tel"
        />

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => { onOpenChange(false); reset(); }}
            className="h-10 px-5 rounded-full border border-border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Register patient
          </button>
        </div>
      </form>
    </div>
  );
}

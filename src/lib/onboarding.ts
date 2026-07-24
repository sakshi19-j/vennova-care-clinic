// Onboarding state — tracked locally per browser/clinic until backend exposes
// /settings/onboarding. Pure client utilities, no React.
//
// Keys are namespaced by clinic_id so multiple clinics on the same browser
// don't inherit each other's completion state.

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "profile", title: "Complete clinic profile", description: "Name, address, contact, registration", href: "/admin/settings" },
  { id: "logo", title: "Upload clinic logo", description: "Used on prescriptions, receipts & header", href: "/admin/settings" },
  { id: "signature", title: "Upload digital signature", description: "Embedded in every prescription PDF", href: "/admin/settings" },
  { id: "prescription", title: "Configure prescription branding", description: "Footer text & default advice", href: "/admin/settings/prescription" },
  { id: "whatsapp", title: "Connect WhatsApp", description: "Required for reminders & PDFs", href: "/admin/settings" },
  { id: "staff", title: "Add doctor / staff", description: "Invite team & assign roles", href: "/admin/staff" },
  { id: "queue", title: "Test the queue", description: "Add a patient and walk through the flow", href: "/queue" },
  { id: "prescription_test", title: "Send a test prescription", description: "Verify WhatsApp delivery end-to-end", href: "/doctor/queue" },
];

const KEY = (clinicId: string) => `vennova.onboarding.completed.${clinicId}`;
const DISMISS_KEY = (clinicId: string) => `vennova.onboarding.dismissed.${clinicId}`;

function safeClinicId(clinicId: string | null | undefined): string | null {
  const v = (clinicId ?? "").trim();
  return v ? v : null;
}

export function getCompletedSteps(clinicId: string | null | undefined): Set<string> {
  const cid = safeClinicId(clinicId);
  if (typeof window === "undefined" || !cid) return new Set();
  try {
    const raw = localStorage.getItem(KEY(cid));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function setStepComplete(clinicId: string | null | undefined, id: string): void {
  const cid = safeClinicId(clinicId);
  if (typeof window === "undefined" || !cid) return;
  const s = getCompletedSteps(cid);
  s.add(id);
  localStorage.setItem(KEY(cid), JSON.stringify([...s]));
}

export function setStepIncomplete(clinicId: string | null | undefined, id: string): void {
  const cid = safeClinicId(clinicId);
  if (typeof window === "undefined" || !cid) return;
  const s = getCompletedSteps(cid);
  s.delete(id);
  localStorage.setItem(KEY(cid), JSON.stringify([...s]));
}

export function isOnboardingComplete(clinicId: string | null | undefined): boolean {
  const cid = safeClinicId(clinicId);
  if (!cid) return false;
  const done = getCompletedSteps(cid);
  return ONBOARDING_STEPS.every((s) => done.has(s.id));
}

export function isOnboardingDismissed(clinicId: string | null | undefined): boolean {
  const cid = safeClinicId(clinicId);
  if (typeof window === "undefined" || !cid) return true;
  return localStorage.getItem(DISMISS_KEY(cid)) === "1";
}

export function dismissOnboarding(clinicId: string | null | undefined): void {
  const cid = safeClinicId(clinicId);
  if (typeof window === "undefined" || !cid) return;
  localStorage.setItem(DISMISS_KEY(cid), "1");
}

export function reopenOnboarding(clinicId: string | null | undefined): void {
  const cid = safeClinicId(clinicId);
  if (typeof window === "undefined" || !cid) return;
  localStorage.removeItem(DISMISS_KEY(cid));
}

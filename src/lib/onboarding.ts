// Onboarding state — tracked locally per browser/admin until backend exposes
// /settings/onboarding. Pure client utilities, no React.

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

const KEY = "vennova.onboarding.completed";
const DISMISS_KEY = "vennova.onboarding.dismissed";

export function getCompletedSteps(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function setStepComplete(id: string): void {
  if (typeof window === "undefined") return;
  const s = getCompletedSteps();
  s.add(id);
  localStorage.setItem(KEY, JSON.stringify([...s]));
}

export function setStepIncomplete(id: string): void {
  if (typeof window === "undefined") return;
  const s = getCompletedSteps();
  s.delete(id);
  localStorage.setItem(KEY, JSON.stringify([...s]));
}

export function isOnboardingComplete(): boolean {
  const done = getCompletedSteps();
  return ONBOARDING_STEPS.every((s) => done.has(s.id));
}

export function isOnboardingDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissOnboarding(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, "1");
}

export function reopenOnboarding(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DISMISS_KEY);
}

// Centralised role metadata and access rules. The active role is now derived
// from the authenticated user (see src/hooks/use-auth.tsx) — this file is the
// single source of truth for what each role can see.
import { useAuth, type Role } from "@/hooks/use-auth";

export type { Role };

export const roleMeta: Record<Role, {
  label: string;
  tagline: string;
  home: string;
  allowedPrefixes: string[];
  initials: string;
  accent: string;
}> = {
  reception: {
    label: "Reception",
    tagline: "Front office · queue, appointments, billing",
    home: "/reception",
    allowedPrefixes: ["/reception"],
    initials: "RC",
    accent: "text-amber-600",
  },
  allopathy: {
    label: "Allopathy OPD",
    tagline: "Allopathy OPD · consultations & prescriptions",
    home: "/doctor",
    allowedPrefixes: ["/doctor"],
    initials: "AL",
    accent: "text-primary",
  },
  homeopathy: {
    label: "Homeopathy OPD",
    tagline: "Homeopathy OPD · case-taking & remedies",
    home: "/homeopathy",
    allowedPrefixes: ["/homeopathy"],
    initials: "HM",
    accent: "text-violet-600",
  },
  admin: {
    label: "Owner / Admin",
    tagline: "Full clinic oversight · revenue, staff, audit",
    home: "/admin",
    allowedPrefixes: ["/admin", "/staff", "/settings", "/reception", "/doctor", "/homeopathy"],
    initials: "OW",
    accent: "text-rose-600",
  },
};

export function useRole(): Role | null {
  return useAuth().role;
}

export function canAccess(role: Role | null, path: string): boolean {
  if (!role) return false;
  if (path === "/") return true;
  if (path === "/auth") return true;
  return roleMeta[role].allowedPrefixes.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEY = "vennova_admin_session";

/**
 * Floating "← Back to Admin" button. Appears only when an admin used the
 * staff "Access" link (which saves their session under KEY before switching),
 * letting them jump back into their own admin session from any page.
 */
export function BackToAdminButton() {
  const navigate = useNavigate();
  const [hasSaved, setHasSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasSaved(Boolean(sessionStorage.getItem(KEY)));
  }, []);

  if (!hasSaved) return null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const raw = sessionStorage.getItem(KEY);
          const saved = raw ? JSON.parse(raw) : null;
          if (!saved?.access_token || !saved?.refresh_token) {
            sessionStorage.removeItem(KEY);
            setHasSaved(false);
            return;
          }
          const { error } = await supabase.auth.setSession({
            access_token: saved.access_token,
            refresh_token: saved.refresh_token,
          });
          if (error) throw error;
          sessionStorage.removeItem(KEY);
          navigate({ to: "/admin" });
        } catch (e) {
          console.error("[back-to-admin]", e);
          toast.error("Couldn't restore your admin session — please sign in again.");
        } finally {
          setBusy(false);
        }
      }}
      className="fixed bottom-5 right-5 z-50 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <Undo2 className="size-4" />
      {busy ? "Restoring…" : "← Back to Admin"}
    </button>
  );
}

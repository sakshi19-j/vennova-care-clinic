import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AppLayout } from "@/components/clinic/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Vennova — Clinic Management System" },
      { name: "author", content: "Vedic Homeopathic Clinic" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Vedic Homeopathic Clinic" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Vennova — Clinic Management System" },
      { name: "twitter:title", content: "Vennova — Clinic Management System" },
      { name: "description", content: "Streamline patient care, live queues, prescriptions and billing with the Vennova clinic management system." },
      { property: "og:description", content: "Streamline patient care, live queues, prescriptions and billing with the Vennova clinic management system." },
      { name: "twitter:description", content: "Streamline patient care, live queues, prescriptions and billing with the Vennova clinic management system." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2a0906b4-5c6c-4793-8cab-67cc950a5e26/id-preview-4d0e58a3--22a33134-8e41-45f5-97a0-c1830502b0cf.lovable.app-1781338511914.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2a0906b4-5c6c-4793-8cab-67cc950a5e26/id-preview-4d0e58a3--22a33134-8e41-45f5-97a0-c1830502b0cf.lovable.app-1781338511914.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MedicalBusiness",
          name: "Vedic Homeopathic Clinic",
          url: "https://vennova-care-clinic.lovable.app",
          logo: "https://vennova-care-clinic.lovable.app/favicon.ico",
          medicalSpecialty: ["Homeopathic", "GeneralPractice"],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const oldPrefix = "sb-grsqrlllyhtprhrjicfn";
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(oldPrefix)) {
        localStorage.removeItem(key);
      }
    }
  }, []);

  // Multi-clinic isolation: when the signed-in identity changes, drop every
  // cached row (React Query + the in-memory queue store) so clinic A never
  // sees clinic B's patients, queue, billing, followups, or analytics.
  useEffect(() => {
    let cancelled = false;
    let lastUserId: string | null | undefined;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { resetClinicCaches } = await import("@/lib/queue-store");
      const { data } = await supabase.auth.getSession();
      lastUserId = data.session?.user?.id ?? null;
      const { data: sub } = supabase.auth.onAuthStateChange(async (evt, s) => {
        if (cancelled) return;
        if (evt !== "SIGNED_IN" && evt !== "SIGNED_OUT" && evt !== "USER_UPDATED") return;
        const nextId = s?.user?.id ?? null;
        if (evt === "SIGNED_OUT") {
          await queryClient.cancelQueries();
          queryClient.clear();
          resetClinicCaches();
          lastUserId = null;
          return;
        }
        if (nextId !== lastUserId) {
          // Identity changed — purge stale tenant data before refetching.
          await queryClient.cancelQueries();
          queryClient.clear();
          resetClinicCaches();
          lastUserId = nextId;
        }
      });
      return () => sub.subscription.unsubscribe();
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TrialExpiredGate>
          <AppLayout />
        </TrialExpiredGate>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Global 402 → trial-expired gate. Intercepts every fetch response; if any
// backend call anywhere in the app answers 402, we replace the whole app with
// a friendly full-page upgrade message so no page can render blank or raw errors.
const SUBSCRIPTION_PATH = "/admin/settings/subscription";

function TrialExpiredGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = window.fetch.bind(window);
    let disposed = false;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await orig(...args);
      if (!disposed && res && res.status === 402) {
        setLocked(true);
      }
      return res;
    };
    return () => {
      disposed = true;
      window.fetch = orig;
    };
  }, []);

  // Once the user is on the subscription page (or signs out), let them through.
  const onSubscription = path.startsWith(SUBSCRIPTION_PATH) || path.startsWith("/auth");

  if (locked && !onSubscription) {
    return <TrialExpiredScreen onDismiss={() => setLocked(false)} />;
  }

  return <>{children}</>;
}

function TrialExpiredScreen({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <span className="text-xl font-semibold">!</span>
        </div>
        <h1 className="font-display text-2xl text-foreground">Your trial has ended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upgrade your plan to continue using Vennova. Your clinic data is safe and will be
          available again the moment your subscription is active.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to={SUBSCRIPTION_PATH}
            onClick={onDismiss}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View plans &amp; upgrade
          </Link>
          <a
            href="/auth"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Sign in with a different account
          </a>
        </div>
      </div>
    </div>
  );
}




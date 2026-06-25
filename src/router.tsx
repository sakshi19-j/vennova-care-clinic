import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "@/lib/api-client";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Retry once for transient backend hiccups; never retry auth errors
        // (the api-client already auto-refreshes once on 401/403).
        retry: (failureCount, error) => {
          if (failureCount >= 1) return false;
          const status = (error as ApiError)?.status;
          if (status === 401 || status === 403 || status === 404) return false;
          return true;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        // Treat data as fresh for a short window to dedupe rapid re-mounts.
        staleTime: 10_000,
        // Polling routes set their own refetchInterval; don't add focus refetches
        // that double up with polling and cause the "loads slowly" flicker.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

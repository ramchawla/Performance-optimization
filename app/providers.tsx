"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ToastProvider, notifyError } from "@/components/ui/Toast";

/**
 * A 4xx is the server saying "this request is wrong" — repeating it verbatim
 * cannot change the answer, and retrying an auth failure three times just
 * delays the redirect to sign-in. Network and 5xx failures are worth retrying;
 * on a phone they're usually a tunnel, not a bug.
 */
function isClientError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/** Supabase errors carry `message`; anything else gets a readable fallback. */
function describe(error: unknown): string {
  const message = (error as { message?: string } | null)?.message;
  if (!message) return "Something went wrong saving that.";
  // Postgres/PostgREST text is accurate but unreadable at a glance. Translate
  // the two that a user can actually act on and pass the rest through.
  if (/JWT|not signed in|refresh_token/i.test(message)) return "Signed out — sign in again to save.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "No connection. Saved on this device.";
  return message;
}

function makeQueryClient() {
  return new QueryClient({
    /**
     * One handler for every failed write in the app — CLAUDE.md rule 7 asks
     * that no Supabase error be swallowed, and doing it here means a new
     * mutation is covered by default instead of by remembering. Components
     * can still add their own onError for anything more specific; this is the
     * floor, not the ceiling.
     *
     * The retry action re-runs the exact mutation with its original variables,
     * which is the one thing a user actually wants after a failed save.
     */
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        notifyError(describe(error), {
          label: "Retry",
          onClick: () => void mutation.execute(mutation.state.variables),
        });
      },
    }),
    defaultOptions: {
      queries: {
        // This is a personal tracker: the data changes when *you* change it,
        // and mutations already invalidate what they touch. A minute of
        // staleness costs nothing and saves a refetch on every tab switch.
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: (failureCount, error) => !isClientError(error) && failureCount < 3,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
        // Refetching on window focus is right for a dashboard you leave open;
        // on a phone every app-switch would refire every query on the screen.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        // Mutations are never retried automatically. The offline-writable ones
        // already have the outbox, which retries with real backoff and dedupes
        // by client_id; anything else is a write whose duplicate we can't rule
        // out, so it retries only when the user asks.
        retry: false,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

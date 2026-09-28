// Server/edge Sentry init (CLAUDE.md rule 9: this is the one exception to
// "no new dependencies" — there is no platform-native error tracking on the
// current Vercel plan; get_runtime_errors/get_runtime_logs both return 403,
// gated to Pro. Sentry's free tier is genuinely $0: 5K errors/month, 30-day
// retention, one project — checked before adding this, 2026-09-28).
//
// No-ops entirely until SENTRY_DSN is set (see scripts/README or the repo's
// Sentry setup notes for where to get one) — local dev and any environment
// without the env var behaves exactly as it did before this file existed.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

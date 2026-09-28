// Client-side Sentry init — Next.js auto-loads this file, no wiring needed.
// Must use NEXT_PUBLIC_SENTRY_DSN (not SENTRY_DSN): only NEXT_PUBLIC_-prefixed
// vars get inlined into the client bundle. No-ops until it's set — see
// instrumentation.ts for the rest of this setup.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.2,
    // Session replay would show a friend's nutrition/sleep/body data on
    // every error — off by default. Turn on later only with masking rules,
    // not for this app's data.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

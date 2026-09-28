import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Free tier is 5K events/month — sampling everything would burn through
  // that fast on a handful of users. 20% of traces, 100% of errors (errors
  // always matter; traces are for spotting slow queries, sampling is fine).
  tracesSampleRate: 0.2,
});

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// withSentryConfig no-ops (uploads no source maps, adds no build step) when
// SENTRY_DSN is unset — safe to wrap unconditionally.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source maps need an auth token only at build/upload time (CI/Vercel),
  // never at runtime — separate from the DSN on purpose.
  authToken: process.env.SENTRY_AUTH_TOKEN,
});

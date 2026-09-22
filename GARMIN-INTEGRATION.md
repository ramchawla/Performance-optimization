# Garmin Fenix 7 integration — status

Built and deployed 2026-09-22. This file is the "what's done / what's left" reference —
delete it once you've connected and confirmed a sync, its job is done at that point.

## What's live

- `supabase/migrations/0009_garmin_provider.sql`, `0010_garmin_rollup_priority.sql` — applied to the live project.
- `supabase/functions/garmin-sync/` — deployed, `verify_jwt=true`. No secrets to configure.
- Settings → Integrations → **Garmin** row (`app/(main)/settings/page.tsx`) — connect form, sync, disconnect.
- Background auto-sync (`useGarminAutoSync`, wired into `/dashboard`) — fires at most once per 6h per device, so opening the app in the morning refreshes overnight data without a tap.
- `lib/database.types.ts` regenerated, `npm run typecheck` / `lint` / `build` / `vitest` all clean.
- `TECHNICAL-DESIGN.md` §7b documents every decision made along the way — read that first if you're wondering *why* something works the way it does.

## What's left — one manual step

**Connect it.** Settings → Integrations → Garmin → Connect, enter your Garmin email + password. That's it — the password is used once, server-side, to log in, then discarded; only the resulting session token is stored. **Not supported: accounts with two-factor authentication enabled** — if yours has 2FA on, turn it off first or this can't log in.

## Honest risk disclosure

Garmin has no public API (partner-only, approval-gated), so this — like every other Garmin integration that exists — talks to Garmin's own undocumented internal endpoints via the `garmin-connect` npm package. Two things follow from that, and neither could be fully verified without your real login, which I never asked for or handled directly:

1. **HRV and stress extraction might not populate on the first sync.** Those two calls hit raw undocumented endpoints with best-guess field names (verified against `cyberjunky/python-garminconnect`'s source, itself also reverse-engineered). Steps, sleep duration, resting HR, and activities use the library's own tested methods and are much lower-risk. If HRV/stress come up empty after a real sync: check `health_metrics.raw` in Supabase for that day's `hrv_ms` / `stress_avg` rows (they're written even when extraction fails to find a value) — the actual JSON is there, and it's a one-line fix to point at the right key.
2. **Session token lifetime is unverified.** If a sync ever returns "Session expired — reconnect below" sooner than the ~1-year OAuth1 lifetime Garmin's app normally gets, that's real signal worth mentioning back — it may mean the token pair isn't persisting/restoring correctly, not just normal expiry.

Everything else — schema, RLS, idempotent upserts, the source-priority fix in `daily_rollup`, deploy — is verified against your live Supabase project, not guessed.

## Try it

Settings → Garmin → Connect → Sync now. Then check `/dashboard` for HRV/sleep/steps, and check Strava's row — it's not connected right now, so there's no activity double-counting to worry about yet; if you ever connect both, `TECHNICAL-DESIGN.md` §7b flags that as unhandled.

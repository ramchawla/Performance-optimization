# Edge Functions (Deno runtime)

These functions run on Supabase's Deno runtime, not Node — that's why they're
excluded from the root `tsconfig.json` and won't be touched by `npm run
typecheck` or `npm run build`.

To typecheck them: `deno check supabase/functions/*/index.ts` (requires the
Deno CLI locally, or the Supabase CLI which bundles it).

To deploy: `supabase functions deploy <name>` (requires `supabase login` and
a linked project — Phase 0+ once your Supabase project exists).

Status:
- `ingest-health` — fully implemented per TECHNICAL-DESIGN §4, deployed with `verify_jwt=false` (auth is a per-user webhook_secret bearer token, not a Supabase JWT).
- `food-search` — fully implemented USDA FoodData Central proxy, deployed with `verify_jwt=true`. Requires the `USDA_API_KEY` Edge Function secret (Project Settings → Edge Functions → Secrets — separate store from `.env.local`).
- `strava-oauth` — fully implemented, deployed with `verify_jwt=false`. That's required because `?action=callback` is a browser redirect from Strava with no Authorization header; every other action calls `requireUser()` to verify the caller's JWT itself. Do not add an action without it.
- `garmin-sync` — fully implemented per TECHNICAL-DESIGN §7b, deployed with `verify_jwt=true` (every action goes through `requireUser()`, unlike Strava there's no unauthenticated callback). Needs no Edge Function secrets — Garmin has no OAuth app registration; the user's own credentials are submitted directly via the `connect` action and never persisted (only the resulting session token pair is).

## `garmin-sync` setup

No secrets to configure. Actions: `status`, `connect` (POST `{username, password}` — logs in via Garmin's SSO, stores the resulting OAuth1/OAuth2 token pair, discards the password), `sync` (POST — pulls the last 7 days of steps/sleep/resting HR/HRV/stress plus recent activities; returns `{error: "reauth_required"}` with a 401 if the stored session has gone stale, which the Settings UI treats as "needs reconnect"), `disconnect`.

Built on the unofficial `garmin-connect` npm package (Garmin has no public self-serve Health API — partner-only, approval-gated). HRV and stress are pulled via undocumented internal endpoints (`client.get(...)`) with paths verified against `cyberjunky/python-garminconnect`'s source, since the JS package has no high-level method for them; if either stops populating, check `health_metrics.raw` for the actual current response shape before assuming the sync is broken — the raw payload is always stored regardless of whether extraction succeeds. Does not support accounts with two-factor authentication enabled.

## `strava-oauth` setup

Needs four Edge Function secrets (Project Settings → Edge Functions → Secrets —
a separate store from `.env.local`, which the deployed function cannot read):

| Secret | Value |
| --- | --- |
| `STRAVA_CLIENT_ID` | from the Strava API application |
| `STRAVA_CLIENT_SECRET` | from the Strava API application |
| `STRAVA_STATE_SECRET` | any long random string — signs the OAuth `state` so the callback can't be forged for another user |
| `APP_URL` | e.g. `https://performance-optimization-ten.vercel.app` — where the browser lands after the callback |

Then, in the Strava application settings, set the **Authorization Callback
Domain** to the Supabase functions host (`<project-ref>.supabase.co`). Strava
matches on domain only, so the `?action=callback` query string doesn't need
registering.

Actions: `authorize` (returns the consent URL), `callback` (token exchange),
`status`, `sync` (imports `GET /athlete/activities` into `cardio_sessions`,
idempotent on `(user_id, source, external_id)`), `disconnect`.

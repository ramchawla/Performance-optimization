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

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
- `strava-oauth` — stub, Phase 4. Blocked on registering a Strava API application (client id/secret).

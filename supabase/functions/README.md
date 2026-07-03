# Edge Functions (Deno runtime)

These functions run on Supabase's Deno runtime, not Node — that's why they're
excluded from the root `tsconfig.json` and won't be touched by `npm run
typecheck` or `npm run build`.

To typecheck them: `deno check supabase/functions/*/index.ts` (requires the
Deno CLI locally, or the Supabase CLI which bundles it).

To deploy: `supabase functions deploy <name>` (requires `supabase login` and
a linked project — Phase 0+ once your Supabase project exists).

Status per PHASE-PLAN.md:
- `ingest-health` — fully implemented per TECHNICAL-DESIGN §4, ready to deploy once integration_accounts has a row with your webhook_secret (Phase 2).
- `strava-oauth` — stub, Phase 4.
- `food-search` — stub, Phase 2.

# Performance Hub

Personal human-performance tracking app — training, nutrition, sleep, body metrics, mobility, unified in one place. See the planning docs before touching anything:

1. **`CLAUDE.md`** — conventions, structure, non-negotiable rules. Read this first, every session.
2. **`TECHNICAL-DESIGN.md`** — owns every non-obvious design decision (offline sync, health ingestion, analytics math). If something isn't in here, stop and ask rather than improvising.
3. **`PHASE-PLAN.md`** — phase-by-phase `/goal` strings with acceptance criteria.
4. **`supabase/migrations/0001_init.sql`** — full schema + RLS. Source of truth for data.

## Status

**Phase 0 — Foundation: mostly done.**

Already built (works right now, no Supabase project needed):
- Next.js 16 App Router + TypeScript strict + Tailwind, builds clean
- Full route structure scaffolded ((auth) + (main) groups, bottom nav)
- Supabase client factories (browser + server), `proxy.ts` auth redirect
- `lib/calc/e1rm.ts` + `lib/calc/weightTrend.ts` — the core analytics math from TECHNICAL-DESIGN Section 6, 26 passing tests
- Sign-in form (magic link) — functional once env vars are set
- `ingest-health` Edge Function — full implementation per TECHNICAL-DESIGN Section 4
- `strava-oauth` / `food-search` Edge Functions — stubs, intentionally deferred to their phases
- Seed data for ~55 exercises across the PPL pool + seed script

Still needed to finish Phase 0 (manual, do this once you're at a computer):
- [ ] Create the Supabase project
- [ ] Run `supabase/migrations/0001_init.sql` in the SQL editor
- [ ] Create the private `progress-photos` storage bucket + policy (see schema Section 14 comment)
- [ ] Copy `.env.example` to `.env.local`, fill in Supabase URL/keys
- [ ] `npm run gen:types` to replace the placeholder `lib/database.types.ts` with real generated types
- [ ] `npm run seed:exercises`
- [ ] Get a free USDA FoodData Central key (api.data.gov) for Phase 2

## Commands

```bash
npm run dev              # local dev server
npm run build            # production build - must pass before any phase is "done"
npm run typecheck        # tsc --noEmit
npm run lint              # eslint
npm run test               # vitest run (lib/calc unit tests)
npm run seed:exercises      # populate the exercise library (needs env vars)
```

## Stack

Next.js 16 (App Router), TypeScript strict, Tailwind, Supabase (Postgres + Auth + Storage + Edge Functions), TanStack Query, Zustand (session store only), Zod, Recharts.

No Prisma, no Redux, no tRPC - see `CLAUDE.md` for why.

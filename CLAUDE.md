# CLAUDE.md — Performance Hub

Personal human-performance tracking app (training, nutrition, sleep, body metrics, mobility). Single user for now; schema is multi-user-safe by design. Read `TECHNICAL-DESIGN.md` before implementing anything non-CRUD — it owns all design decisions. `schema.sql` is the source of truth for data.

## Stack
- Next.js 14+ (App Router) · TypeScript **strict** · Tailwind
- Supabase: Postgres + Auth (magic link) + Storage + Edge Functions
- TanStack Query (server state) · Zustand (ONLY `stores/activeSession.ts`)
- Zod at every external boundary · Recharts for charts
- No Prisma, no Redux, no tRPC, no CSS-in-JS.

## Commands
- `npm run dev` — local dev
- `npm run build` — must pass before any phase is "done"
- `npm run typecheck` — `tsc --noEmit`, zero errors always
- `npm run lint` — eslint, zero errors always
- `npm run gen:types` — regenerate `lib/database.types.ts` from Supabase; run after ANY schema change and commit the result
- `npx supabase db push` — apply migrations (files in `supabase/migrations/`)

## Structure
```
app/                    # routes (App Router). Route groups: (auth), (main)
  (main)/dashboard/     # daily rollup dashboard
  (main)/train/         # templates list, template editor, active session, history
  (main)/food/          # log, search, recipes
  (main)/body/          # weight, measurements, photos
  (main)/mobility/
  (main)/settings/
components/ui/          # dumb presentational components
components/<feature>/   # feature components (train/, food/, ...)
lib/supabase/           # client factories (browser, server, service)
lib/database.types.ts   # GENERATED — never hand-edit
lib/calc/               # pure functions: e1rm.ts, weightTrend.ts, correlation.ts
lib/sync/               # outbox.ts, syncWorker.ts (see TECHNICAL-DESIGN §3)
stores/activeSession.ts
supabase/migrations/    # numbered SQL migrations
supabase/functions/     # edge functions: ingest-health/, strava-oauth/, food-search/
```

## Non-negotiable rules
1. **Units:** DB stores kg / meters / seconds / kcal ONLY. Convert at the display layer via `lib/units.ts`. Never store display units.
2. **Snapshots:** session targets and logged-food macros are copied at write time. Never compute historical values by joining back to templates/foods.
3. **client_id:** every offline-writable insert (see TECHNICAL-DESIGN §3 for the table list) generates a UUID `client_id` on-device and writes via `upsert(..., { onConflict: 'client_id' })`.
4. **RLS is the auth layer.** Never use the service-role key in anything client-reachable; it exists only inside Edge Functions.
5. **Dates:** nutrition/mobility use a `log_date` set client-side in the user's timezone. Sleep attributes to wake-up date. Don't "fix" this.
6. **Pure calc functions** in `lib/calc/` take plain data in, return plain data out, no I/O — and every file there gets unit tests (vitest). UI components don't need tests in v1.
7. **Errors:** every Supabase call's error is handled — toast + preserved input for user actions; for outbox syncs, retry per TECHNICAL-DESIGN §3. No silent `catch {}`.
8. Deload sessions (`is_deload`) are excluded from PRs, e1RM trends, and progression cues everywhere, without exception.
9. Don't add dependencies without strong cause; prefer the platform. Anything not listed in the Stack section needs a comment justifying it.
10. If a design question isn't answered by TECHNICAL-DESIGN.md, stop and ask rather than inventing architecture.

## Definition of done (every phase)
`npm run build`, `npm run typecheck`, `npm run lint` all clean; `lib/calc` tests pass; feature works against the real Supabase project (not mocks); mobile-width (390px) layout checked — this app is used one-handed at the gym, phone-first even as a web app.

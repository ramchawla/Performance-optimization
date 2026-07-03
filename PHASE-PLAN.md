# Performance Hub — Phase Plan & /goal Strings
Each phase = one `/goal` run in Claude Code (Sonnet). Review the diff and use the app for a few days between phases. Copy the `/goal` blocks verbatim. Prereq for all phases: repo contains `CLAUDE.md`, `TECHNICAL-DESIGN.md`, `schema.sql`.

---

## Phase 0 — Foundation (manual + assisted, ~2 evenings)
Human does: create Supabase project, run `schema.sql`, create private `progress-photos` bucket + storage policy (schema §14), get USDA API key, scaffold `create-next-app`.

```
/goal Phase 0 complete when: Next.js App Router project with TypeScript strict + Tailwind builds cleanly; Supabase browser/server client factories exist in lib/supabase/; magic-link auth works (sign in, sign out, protected (main) route group redirects unauthenticated users); lib/database.types.ts is generated from the live schema and typechecks; a seed script has inserted ~60 system exercises (user_id null) covering the Jeff Nippard PPL exercise pool plus common variants; npm run build, typecheck, and lint all exit 0. Stop after 25 turns if not met.
```

## Phase 1 — Core training loop (the make-or-break phase)

```
/goal Phase 1 complete when: (1) workout templates can be created, edited, reordered, archived, with exercises added from a searchable library including per-exercise target sets/reps-range/weight/RPE/rest and optional superset grouping; (2) a session started from a template snapshots all targets into session_exercises per CLAUDE.md rule 2; (3) the active-session screen logs sets (reps/weight/RPE) with inputs pre-filled from the previous session's same exercise, shows last session's actuals inline, auto-starts a visible rest timer on set completion, and requires ≤3 taps to log a set identical to last time; (4) sessions can be marked deload, and completed sessions appear in a history list with a detail view; (5) all session/set writes go through the IndexedDB outbox with client_id upserts per TECHNICAL-DESIGN §3, and a set logged with DevTools offline mode syncs correctly when back online with an unsynced-changes badge shown while pending; (6) lib/calc/e1rm.ts exists with passing vitest tests including the reps>12 exclusion and warmup exclusion; (7) build, typecheck, lint exit 0 and the flow is usable at 390px width. Stop after 60 turns if not met.
```

## Phase 2 — Health ingestion + nutrition

```
/goal Phase 2 complete when: (1) Edge Function ingest-health accepts Health Auto Export webhook POSTs with bearer-secret auth, rejects bad secrets with 401, normalizes metrics per the mapping and sleep/aggregation rules in TECHNICAL-DESIGN §4, upserts into health_metrics, and never 500s on unknown metric names; (2) Edge Function food-search proxies USDA FoodData Central with the key server-side and returns a normalized Zod-validated shape; (3) food logging works with three-tier search per TECHNICAL-DESIGN §5 (own/frequent foods first, then USDA), external foods are cached into foods on first log, and nutrition_logs rows snapshot final macros; (4) recipes can be created from foods and logged as portions; (5) a daily food view shows running calorie/protein/carb/fat totals against profile targets; (6) daily body-weight entry exists with a chart showing raw points plus the 7-day EMA from lib/calc/weightTrend.ts, which has passing tests covering the missing-day carry-forward rule; (7) build, typecheck, lint exit 0. Stop after 50 turns if not met.
```

## Phase 3 — Dashboard + mobility

```
/goal Phase 3 complete when: (1) the dashboard renders from the daily_rollup view: weight EMA + 14-day slope, the three-tile recomp indicator per TECHNICAL-DESIGN §6, 7-day protein adherence, 7-day sleep average, mobility streak, and last session summary; (2) key-lift progress charts show max session e1RM over time for user-pinned exercises, excluding deloads; (3) the mobility page offers one-tap daily completion of the 5-exercise routine (couch stretch, glute bridge, 90/90, shoulder dislocates, ankle drills) seeded from RAM_MOBILITY_EXERCISE_LIST.md, with optional hip-tightness 1-5 rating and a streak counter; (4) per-session soreness logging (joint + 1-5 rating) is available from the session-complete screen; (5) empty states exist for every dashboard tile when data is insufficient; (6) build, typecheck, lint exit 0. Stop after 40 turns if not met.
```

## Phase 4 — Integrations & depth

```
/goal Phase 4 complete when: (1) Strava OAuth connect/disconnect works via Edge Functions with token refresh per TECHNICAL-DESIGN §7, and a Sync Now action imports runs into cardio_sessions idempotently; (2) cardio can also be logged manually and a runs view shows distance/pace/HR trends; (3) barcode scanning (getUserMedia + a JS decoder) resolves products via Open Food Facts into the food-logging flow; (4) the four hard-coded correlation views from TECHNICAL-DESIGN §6 render with the n>=20 gate, lag rule, and correlation-not-causation caption, backed by tested lib/calc/correlation.ts; (5) B12/iron/vitamin-D 7-day intake appears on the food page; (6) settings includes full JSON + per-table CSV export; (7) build, typecheck, lint exit 0. Stop after 50 turns if not met.
```

## Phase 5 — Swift/iOS (separate planning cycle)
Do NOT start from this document. When the web app has ≥1 month of real daily use, run a fresh Fable planning session for: SwiftUI architecture, direct HealthKit read/write scopes, retiring the HAE bridge, offline store (SwiftData) reusing the same Supabase backend and client_id idempotency, App Store privacy questionnaire. New tech, new risks — deserves its own design doc, not an appendix.

---

## Escalate to Fable (don't let Sonnet improvise) when:
- Any change to `schema.sql` beyond adding a nullable column
- Outbox/sync behaves unexpectedly (conflict bugs are design bugs)
- HAE payloads don't match the §4 mapping (re-derive the normalization, don't patch)
- Correlation/trend outputs look wrong (math review, not code review)
- Starting Phase 5

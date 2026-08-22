# Performance Hub — Technical Design Document
**Purpose:** This document owns every non-obvious design decision so that implementation is mechanical. If a question isn't answered here or in `schema.sql`, it's either (a) a standard pattern — follow the conventions in `CLAUDE.md` — or (b) genuinely new, in which case stop and escalate to the human rather than inventing an approach.

---

## 1. Architecture Overview

```
┌─────────────┐   HTTPS    ┌──────────────────────────────┐
│ Next.js 14+ │──────────▶│ Supabase                      │
│ (App Router)│  supabase-js│  • Postgres + RLS            │
│ Vercel      │◀──────────│  • Auth (email magic link)    │
└──────┬──────┘            │  • Storage (progress photos) │
       │ IndexedDB          │  • Edge Functions:           │
       │ (offline queue)    │     - /ingest-health         │
                            │     - /strava-oauth,-sync    │
┌──────────────┐  webhook   │     - /food-search proxy     │
│ Health Auto  │──────────▶│                               │
│ Export (iOS) │            └──────────────────────────────┘
└──────────────┘                     ▲
┌──────────────┐   OAuth2 / REST     │
│ Strava API   │─────────────────────┘
└──────────────┘
```

**Decisions locked in:** Next.js App Router + TypeScript strict + Tailwind; Supabase JS client with generated DB types; TanStack Query for server state; Zustand ONLY for the in-workout session store (see §3); Recharts for charts; Zod at every external boundary (webhooks, API responses, forms).

**Explicitly rejected:** Redux (overkill), Prisma (Supabase client + generated types is enough and keeps RLS in the loop), tRPC (no separate API layer to justify it), service workers for full offline PWA in v1 (only the workout flow needs offline — see §3 — a full offline PWA is a scope trap).

---

## 2. The Workout Logging Flow (the make-or-break feature)

**UX requirement:** ≤3 taps to log a set matching last time. The screen shows, per exercise: target (snapshotted), last session's actuals for the same exercise (grayed, inline), and input for this session. Weight/reps inputs pre-fill from last session's corresponding set. Rest timer auto-starts on set completion; a running timer is always visible.

**Data flow at session start:**
1. Client generates `client_id`s (UUID v4) for the session and every session_exercise up front.
2. Targets are copied from `template_exercises` into `session_exercises` rows (snapshot rule — see schema header). The template is never referenced again during the session.
3. "Last performance" panel = most recent completed, non-deload session containing the same `exercise_id`, fetched once at session start and cached.

**Progressive overload cue (P0, cheap, high value):** for each exercise, if all working sets last time hit `target_reps_max` at RPE ≤ target, show a subtle "↑ ready to progress" chip. No auto-changing of targets in v1 (that's P2).

---

## 3. Offline Sync — full design

**Scope discipline:** ONLY these tables are offline-writable: `workout_sessions`, `session_exercises`, `session_sets`, `body_metrics`, `mobility_logs`, `soreness_logs`, `nutrition_logs`, `sleep_logs`, `hydration_logs`, `supplement_intakes`, `readiness_logs`. Everything else (templates, foods editing, settings, supplement *definitions*) requires connectivity. This kills 80% of sync complexity.

The last four were added in migration `0006`. The test is not "could this be written offline?" but "is this logged in a place with no signal?" — water in a basement gym, pre-workout on the gym floor, a readiness check-in on a plane. Supplement definitions stay online-only because they're created once in Settings, at a desk.

**One-row-per-day tables need a derived `client_id`.** `sleep_logs` and `readiness_logs` are unique on `(user_id, log_date)`. A random `client_id` per edit would make the second edit of a day a fresh insert that the day-unique constraint rejects — permanently, since the outbox would retry the identical doomed payload forever. Their `client_id` is therefore `uuidv5(namespace, "<user_id>:<log_date>")` (`lib/sync/stableId.ts`), which migration `0006` reproduces in SQL to backfill rows written before they joined the outbox. Append-only tables (`hydration_logs`, `supplement_intakes`) keep a random UUID per row.

**Mechanism — outbox pattern, not a generic sync engine:**
- Every offline-writable mutation is written to an IndexedDB `outbox` store as `{ mutation_id, table, op ('upsert'|'delete'), payload, created_at, attempts }`, AND applied optimistically to the local TanStack Query cache.
- The payload's `client_id` is the idempotency key. Server writes are Supabase `upsert(..., { onConflict: 'client_id' })`. Replaying the same outbox entry twice is harmless by construction.
- A sync worker drains the outbox FIFO whenever `navigator.onLine` && on `online` event && every 30s while a session is active. Exponential backoff per entry: 2s, 8s, 30s, then park and surface a "N unsynced changes" badge. Never silently drop an entry.
- Entries are removed from the outbox only after a 2xx from Supabase.

**Conflict resolution:** last-write-wins at the ROW level using server `updated_at`, with one carve-out: `session_sets` rows are effectively append-only in practice (you log a set once, rarely edit), so LWW is genuinely safe here. We deliberately do NOT do field-level merging — single user, single device in practice; the engineering cost isn't justified. Document this as a known limitation.

**Ordering constraint the implementer must respect:** parent before child. Outbox drain must upsert `workout_sessions` → `session_exercises` → `session_sets` in that order within a batch, or FK violations occur. Simplest correct approach: sort the batch by a fixed table-priority map before sending.

**What NOT to build:** no CRDTs, no vector clocks, no tombstone tables, no multi-device merge UI. If a conflict edge case is discovered, prefer "server wins, toast the user" over cleverness.

---

## 4. Health Auto Export Ingestion

**Endpoint:** Supabase Edge Function `POST /ingest-health`. Auth: static bearer secret stored in `integration_accounts.webhook_secret`, configured in the HAE app; reject non-matching with 401. (HAE can't do OAuth; a per-user secret is the honest ceiling here.)

**Normalization rules (the actual design decision):**
- HAE payload shapes vary by version — validate with a PERMISSIVE Zod schema (`passthrough`), extract only known metrics, store the raw fragment in `health_metrics.raw` for later reprocessing.
- Metric name mapping (HAE → ours): `sleep_analysis.asleep` (hours) → `sleep_duration_s` (×3600); `heart_rate_variability` → `hrv_ms`; `resting_heart_rate` → `resting_hr_bpm`; `step_count` → `steps`; `active_energy` → `active_energy_kcal`. Unknown metrics: skip and log, never fail the request.
- **Sleep date attribution rule:** a sleep record is attributed to the date the user WOKE UP (i.e., the calendar date of the sleep end in the user's timezone). This is the convention that makes "did last night's sleep affect today's workout" queries line up naturally. Do not deviate.
- **Aggregation rule:** one row per (metric, day). If HAE re-delivers or delivers partial-day data, upsert with the LARGER value for cumulative metrics (steps, energy) and the LATEST value for point metrics (HRV, RHR, sleep). Encode this as a per-metric map, not scattered if-statements.
- Timezone: convert using `profiles.timezone`, never the server's.

---

## 5. Nutrition — food search & logging

**Search strategy (three tiers, in order):**
1. **Local-first:** user's own foods + recipes + previously-logged foods, ranked by log frequency (recency-weighted). This handles 90% of a meal-prep lifestyle after week two — that's the whole low-friction bet.
2. **USDA FoodData Central** (`api.nal.usda.gov`, free key): searched via Edge Function proxy `/food-search` (keeps the key server-side, normalizes response). Prefer `dataType=Foundation,SR Legacy` for whole foods; `Branded` for packaged.
3. **Open Food Facts** for barcode lookups (P1): `GET https://world.openfoodfacts.org/api/v2/product/{barcode}` — no key needed.

**Caching decision:** on first log of an external food, copy it into `foods` (source `usda`/`off`, with `external_id`). Subsequent searches hit the local copy. External APIs are a discovery mechanism, not a runtime dependency — the app must work fully if USDA is down.

**Unit handling:** USDA returns per-100g; normalize to a chosen serving at import time and store `serving_grams`. Log entries store quantity as multiples of that serving. Snapshot rule applies: `nutrition_logs` rows carry final computed macros; editing a food never rewrites past logs.

**Micros:** store as `jsonb` keyed by a fixed vocabulary (`b12_mcg`, `iron_mg`, `calcium_mg`, `vit_d_mcg`, `zinc_mg`, `folate_mcg`). B12 gets first-class dashboard treatment (deficiency history). Don't chase full micronutrient coverage in v1 — B12 + iron + vitamin D is the useful subset.

---

## 6. Analytics & Correlation Math (own this precisely — easy to get subtly wrong)

**Estimated 1RM:** Epley, `e1RM = weight × (1 + reps/30)`, computed only on working sets (not warmups) with reps ≤ 12 (formula degrades badly above that). Exercise progress chart = max e1RM per session, excluding `is_deload` sessions. PRs likewise exclude deloads.

**Weight trend (recomp-critical):** never chart raw daily weights as the headline. Compute a 7-day exponentially weighted moving average (α = 0.25) over daily weigh-ins (average multiple same-day entries first; carry forward the EMA across missing days without updating it). Headline metric = EMA and its 14-day slope in kg/week. Raw points render as faint dots behind the trend line. Rationale: daily scale noise (±1–2 lb water/glycogen/sodium) will otherwise produce false signals weekly, and in a recomp the real signal is small.

**Recomp composite indicator (dashboard headline):** because scale weight can be flat while recomp succeeds, the dashboard's "is it working" panel shows three tiles side by side: weight EMA slope, strength trend (mean of e1RM 28-day slopes across the big 4–6 lifts), and waist EMA slope if measured. Strength ↑ + waist ↓ + weight ~flat = recomp working. Never present weight alone as success/failure.

**Correlation views (P1) — guardrails:**
- Method: Pearson r between metric pairs from `daily_rollup`, with sleep/HRV LAGGED −1 day against training performance (last night's sleep vs. today's session quality). Session quality score = mean over exercises of (session max e1RM ÷ trailing 28-day max e1RM), deload-excluded.
- **Minimum n = 20 paired observations** before displaying anything; below that show "collecting data (n/20)".
- Display |r| with plain-language strength bands (weak/moderate/strong) and ALWAYS the caption "correlation, not causation — n=X". No p-values theater; this is a personal dashboard, not a study.
- Hard-code the 4 pairs worth showing rather than an open-ended correlation matrix: sleep→session quality, protein 7-day adherence→weight EMA slope, mobility streak→hip tightness rating, steps→weight EMA slope. An open matrix invites garbage findings.

---

## 7. Strava Integration (Phase 4)

- OAuth2 code flow via Edge Function pair: `/strava-oauth` (redirect + token exchange; store tokens in `integration_accounts`; refresh on expiry — Strava tokens expire every 6h, ALWAYS check `expires_at` before calls).
- **Read:** poll `GET /athlete/activities` on demand ("Sync now" button) in v1. Strava's webhook subscription API is nicer but requires a public callback + subscription dance — defer to P2.
- Map: Strava `Run` → `cardio_sessions` with `source='strava'`, `external_id=activity.id`. The unique constraint `(user_id, source, external_id)` makes re-syncs idempotent for free.
- **Write (push our runs to Strava):** defer to P2. Read-only covers the actual use case (runs are recorded on watch/phone anyway).
- Rate limits (100/15min, 1000/day) are irrelevant at personal scale but respect 429 with backoff anyway — it's three lines.

## 8. Security Posture

- RLS on every table; `integration_accounts` deny-all except service role (see schema §12 comment).
- Progress photos: private bucket, path convention `{uid}/{iso-date}-{pose}.jpg`, access via signed URLs (60 min TTL), never public URLs.
- Edge Function secrets in Supabase secrets manager; nothing sensitive in `NEXT_PUBLIC_*`.
- No third-party analytics/telemetry SDKs. Health data stays in Supabase, full stop.
- Before any multi-user or App Store future: move OAuth tokens to Supabase Vault, add rate limiting on Edge Functions. Not needed for single-user v1 — noted so it's a decision, not an accident.

## 9. Known Limitations (accepted deliberately)

1. Row-level LWW sync can lose a field edit in a rare two-device race. Accepted: single user, single phone.
2. HAE bridge is a third-party dependency; if it breaks, health ingest pauses but nothing corrupts (raw payloads retained for backfill). Removed entirely by the Phase 5 Swift app.
3. Plain (non-materialized) `daily_rollup` view; revisit only if dashboard >200ms.
4. USDA search quality is mediocre for branded items; mitigated by local-first search + OFF barcodes.
5. No meal photos / AI food recognition in v1 — parking lot.
is 
# Sleep Section — Design

**Date:** 2026-09-24
**Status:** Approved in conversation, pending written-spec review
**Sub-project:** 1 of 4 (Sleep → Recovery/readiness → broader Garmin ingestion → sleep↔training correlation)

## Goal

Give sleep its own first-class section, built on the Garmin Fenix 7 data the `garmin-sync` edge function already pulls, so the user can see last night at a glance, understand *why* a night scored the way it did, track trends against a personal baseline, and record how the night actually felt. Part of the app's broader goal: understand the body as fully as possible and feed later custom insights.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Scope | Sleep section first; readiness, new Garmin endpoints, correlation are separate later specs |
| Manual `sleep_logs` role | Subjective layer only: 1–5 feel + notes + tags. Garmin supplies all measurements. |
| Data model | Extract scalar sleep fields into `health_metrics` at sync time (approach A). Per-night detail (hypnogram, overnight HRV, score qualifiers, feedback) read from that night's `raw`. |
| Layout | Single scrolling page (not sub-tabs) |
| Nav | Add "Sleep" to bottom nav; move Settings to a gear icon in the Dashboard header |
| Backfill | Optional `?days=N` on `sync` (cap 90), driven from Settings in 14-day chunks |

## Verified data available (live Garmin payloads, 2026-09-23)

From the sleep response (`health_metrics.raw` of `sleep_duration_s` rows — the full `getSleepData` payload):
- `dailySleepDTO`: `sleepTimeSeconds`, `deep/light/rem/awakeSleepSeconds`, `awakeCount`, `napTimeSeconds`, `sleepStartTimestampLocal/GMT`, `sleepEndTimestampLocal/GMT`, `averageRespirationValue`, `lowest/highestRespirationValue`, `avgHeartRate`, `avgSleepStress`, `sleepScoreFeedback` (e.g. `POSITIVE_LONG_AND_REFRESHING`), `sleepScoreInsight`, `sleepNeed` (`actual`/`baseline` in **minutes**), `sleepScores`
- `sleepScores.overall.{value, qualifierKey}`; per-component `qualifierKey` + `optimalStart/End` for `totalDuration`, `deepPercentage`, `remPercentage`, `lightPercentage`, `stress`, `awakeCount`, `restlessness`
- Top level: `bodyBatteryChange`, `restlessMomentsCount`, `sleepLevels` (`[{startGMT, endGMT, activityLevel}]`), `hrvData`, `sleepHeartRate`, `sleepStress`, `sleepBodyBattery`, `wellnessEpochRespirationDataDTOList`

From the HRV response (`hrv_ms` raw): `hrvSummary.{lastNightAvg, weeklyAvg, lastNight5MinHigh, baseline, status, feedbackPhrase}`, `hrvReadings` (5-min). **`baseline` is currently `null` / status `ONBOARDING_1`** — Garmin needs ~3 weeks of wear. Our own baselines therefore cannot depend on Garmin's.

## 1. Page layout (`app/(main)/sleep/page.tsx`, rewritten)

Mobile-first (390px), single scroll, top to bottom:

1. **Date switcher** — `‹ Tue Sep 23 ›`, defaults to today's `log_date` (wake-up-date attribution, TECHNICAL-DESIGN §4). Cannot go past today.
2. **Hero card** — sleep score + qualifier + human-readable feedback line (map of known `sleepScoreFeedback` keys → text; unknown keys → title-cased fallback). Total sleep vs sleep need, bed → wake clock times, awake time.
3. **Hypnogram** — horizontal stage band (deep/light/REM/awake) from `sleepLevels`; stage % row with Garmin's optimal ranges.
4. **Recovery strip** — 4 tiles: overnight HRV, resting HR, respiration, body-battery gain. Each: value + delta vs 28-day baseline, colored by direction-aware good/bad. Sleep stress as secondary line.
5. **Score breakdown** — each `sleepScores` component with its qualifier chip.
6. **Overnight HRV sparkline** — from `hrvReadings`.
7. **How it felt** — 1–5 slider, tag chips (`caffeine_late`, `alcohol`, `late_meal`, `screens`, `stressed`, `sick`, `travel`, `nap`), notes. Upserts `sleep_logs` via existing outbox path.
8. **Trends** — 7/30/90 toggle: duration vs need, stacked stage mix, HRV with baseline band, RHR. Averages + bedtime/wake consistency (SD, minutes).
9. **Recent nights** — date · score · duration · feel; tap sets the date switcher.

Empty states: no Garmin data for the night → "No watch data for this night", subjective section still usable. No Garmin connection at all → link to Settings.

**Nav** (`app/(main)/layout.tsx`): replace `Settings` entry with `Sleep`; Dashboard header gets a gear-icon link to `/settings`.

Charts use Recharts (already a dependency), following `components/charts/WeightTrendChart.tsx` patterns. New chart components live in `components/sleep/`.

## 2. Data and sync

### New `health_metrics` metric types (written by `syncDay`, source `garmin`)

| metric_type | Source field | unit | aggregation |
|---|---|---|---|
| `sleep_score` | `dailySleepDTO.sleepScores.overall.value` | `score` | latest |
| `sleep_need_s` | `dailySleepDTO.sleepNeed.actual × 60` | `s` | latest |
| `sleep_awake_s` | `dailySleepDTO.awakeSleepSeconds` | `s` | latest |
| `sleep_awake_count` | `dailySleepDTO.awakeCount` | `count` | latest |
| `sleep_resp_avg` | `dailySleepDTO.averageRespirationValue` | `brpm` | latest |
| `sleep_stress_avg` | `dailySleepDTO.avgSleepStress` | `score` | latest |
| `sleep_hr_avg` | `dailySleepDTO.avgHeartRate` | `bpm` | latest |
| `body_battery_gain` | `bodyBatteryChange` | `score` | latest |
| `sleep_start_offset_s` | `sleepStartTimestampLocal` → seconds from local midnight of `metric_date` (negative = previous evening) | `s` | latest |
| `sleep_end_offset_s` | `sleepEndTimestampLocal` → same | `s` | latest |
| `hrv_weekly_avg` | `hrvSummary.weeklyAvg` | `ms` | latest |
| `hrv_baseline_low` / `hrv_baseline_high` | `hrvSummary.baseline.*` — only when non-null | `ms` | latest |

Existing types (`sleep_duration_s`, `sleep_deep/light/rem_s`, `hrv_ms`, `resting_hr_bpm`, `stress_avg`, `steps`) are unchanged in name and meaning.

**Why offsets, not epoch timestamps:** `health_metrics.value` is `numeric(12,3)` → max 9 integer digits; epoch seconds (10 digits) overflow. Offsets also make cross-midnight consistency math trivial.

Each extraction is guarded (`typeof === "number"`, finite); a missing field writes no row. The whole sleep payload continues to be stored as `raw` on the sleep rows.

### Sync changes (`supabase/functions/garmin-sync/index.ts`)

- Drop `getSleepDuration` (it internally re-calls `getSleepData`); derive `sleep_duration_s` from `dailySleepDTO.sleepTimeSeconds` in the single `getSleepData` attempt. Saves 7 Garmin calls per sync.
- `sync` accepts `?days=N` (integer, clamp 1–90, default 7) and `?offset=M` (days back to start from, default 0) so the client can backfill in chunks.
- `useGarminSync` `onSuccess` additionally invalidates `["sleep"]` queries.

### Backfill (Settings → Garmin row)

"Backfill 90 days" button loops `sync?offset=0,14,28…&days=14` sequentially from the browser, shows `Backfilling 28/90 days…`, stops on the first error and surfaces it. Chunking keeps each edge invocation well inside the function wall-clock limit (~5 calls/day × 14 days ≈ 70 Garmin requests per call).

### Subjective layer

Migration `0013_sleep_log_tags.sql`: `alter table sleep_logs add column tags text[] not null default '{}';`. `sleep_logs` is already outbox-writable with a derived per-day `client_id` (TECHNICAL-DESIGN §3), so no sync changes. Apple-score columns remain in schema, removed from UI. Run `npm run gen:types` and commit the result.

### Reads (`lib/queries/sleep.ts`)

- `useSleepNight(date)` — `health_metrics` rows for `metric_date = date`, one per `metric_type` chosen by source priority (garmin > health_export > strava > manual, same order as `daily_rollup`), plus the `raw` of the `sleep_duration_s` row (the only sleep row carrying the full payload; others store `raw = null` to avoid ~18KB × 14 duplicates per night) and the `hrv_ms` row; plus that date's `sleep_logs` row.
- `useSleepTrend(days)` — scalar values only (no `raw`) for the trend metric types over `days` + 28 (baseline window).
- Existing `useSleepLog` / `useUpsertSleepLog` extended with `tags`.

## 3. Calc, errors, testing

### `lib/calc/sleep.ts` (pure, vitest-tested)

- `baseline(values: number[], window = 28): { mean, sd, n } | null` — null when `n < 7`.
- `deltaVsBaseline(value, baseline, higherIsBetter): { delta, z, tone: "good" | "bad" | "neutral" }` — `neutral` when |z| < 0.5.
- `hypnogramSegments(levels): Array<{ stage: "deep" | "light" | "rem" | "awake", startMin, endMin }>` — sorts, drops gaps and unknown `activityLevel` codes.
- `stageMix({deep, light, rem, awake}): percentages summing to 100` (largest-remainder rounding).
- `timingConsistency(offsetsS: number[]): number | null` — SD in minutes; null for < 3 nights.
- `formatClock(offsetS): "HH:MM"` — handles negative offsets (previous evening).

Direction map: `hrv_ms`, `sleep_score`, `body_battery_gain`, `sleep_duration_s` higher-is-better; `resting_hr_bpm`, `sleep_stress_avg`, `sleep_awake_s`, `sleep_resp_avg` lower-is-better.

The Garmin `activityLevel` → stage mapping (0 deep, 1 light, 2 REM, 3 awake per community libraries) must be **verified against a live night** (compare segment totals to `deep/light/rem/awakeSleepSeconds`) before relying on it; the test fixture is taken from that verified night.

### Error handling

- "How it felt" save: toast on failure, form input preserved (CLAUDE.md rule 7). Offline → outbox.
- All `raw` reads defensive; a missing/renamed field hides its section, never crashes the page.
- Backfill: stops on first error, shows message, partial progress is kept (upserts are idempotent).

### Definition of done

- vitest for every `lib/calc/sleep.ts` export incl. edge cases (empty input, < 7 nights baseline, cross-midnight offsets, unknown stage codes).
- Live verification against Supabase project: run backfill, confirm new metric rows exist, hypnogram totals match Garmin stage seconds within one epoch.
- 390px layout check.
- `npm run build`, `npm run typecheck`, `npm run lint` clean.

## Out of scope

Readiness score (#2), new Garmin endpoints — VO2max, training load/status/readiness, SpO2, intensity minutes (#3), sleep→training correlation (#4), AI-generated insights, skin temperature (`skinTempDataExists` is `false` on this device/account).

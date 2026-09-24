# Garmin Expansion + Insights — Design

**Date:** 2026-09-24
**Status:** Decisions approved in conversation; phases ship independently
**Follows:** `2026-09-24-sleep-section-design.md` (same pattern, applied to the rest of Garmin's data)

## Goal

Make Performance Hub a personal, extensible Garmin Connect: every useful Fenix 7 metric flows in, each area gets a section built on the Sleep pattern (detail + trends + "vs your normal"), and the app adds what Garmin can't — insights across training, food, subjective logs and recovery. **Hard constraint: the app must cost $0 to run.**

## Decisions

| Decision | Choice |
|---|---|
| AI coach | Free rule-based insights computed in-app, always on **plus** a scheduled job on the user's Mac running `claude -p` (Claude Code on the Pro subscription — never an API key) that writes a coaching note into the app |
| Push workouts to the watch | Later phase, not this round |
| Navigation | Nav stays 6 tabs. "Sleep" tab becomes **Recovery** with `Sleep | Readiness` sub-tabs; **Fitness** is a sub-tab under Train (`Templates | History | Cardio | Fitness`) |
| Shipping | Each phase committed + deployed as it passes build/tests |

## Root cause of the steps lag (resolved)

The live daily-summary endpoint and the stats endpoint returned the same value (948). The gap was upstream: the watch had last uploaded to Garmin's cloud 2.5h before our sync. The app can't force a watch upload, so it now **shows** `lastSyncTimestampGMT` ("watch synced 2h ago") next to the daily numbers.

## Ingestion

### `garmin_payloads` table (migration 0014)

`(user_id, payload_date, kind, payload jsonb, fetched_at)`, unique on `(user_id, payload_date, kind)`, RLS: owner can select; writes are service-role (edge function) only. Every fetched Garmin payload is stored here whole, so a renamed/unguessed field never loses data and extraction can be fixed and re-run later. (Sleep keeps its existing raw-on-`sleep_duration_s` storage; unchanged.)

### Endpoints (community-documented, verified against the first live sync before UI relies on them)

| kind | Endpoint | Cadence |
|---|---|---|
| `daily_summary` | `/usersummary-service/usersummary/daily/{displayName}?calendarDate=` (verified live) | per day in window |
| `training_readiness` | `/metrics-service/metrics/trainingreadiness/{date}` | per day in window |
| `training_status` | `/metrics-service/metrics/trainingstatus/aggregated/{date}` | today only |
| `max_metrics` | `/metrics-service/metrics/maxmet/daily/{date}/{date}` | today only |
| `race_predictions` | `/metrics-service/metrics/racepredictions/latest/{displayName}` | today only |
| `endurance_score` | `/metrics-service/metrics/endurancescore?calendarDate=` | today only |
| `hill_score` | `/metrics-service/metrics/hillscore?calendarDate=` | today only |
| `fitness_age` | `/fitnessage-service/fitnessage/{date}` | today only |
| activity detail | `/activity-service/activity/{id}` + `/splits` + `/hrTimeInZones` + `/exerciseSets` | once per new activity |

Each endpoint is its own guarded attempt: a 404/unsupported endpoint records an error and never blocks the rest.

### Call budget

Auto-sync (hourly max, on app load) pulls **2 days**; "Sync now" pulls 7; backfill unchanged (14-day chunks). "Today only" endpoints run only when the window includes today.

### Extracted metrics (`health_metrics`, source `garmin`)

From `daily_summary`: `steps` (replaces the stats endpoint), `calories_total_kcal`, `calories_active_kcal`, `intensity_min_moderate`, `intensity_min_vigorous`, `floors_up`, `stress_avg` (all-day), `body_battery_high`, `body_battery_low`, `spo2_avg`, `spo2_low`, `resp_waking_avg`, `watch_last_sync_epoch_min` (minutes since epoch, fits `numeric(12,3)`).
From `training_readiness`: `training_readiness`, `recovery_time_h`.
From today-only kinds: `vo2max`, `training_load_acute`, `training_load_chronic`, `endurance_score`, `hill_score`, `fitness_age`, race times in seconds (`race_5k_s`, `race_10k_s`, `race_half_s`, `race_marathon_s`).

Exact source keys are pinned after the first live payloads land; anything not found writes no row.

## Phases

1. **Daily summary** — ingestion above + dashboard vitals from Garmin (steps, active kcal, intensity minutes, body battery, SpO2) with "watch synced Xh ago".
2. **Readiness** (Recovery → Readiness) — Garmin Training Readiness + factors + recovery time, own recovery score (`lib/calc/recovery.ts`: HRV, RHR, sleep score vs 28-night baselines), existing morning check-in folded in.
3. **Activities in depth** — `cardio_sessions` gains `raw jsonb`, `training_effect_aerobic`, `training_effect_anaerobic`, `training_load`; activity detail page shows HR zones, splits, watch-recorded strength sets.
4. **Fitness** (Train → Fitness) — VO2 max, training status and acute/chronic load balance, race predictions, endurance/hill score, fitness age, with trends.
5. **Insights** — `lib/calc/insights.ts` rule engine (tag → next-night HRV/score deltas, protein adherence vs recovery, sleep → session quality per §6, load spikes, baseline breaches), shown on Dashboard. `ai_insights` table (`user_id, created_at, period, body_md, model`) + `scripts/coach/` : a launchd job on the Mac runs `claude -p` with a prompt that reads the last 28 days via the Supabase connection it's given and inserts one coaching note. Setup documented; no API key anywhere.

## $0 cost audit

- Supabase free tier: DB 500MB (payloads ~20KB/day ≈ 7MB/yr), edge invocations 500k/mo (hourly auto-sync ≈ 750/mo) — comfortably inside.
- Vercel hobby: unchanged.
- AI: Claude Code on the existing Pro subscription (counts against Pro usage limits); the job refuses to run if `ANTHROPIC_API_KEY` is set, since that would silently switch the CLI to paid API billing.

## Out of scope this round

Workout push to watch; menstrual/hydration Garmin data; multi-user considerations for the coach job (single-user by design).

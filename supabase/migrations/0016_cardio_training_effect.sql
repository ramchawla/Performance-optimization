-- Phase 3 (docs/superpowers/specs/2026-09-24-garmin-expansion-design.md):
-- Garmin activities carry Firstbeat training metrics. Nullable — manual and
-- Strava sessions don't have them. Full per-activity detail (splits, HR zones,
-- strength sets) stays in garmin_payloads, keyed activity_<part>:<id>.
alter table cardio_sessions
  add column training_effect_aerobic   numeric(3,1),
  add column training_effect_anaerobic numeric(3,1),
  add column training_load             numeric(7,1),
  add column calories_kcal             integer;

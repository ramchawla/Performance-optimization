-- The view and the app disagreed about what "water" means.
--
-- daily_rollup.water_ml is a raw sum(volume_ml) — it counts a beer as
-- hydration. lib/calc/hydration.ts deliberately does not: alcohol is a net
-- diuretic, so including it flatters the number. Caffeinated drinks DO count
-- in both, since at habitual doses the fluid is still fluid.
--
-- Today only the client figure is displayed, so nothing user-facing is wrong.
-- It becomes wrong in Phase 5: the AI layer reads the rollup, so it would
-- reason about a different number than the one on the dashboard and could tell
-- you a heavy-drinking day was well hydrated. Two sources of truth for one
-- concept is the actual defect; this removes it.
--
-- water_ml is kept as-is rather than redefined — total fluid volume is a real,
-- separate quantity, and silently changing the meaning of an existing column
-- is how downstream readers break without noticing. The new column is appended
-- at the end, which is the only structural change `create or replace view`
-- permits.
--
-- Keep the two definitions in step: the drink_type filter here must match the
-- one in lib/calc/hydration.ts.

create or replace view public.daily_rollup as
with days as (
  select distinct user_id, d::date as day from (
    select user_id, log_date as d from nutrition_logs
    union select user_id, started_at::date from workout_sessions
    union select user_id, metric_date from health_metrics
    union select user_id, measured_at::date from body_metrics
    union select user_id, log_date from mobility_logs
    union select user_id, started_at::date from cardio_sessions
    union select user_id, log_date from sleep_logs
    union select user_id, log_date from hydration_logs
    union select user_id, log_date from readiness_logs
  ) x
)
select
  days.user_id,
  days.day,
  (select round(sum(n.calories),0) from nutrition_logs n where n.user_id=days.user_id and n.log_date=days.day)   as calories,
  (select round(sum(n.protein_g),0) from nutrition_logs n where n.user_id=days.user_id and n.log_date=days.day)  as protein_g,
  (select round(sum(n.carbs_g),0) from nutrition_logs n where n.user_id=days.user_id and n.log_date=days.day)    as carbs_g,
  (select round(sum(n.fat_g),0) from nutrition_logs n where n.user_id=days.user_id and n.log_date=days.day)      as fat_g,
  (select avg(b.weight_kg) from body_metrics b where b.user_id=days.user_id and b.measured_at::date=days.day)    as weight_kg,
  coalesce(
    (select sl.duration_s from sleep_logs sl where sl.user_id=days.user_id and sl.log_date=days.day),
    (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='sleep_duration_s' and h.metric_date=days.day limit 1)
  )::numeric(12,3)                                                                                              as sleep_s,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='hrv_ms' and h.metric_date=days.day limit 1)           as hrv_ms,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='resting_hr_bpm' and h.metric_date=days.day limit 1)   as resting_hr,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='steps' and h.metric_date=days.day limit 1)            as steps,
  exists(select 1 from workout_sessions s where s.user_id=days.user_id and s.started_at::date=days.day and s.completed_at is not null)        as trained,
  exists(select 1 from mobility_logs m where m.user_id=days.user_id and m.log_date=days.day and m.completed)                                  as mobility_done,
  (select sum(c.distance_m) from cardio_sessions c where c.user_id=days.user_id and c.started_at::date=days.day)                              as cardio_m,
  (select sum(w.volume_ml) from hydration_logs w where w.user_id=days.user_id and w.log_date=days.day)::integer                               as water_ml,
  (select sum(w.caffeine_mg) from hydration_logs w where w.user_id=days.user_id and w.log_date=days.day)::integer                             as caffeine_mg,
  (select r.readiness_score from readiness_logs r where r.user_id=days.user_id and r.log_date=days.day)::smallint                             as readiness_score,
  -- Appended: fluid that actually counts toward hydration. Mirrors
  -- lib/calc/hydration.ts — everything except alcohol.
  (select sum(w.volume_ml) from hydration_logs w
    where w.user_id=days.user_id and w.log_date=days.day and w.drink_type <> 'alcohol')::integer                 as water_equivalent_ml
from days;

-- create or replace drops the view's options, so security_invoker must be
-- re-applied or migration 0005's RLS fix is silently undone. Any future edit
-- to this view has to repeat this line.
alter view public.daily_rollup set (security_invoker = on);

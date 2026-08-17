-- Manual sleep logging.
--
-- health_metrics already holds `sleep_duration_s` from the Health Auto Export
-- webhook, but it's a one-numeric-per-row store and manual entry needs eleven
-- optional fields plus free text. This mirrors mobility_logs: one row per day,
-- everything nullable, so a night can be logged in as much or as little detail
-- as is actually known.
--
-- log_date is the WAKE-UP date, matching the sleep attribution rule in
-- CLAUDE.md rule 5.

create table sleep_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  log_date     date not null,

  bedtime_at   timestamptz,
  waketime_at  timestamptz,
  duration_s   integer check (duration_s >= 0),   -- entered directly, or derived from bed/wake

  -- Stage breakdown. Apple reports core/deep/REM; "light" is core here.
  rem_s        integer check (rem_s  >= 0),
  deep_s       integer check (deep_s >= 0),
  core_s       integer check (core_s >= 0),

  -- Apple's sleep score components. Their weightings, kept as-is so the parts
  -- stay comparable to what the watch reports; total is derived, not stored.
  score_disruptions smallint check (score_disruptions between 0 and 20),
  score_consistency smallint check (score_consistency between 0 and 30),
  score_duration    smallint check (score_duration    between 0 and 50),

  quality      smallint check (quality between 1 and 5),  -- self-rated
  notes        text,
  updated_at   timestamptz not null default now(),

  unique (user_id, log_date)
);
create index idx_sleep_user_date on sleep_logs(user_id, log_date desc);

alter table sleep_logs enable row level security;
create policy "own rows" on sleep_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rebuild daily_rollup so sleep_s prefers a manual entry over the webhook
-- value. Identical to 0001 §11 apart from the sleep_s expression and the
-- sleep_logs contribution to the `days` spine.
create or replace view daily_rollup as
with days as (
  select distinct user_id, d::date as day from (
    select user_id, log_date as d from nutrition_logs
    union select user_id, started_at::date from workout_sessions
    union select user_id, metric_date from health_metrics
    union select user_id, measured_at::date from body_metrics
    union select user_id, log_date from mobility_logs
    union select user_id, started_at::date from cardio_sessions
    union select user_id, log_date from sleep_logs
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
  -- Cast pinned to numeric(12,3): `create or replace view` cannot change an
  -- existing column's type, and health_metrics.value is numeric(12,3).
  coalesce(
    (select sl.duration_s from sleep_logs sl where sl.user_id=days.user_id and sl.log_date=days.day),
    (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='sleep_duration_s' and h.metric_date=days.day limit 1)
  )::numeric(12,3)                                                                                              as sleep_s,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='hrv_ms' and h.metric_date=days.day limit 1)           as hrv_ms,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='resting_hr_bpm' and h.metric_date=days.day limit 1)   as resting_hr,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='steps' and h.metric_date=days.day limit 1)            as steps,
  exists(select 1 from workout_sessions s where s.user_id=days.user_id and s.started_at::date=days.day and s.completed_at is not null)        as trained,
  exists(select 1 from mobility_logs m where m.user_id=days.user_id and m.log_date=days.day and m.completed)                                  as mobility_done,
  (select sum(c.distance_m) from cardio_sessions c where c.user_id=days.user_id and c.started_at::date=days.day)                              as cardio_m
from days;

-- Wave 1 of DOMAIN-ROADMAP.md: hydration, supplementation, and the daily
-- readiness check-in.
--
-- Design notes that matter:
--   * Everything is nullable except the thing being measured. A null means
--     "not recorded" and must never be read as zero (DOMAIN-ROADMAP §2).
--   * Every entry carries a real timestamp, not just a date. Timing is the
--     whole point — fasting windows, caffeine-to-bedtime gaps, and
--     intake-to-session deltas all fall out of it for free.
--   * log_date is the LOCAL date (CLAUDE.md rule 5), stored alongside the
--     timestamp so daily rollups don't have to do timezone math.

-- ============================================================================
-- HYDRATION — one row per drink, not per day.
-- ============================================================================
create table hydration_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  log_date     date not null,
  consumed_at  timestamptz not null default now(),

  volume_ml    integer not null check (volume_ml > 0),
  drink_type   text not null default 'water'
                 check (drink_type in ('water','electrolyte','coffee','tea','juice','soda','alcohol','protein_shake','other')),

  -- Denormalised on purpose: the same drink type varies wildly (a double
  -- espresso vs a drip coffee), so the dose belongs on the entry.
  caffeine_mg   integer check (caffeine_mg >= 0),
  alcohol_units numeric(4,2) check (alcohol_units >= 0),
  sodium_mg     integer check (sodium_mg >= 0),

  context      text check (context in ('waking','with_meal','training','pre_bed','other')),
  notes        text,
  updated_at   timestamptz not null default now()
);
create index idx_hydration_user_date on hydration_logs(user_id, log_date desc);

-- ============================================================================
-- SUPPLEMENTS — a definition (what's in the stack) and intakes (what was
-- actually taken). Adherence is only computable because the two are separate.
-- ============================================================================
create table supplements (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  brand        text,
  form         text check (form in ('capsule','tablet','powder','liquid','gummy','other')),

  dose_amount  numeric(10,2),
  dose_unit    text check (dose_unit in ('mg','g','mcg','iu','ml','capsule','tablet','scoop','serving')),

  purpose      text,
  timing_rule  text check (timing_rule in ('any','with_food','empty_stomach','morning','pre_workout','post_workout','pre_bed')),

  started_on   date,
  ended_on     date,
  active       boolean not null default true,
  cost_per_serving numeric(8,2),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique nulls not distinct (user_id, name, brand)
);
create index idx_supplements_user on supplements(user_id, active);

create table supplement_intakes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  supplement_id uuid not null references supplements(id) on delete cascade,
  log_date      date not null,
  taken_at      timestamptz not null default now(),

  -- Snapshotted from the supplement at write time (CLAUDE.md rule 2) so
  -- editing a dose later never rewrites history.
  dose_amount   numeric(10,2),
  dose_unit     text,

  with_food     boolean,
  skipped       boolean not null default false,
  skip_reason   text,
  notes         text,
  updated_at    timestamptz not null default now()
);
create index idx_supp_intakes_user_date on supplement_intakes(user_id, log_date desc);
create index idx_supp_intakes_supplement on supplement_intakes(supplement_id, log_date desc);

-- ============================================================================
-- READINESS — the subjective layer. One row per day; every field optional so
-- a 5-second check-in is as valid as a complete one.
-- ============================================================================
create table readiness_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  log_date        date not null,
  logged_at       timestamptz not null default now(),

  energy          smallint check (energy          between 1 and 5),
  mood            smallint check (mood            between 1 and 5),
  motivation      smallint check (motivation      between 1 and 5),
  stress          smallint check (stress          between 1 and 5),
  soreness        smallint check (soreness        between 1 and 5),
  mental_clarity  smallint check (mental_clarity  between 1 and 5),
  appetite        smallint check (appetite        between 1 and 5),
  joint_stiffness smallint check (joint_stiffness between 1 and 5),
  libido          smallint check (libido          between 1 and 5),

  illness         text check (illness in ('none','mild','moderate','severe')),
  readiness_score smallint check (readiness_score between 1 and 10),
  notes           text,
  updated_at      timestamptz not null default now(),

  unique (user_id, log_date)
);
create index idx_readiness_user_date on readiness_logs(user_id, log_date desc);

-- ============================================================================
-- RLS — owner-only, same pattern as every other user table (0001 §12).
-- ============================================================================
alter table hydration_logs     enable row level security;
alter table supplements        enable row level security;
alter table supplement_intakes enable row level security;
alter table readiness_logs     enable row level security;

create policy "own rows" on hydration_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on supplements for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on supplement_intakes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on readiness_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- daily_rollup — add water and readiness. New columns must be appended at the
-- end: `create or replace view` can add columns but never reorder or retype
-- existing ones (learned the hard way in 0003).
-- ============================================================================
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
  (select r.readiness_score from readiness_logs r where r.user_id=days.user_id and r.log_date=days.day)::smallint                             as readiness_score
from days;

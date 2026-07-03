-- ============================================================================
-- PERFORMANCE HUB — Supabase Postgres Schema v1.0
-- ============================================================================
-- Design principles (read before modifying):
--   1. Every user-owned table carries user_id + RLS, even with one user today.
--   2. SNAPSHOT, DON'T REFERENCE, for historical facts: when a session is
--      created from a template, targets are COPIED into session rows; when a
--      food is logged, macros are COPIED into the log row. Editing a template
--      or a food must never rewrite history.
--   3. All weights stored in KG, distances in METERS, energy in KCAL,
--      durations in SECONDS. Unit conversion is a display-layer concern only.
--   4. client_id (UUID, generated on-device) on offline-writable tables makes
--      sync upserts idempotent. See TECHNICAL-DESIGN.md §Sync.
--   5. soft-ordering via integer `position` columns; gaps allowed (use steps
--      of 10 on insert so reorders rarely cascade).
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Enums ----------
create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout');
create type food_source as enum ('usda', 'off', 'custom', 'health_import');
create type metric_source as enum ('manual', 'health_export', 'strava', 'derived');
create type photo_pose as enum ('front', 'side', 'back', 'other');
create type joint_site as enum ('knee_l','knee_r','ankle_l','ankle_r','hip_l','hip_r','shoulder_l','shoulder_r','low_back','elbow_l','elbow_r','wrist_l','wrist_r','other');

-- ============================================================================
-- 1. PROFILE & SETTINGS
-- ============================================================================
create table profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  birth_date    date,
  sex           text check (sex in ('male','female','other')),
  height_cm     numeric(5,1),
  timezone      text not null default 'America/Toronto',
  unit_weight   text not null default 'lb' check (unit_weight in ('kg','lb')),   -- display only
  unit_distance text not null default 'km' check (unit_distance in ('km','mi')), -- display only
  -- Goals (nullable; dashboard uses these for adherence rings)
  goal_weight_kg      numeric(5,2),
  goal_body_fat_pct   numeric(4,1),
  target_calories     integer,
  target_protein_g    integer,
  target_carbs_g      integer,
  target_fat_g        integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- 2. EXERCISE LIBRARY
-- user_id NULL  => system-seeded exercise (readable by all, editable by none)
-- user_id set   => user's custom exercise
-- ============================================================================
create table exercises (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade, -- null = system
  name          text not null,
  muscle_groups text[] not null default '{}',   -- e.g. {'chest','triceps','front_delts'}
  equipment     text,                            -- 'barbell','dumbbell','cable','machine','bodyweight'
  is_unilateral boolean not null default false,
  default_rest_seconds integer default 150,
  notes         text,
  created_at    timestamptz not null default now(),
  -- prevent duplicate custom names per user (system rows share the null user_id space)
  unique nulls not distinct (user_id, name)
);
create index idx_exercises_user on exercises(user_id);
create index idx_exercises_muscles on exercises using gin(muscle_groups);

-- ============================================================================
-- 3. TEMPLATES (the plan)
-- ============================================================================
create table workout_templates (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,                     -- 'Push Day A'
  description text,
  position    integer not null default 0,        -- ordering in template list
  archived_at timestamptz,                       -- soft delete; history keeps FK
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table template_exercises (
  id             uuid primary key default uuid_generate_v4(),
  template_id    uuid not null references workout_templates(id) on delete cascade,
  exercise_id    uuid not null references exercises(id),
  position       integer not null,
  superset_group integer,                        -- same int = performed as superset; null = straight sets
  target_sets    integer not null default 3 check (target_sets between 1 and 20),
  target_reps_min integer check (target_reps_min between 1 and 100),
  target_reps_max integer check (target_reps_max between 1 and 100),
  target_weight_kg numeric(6,2),                 -- null = bodyweight / decide day-of
  target_rpe     numeric(3,1) check (target_rpe between 1 and 10),
  rest_seconds   integer default 150,
  notes          text,
  check (target_reps_max is null or target_reps_min is null or target_reps_max >= target_reps_min)
);
create index idx_template_exercises_tpl on template_exercises(template_id, position);

-- ============================================================================
-- 4. SESSIONS (the reality) — offline-writable, so carries client_id
-- Targets are SNAPSHOTTED from the template at session start.
-- ============================================================================
create table workout_sessions (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null unique,             -- generated on device; idempotency key
  user_id      uuid not null references auth.users(id) on delete cascade,
  template_id  uuid references workout_templates(id) on delete set null,
  template_name_snapshot text,                   -- survives template rename/delete
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  is_deload    boolean not null default false,   -- excludes session from PR/progression calcs
  bodyweight_kg numeric(5,2),                    -- optional day-of weigh-in
  notes        text,
  updated_at   timestamptz not null default now()
);
create index idx_sessions_user_date on workout_sessions(user_id, started_at desc);

create table session_exercises (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null unique,
  session_id   uuid not null references workout_sessions(id) on delete cascade,
  exercise_id  uuid not null references exercises(id),
  position     integer not null,
  superset_group integer,
  -- snapshot of plan at session start:
  target_sets  integer,
  target_reps_min integer,
  target_reps_max integer,
  target_weight_kg numeric(6,2),
  target_rpe   numeric(3,1),
  rest_seconds integer,
  notes        text,
  updated_at   timestamptz not null default now()
);
create index idx_session_exercises_session on session_exercises(session_id, position);

create table session_sets (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null unique,
  session_exercise_id uuid not null references session_exercises(id) on delete cascade,
  set_number    integer not null check (set_number between 1 and 30),
  is_warmup     boolean not null default false,
  actual_reps   integer check (actual_reps between 0 and 200),
  actual_weight_kg numeric(6,2) check (actual_weight_kg >= 0),
  actual_rpe    numeric(3,1) check (actual_rpe between 1 and 10),
  completed_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);

-- ============================================================================
-- 5. BODY METRICS & PHOTOS
-- ============================================================================
create table body_metrics (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null unique,
  user_id      uuid not null references auth.users(id) on delete cascade,
  measured_at  timestamptz not null default now(),
  weight_kg    numeric(5,2),
  body_fat_pct numeric(4,1),
  bf_method    text check (bf_method in ('navy','visual','scale_bia','dexa','calipers','other')),
  waist_cm     numeric(5,1),
  neck_cm      numeric(5,1),
  hip_cm       numeric(5,1),
  extras       jsonb not null default '{}',      -- arms, chest, thighs — flexible
  source       metric_source not null default 'manual',
  updated_at   timestamptz not null default now()
);
create index idx_body_metrics_user_date on body_metrics(user_id, measured_at desc);

create table progress_photos (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  taken_at     timestamptz not null default now(),
  storage_path text not null,                    -- Supabase Storage, private bucket
  pose         photo_pose not null default 'front',
  weight_kg_at_time numeric(5,2),
  notes        text
);
create index idx_photos_user_date on progress_photos(user_id, taken_at desc);

-- ============================================================================
-- 6. NUTRITION
-- foods: cached/custom food definitions. nutrition_logs: what was eaten,
-- with macros SNAPSHOTTED at log time.
-- ============================================================================
create table foods (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,  -- null = shared cache row
  source        food_source not null default 'custom',
  external_id   text,                            -- USDA fdcId / OFF barcode
  name          text not null,
  brand         text,
  serving_desc  text not null default '1 serving',
  serving_grams numeric(7,2),
  calories      numeric(7,1) not null default 0, -- per serving
  protein_g     numeric(6,1) not null default 0,
  carbs_g       numeric(6,1) not null default 0,
  fat_g         numeric(6,1) not null default 0,
  fiber_g       numeric(6,1),
  micros        jsonb not null default '{}',     -- {'b12_mcg': 2.4, 'iron_mg': 8, ...}
  created_at    timestamptz not null default now(),
  unique nulls not distinct (source, external_id, user_id)
);
create index idx_foods_name_trgm on foods using gin (to_tsvector('english', name || ' ' || coalesce(brand,'')));

create table recipes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,                      -- 'Batch butter chicken (healthy)'
  servings   numeric(5,2) not null default 1,
  notes      text,
  created_at timestamptz not null default now()
);

create table recipe_items (
  id        uuid primary key default uuid_generate_v4(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  food_id   uuid not null references foods(id),
  quantity  numeric(7,2) not null default 1      -- multiples of the food's serving
);

create table nutrition_logs (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  logged_at   timestamptz not null default now(),
  log_date    date not null,                     -- explicit, set in user's TZ client-side
  meal        meal_type not null default 'snack',
  food_id     uuid references foods(id) on delete set null,
  recipe_id   uuid references recipes(id) on delete set null,
  description text not null,                     -- always human-readable, survives food deletion
  quantity    numeric(7,2) not null default 1,
  -- SNAPSHOT totals for this entry (quantity already applied):
  calories    numeric(7,1) not null,
  protein_g   numeric(6,1) not null,
  carbs_g     numeric(6,1) not null,
  fat_g       numeric(6,1) not null,
  fiber_g     numeric(6,1),
  micros      jsonb not null default '{}',
  source      metric_source not null default 'manual',
  updated_at  timestamptz not null default now()
);
create index idx_nutrition_user_date on nutrition_logs(user_id, log_date desc);

-- ============================================================================
-- 7. HEALTH METRICS (Apple Health via Health Auto Export webhook)
-- One row per (user, metric, day, source). Upsert on re-delivery.
-- metric_type examples: 'sleep_duration_s','sleep_deep_s','sleep_rem_s',
-- 'hrv_ms','resting_hr_bpm','steps','active_energy_kcal','vo2max'
-- ============================================================================
create table health_metrics (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  metric_type text not null,
  metric_date date not null,
  value       numeric(12,3) not null,
  unit        text not null,
  source      metric_source not null default 'health_export',
  raw         jsonb,                              -- original payload fragment for debugging
  created_at  timestamptz not null default now(),
  unique (user_id, metric_type, metric_date, source)
);
create index idx_health_user_type_date on health_metrics(user_id, metric_type, metric_date desc);

-- ============================================================================
-- 8. CARDIO
-- ============================================================================
create table cardio_sessions (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  started_at  timestamptz not null,
  activity    text not null default 'run',
  distance_m  integer,
  duration_s  integer,
  avg_hr_bpm  integer,
  max_hr_bpm  integer,
  perceived_effort integer check (perceived_effort between 1 and 10),
  source      metric_source not null default 'manual',
  external_id text,                               -- Strava activity id
  notes       text,
  updated_at  timestamptz not null default now(),
  unique nulls not distinct (user_id, source, external_id)
);
create index idx_cardio_user_date on cardio_sessions(user_id, started_at desc);

-- ============================================================================
-- 9. MOBILITY & SORENESS
-- ============================================================================
create table mobility_logs (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  log_date    date not null,
  completed   boolean not null default true,
  exercises_done jsonb not null default '[]',    -- ['couch_stretch','glute_bridge',...]
  hip_tightness integer check (hip_tightness between 1 and 5),  -- subjective 1=loose 5=locked
  duration_min integer,
  notes       text,
  updated_at  timestamptz not null default now(),
  unique (user_id, log_date)
);

create table soreness_logs (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  session_id  uuid references workout_sessions(id) on delete set null,
  log_date    date not null,
  joint       joint_site not null,
  rating      integer not null check (rating between 1 and 5),  -- 1=fine 5=painful
  notes       text,
  updated_at  timestamptz not null default now()
);
create index idx_soreness_user_joint on soreness_logs(user_id, joint, log_date desc);

-- ============================================================================
-- 10. INTEGRATIONS (Strava OAuth tokens etc.)
-- SECURITY: store tokens with Supabase Vault in production; this table holds
-- references/metadata. Never expose via the anon key — service role only.
-- ============================================================================
create table integration_accounts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('strava','health_export')),
  provider_user_id text,
  access_token  text,        -- MOVE TO VAULT before any multi-user deployment
  refresh_token text,
  expires_at    timestamptz,
  scopes        text[],
  webhook_secret text,       -- per-user secret for Health Auto Export endpoint auth
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

-- ============================================================================
-- 11. DAILY ROLLUP (view) — powers the dashboard & correlation queries.
-- A plain view is fine at single-user scale; convert to materialized view
-- with a nightly refresh only if dashboard queries exceed ~200ms.
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
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='sleep_duration_s' and h.metric_date=days.day limit 1) as sleep_s,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='hrv_ms' and h.metric_date=days.day limit 1)           as hrv_ms,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='resting_hr_bpm' and h.metric_date=days.day limit 1)   as resting_hr,
  (select h.value from health_metrics h where h.user_id=days.user_id and h.metric_type='steps' and h.metric_date=days.day limit 1)            as steps,
  exists(select 1 from workout_sessions s where s.user_id=days.user_id and s.started_at::date=days.day and s.completed_at is not null)        as trained,
  exists(select 1 from mobility_logs m where m.user_id=days.user_id and m.log_date=days.day and m.completed)                                  as mobility_done,
  (select sum(c.distance_m) from cardio_sessions c where c.user_id=days.user_id and c.started_at::date=days.day)                              as cardio_m
from days;

-- ============================================================================
-- 12. ROW LEVEL SECURITY
-- Pattern: owner-only CRUD; exercises & foods additionally allow reading
-- system rows (user_id is null). integration_accounts is service-role only.
-- ============================================================================
alter table profiles            enable row level security;
alter table exercises           enable row level security;
alter table workout_templates   enable row level security;
alter table template_exercises  enable row level security;
alter table workout_sessions    enable row level security;
alter table session_exercises   enable row level security;
alter table session_sets        enable row level security;
alter table body_metrics        enable row level security;
alter table progress_photos     enable row level security;
alter table foods               enable row level security;
alter table recipes             enable row level security;
alter table recipe_items        enable row level security;
alter table nutrition_logs      enable row level security;
alter table health_metrics      enable row level security;
alter table cardio_sessions     enable row level security;
alter table mobility_logs       enable row level security;
alter table soreness_logs       enable row level security;
alter table integration_accounts enable row level security;

-- profiles
create policy "own profile" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- exercises: read own + system; write own only
create policy "read own+system exercises" on exercises for select
  using (user_id is null or auth.uid() = user_id);
create policy "insert own exercises" on exercises for insert
  with check (auth.uid() = user_id);
create policy "update own exercises" on exercises for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own exercises" on exercises for delete
  using (auth.uid() = user_id);

-- foods: same pattern as exercises
create policy "read own+shared foods" on foods for select
  using (user_id is null or auth.uid() = user_id);
create policy "insert own foods" on foods for insert
  with check (auth.uid() = user_id);
create policy "update own foods" on foods for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own foods" on foods for delete
  using (auth.uid() = user_id);

-- simple owner-only tables
create policy "own rows" on workout_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on workout_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on body_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on progress_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on recipes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on nutrition_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on health_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on cardio_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on mobility_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on soreness_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- child tables: ownership via parent
create policy "own via template" on template_exercises for all
  using (exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid()))
  with check (exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid()));
create policy "own via session" on session_exercises for all
  using (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "own via session_exercise" on session_sets for all
  using (exists (select 1 from session_exercises se join workout_sessions s on s.id = se.session_id
                 where se.id = session_exercise_id and s.user_id = auth.uid()))
  with check (exists (select 1 from session_exercises se join workout_sessions s on s.id = se.session_id
                 where se.id = session_exercise_id and s.user_id = auth.uid()));
create policy "own via recipe" on recipe_items for all
  using (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- integration_accounts: NO anon/auth policies on purpose.
-- Only the service role (Edge Functions) may touch it. RLS enabled with zero
-- policies = deny-all for anon/authenticated, which is exactly what we want.

-- ============================================================================
-- 13. updated_at trigger
-- ============================================================================
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['profiles','workout_templates','workout_sessions','session_exercises',
    'session_sets','body_metrics','nutrition_logs','cardio_sessions','mobility_logs',
    'soreness_logs','integration_accounts']
  loop
    execute format('create trigger trg_%s_updated before update on %s for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================================
-- 14. STORAGE (run in Supabase dashboard or via API)
-- Create private bucket 'progress-photos'. Policy: authenticated users may
-- read/write only paths prefixed with their own uid:
--   (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
-- ============================================================================

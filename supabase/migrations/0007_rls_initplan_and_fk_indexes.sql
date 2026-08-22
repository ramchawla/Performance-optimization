-- PERF-1 and PERF-2.
--
-- PERF-1: every RLS policy called auth.uid() bare, so Postgres treated it as
-- volatile and re-evaluated it ONCE PER ROW SCANNED. Wrapping it in a scalar
-- subquery makes it an InitPlan — evaluated once per statement — which is the
-- documented Supabase fix. 28 policies, flagged by the linter as
-- auth_rls_initplan.
--
-- This is a pure performance change. `(select auth.uid())` returns exactly what
-- `auth.uid()` returns; the predicates are semantically identical and the set of
-- rows each policy admits is unchanged. Verified after applying by re-reading
-- pg_policies and confirming zero bare occurrences remain, and by re-running the
-- linter.
--
-- PERF-2: 11 foreign keys had no covering index. Postgres does not create one
-- for the referencing side, so both joins across the key and the referential
-- integrity check on parent delete/update degrade to sequential scans.

-- ---------------------------------------------------------------------------
-- PERF-1a — the 16 policies that are plain `auth.uid() = user_id` over ALL.
--
-- A loop over a literal list rather than 16 hand-written statements: the
-- expression is then written once and cannot be mistyped on the fifteenth copy.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  simple_tables text[] := array[
    'body_metrics', 'cardio_sessions', 'health_metrics', 'hydration_logs',
    'mobility_logs', 'nutrition_logs', 'progress_photos', 'readiness_logs',
    'recipes', 'sleep_logs', 'soreness_logs', 'supplement_intakes',
    'supplements', 'workout_sessions', 'workout_templates'
  ];
begin
  foreach t in array simple_tables loop
    execute format(
      'alter policy "own rows" on public.%I using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;

  -- Same shape, different policy name.
  alter policy "own profile" on public.profiles
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
end $$;

-- ---------------------------------------------------------------------------
-- PERF-1b — exercises and foods, which have split per-command policies because
-- reads include the shared rows where user_id is null.
-- ---------------------------------------------------------------------------
alter policy "read own+system exercises" on public.exercises
  using (user_id is null or (select auth.uid()) = user_id);
alter policy "insert own exercises" on public.exercises
  with check ((select auth.uid()) = user_id);
alter policy "update own exercises" on public.exercises
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "delete own exercises" on public.exercises
  using ((select auth.uid()) = user_id);

alter policy "read own+shared foods" on public.foods
  using (user_id is null or (select auth.uid()) = user_id);
alter policy "insert own foods" on public.foods
  with check ((select auth.uid()) = user_id);
alter policy "update own foods" on public.foods
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "delete own foods" on public.foods
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- PERF-1c — the child tables, scoped through a parent. These are the ones the
-- fix helps most: the EXISTS subquery was re-planned for every candidate row.
-- ---------------------------------------------------------------------------
alter policy "own via template" on public.template_exercises
  using (exists (select 1 from workout_templates t
                  where t.id = template_exercises.template_id
                    and t.user_id = (select auth.uid())))
  with check (exists (select 1 from workout_templates t
                       where t.id = template_exercises.template_id
                         and t.user_id = (select auth.uid())));

alter policy "own via session" on public.session_exercises
  using (exists (select 1 from workout_sessions s
                  where s.id = session_exercises.session_id
                    and s.user_id = (select auth.uid())))
  with check (exists (select 1 from workout_sessions s
                       where s.id = session_exercises.session_id
                         and s.user_id = (select auth.uid())));

alter policy "own via session_exercise" on public.session_sets
  using (exists (select 1 from session_exercises se
                   join workout_sessions s on s.id = se.session_id
                  where se.id = session_sets.session_exercise_id
                    and s.user_id = (select auth.uid())))
  with check (exists (select 1 from session_exercises se
                        join workout_sessions s on s.id = se.session_id
                       where se.id = session_sets.session_exercise_id
                         and s.user_id = (select auth.uid())));

alter policy "own via recipe" on public.recipe_items
  using (exists (select 1 from recipes r
                  where r.id = recipe_items.recipe_id
                    and r.user_id = (select auth.uid())))
  with check (exists (select 1 from recipes r
                       where r.id = recipe_items.recipe_id
                         and r.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- PERF-2 — covering indexes for the 11 unindexed foreign keys.
--
-- `recipe_items.recipe_id` and `session_exercises.exercise_id` matter twice
-- over: they're both the join path the app reads on and the column an RLS
-- EXISTS clause above filters by.
-- ---------------------------------------------------------------------------
create index if not exists idx_foods_user               on public.foods (user_id);
create index if not exists idx_recipes_user             on public.recipes (user_id);
create index if not exists idx_recipe_items_recipe      on public.recipe_items (recipe_id);
create index if not exists idx_recipe_items_food        on public.recipe_items (food_id);
create index if not exists idx_nutrition_logs_food      on public.nutrition_logs (food_id);
create index if not exists idx_nutrition_logs_recipe    on public.nutrition_logs (recipe_id);
create index if not exists idx_workout_templates_user   on public.workout_templates (user_id);
create index if not exists idx_template_exercises_ex    on public.template_exercises (exercise_id);
create index if not exists idx_session_exercises_ex     on public.session_exercises (exercise_id);
create index if not exists idx_workout_sessions_template on public.workout_sessions (template_id);
create index if not exists idx_soreness_logs_session    on public.soreness_logs (session_id);

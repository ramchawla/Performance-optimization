-- Training-day macro overrides. Existing target_calories/protein_g/carbs_g/fat_g
-- represent the rest-day baseline; these are nullable overrides used on days
-- with a workout_session. Nullable column addition — within Sonnet's authority
-- per PHASE-PLAN.md's escalation rule.
alter table profiles
  add column target_calories_training_day integer,
  add column target_protein_training_day_g integer,
  add column target_carbs_training_day_g integer,
  add column target_fat_training_day_g integer;

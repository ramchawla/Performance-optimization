-- AI coach notes (docs/superpowers/specs/2026-09-24-garmin-expansion-design.md,
-- phase 5). Written by scripts/coach/run-coach.sh — Claude Code running
-- headless on the user's own Mac under their Pro subscription, never an API
-- key — through the Supabase connection Claude Code already has. The app only
-- reads them.
create table ai_insights (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  period_start date not null,
  period_end   date not null,
  body_md      text not null check (length(body_md) between 1 and 8000),
  model        text not null default 'claude-code'
);
create index idx_ai_insights_user_created on ai_insights(user_id, created_at desc);

alter table ai_insights enable row level security;

create policy "own rows read" on ai_insights for select
  using ((select auth.uid()) = user_id);

-- Garmin expansion (docs/superpowers/specs/2026-09-24-garmin-expansion-design.md).
-- Every Garmin payload the sync fetches is kept whole, one row per
-- (user, date, kind). Garmin's API is undocumented, so extraction into
-- health_metrics works from guessed field names — keeping the payload means a
-- wrong guess loses nothing: fix the key, re-extract.
create table garmin_payloads (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  payload_date date not null,
  kind         text not null,
  payload      jsonb not null,
  fetched_at   timestamptz not null default now(),
  unique (user_id, payload_date, kind)
);

alter table garmin_payloads enable row level security;

-- Read-only for the owner: only the garmin-sync edge function (service role,
-- which bypasses RLS) ever writes here.
create policy "own rows read" on garmin_payloads for select
  using ((select auth.uid()) = user_id);

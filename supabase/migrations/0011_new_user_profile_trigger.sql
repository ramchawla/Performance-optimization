-- Every query that reads `profiles` assumes a row already exists — most
-- visibly lib/queries/settings.ts's `useProfile()`, which uses `.single()`
-- (throws on zero rows, unlike the dashboard's `.maybeSingle()`). Nothing
-- ever created that row: there was no trigger on auth.users, and no
-- onboarding step inserts one client-side either. The single existing user
-- was seeded by hand before this app had a sign-up flow at all, so the gap
-- was invisible until a genuinely new user tries it — Settings (where the
-- Garmin/Strava connectors live) would throw immediately.
--
-- Standard Supabase pattern: a trigger function on auth.users insert, owned
-- by the migration (not per-request app code), so it's impossible to sign up
-- without ending up with a profile row. All profiles columns besides user_id
-- are nullable or defaulted (0001_init.sql), so this insert is just the id.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: the one existing user already has a profiles row (predates this
-- trigger), but this stays safe to re-run if that ever weren't true.
insert into public.profiles (user_id)
select id from auth.users
where id not in (select user_id from public.profiles)
on conflict (user_id) do nothing;

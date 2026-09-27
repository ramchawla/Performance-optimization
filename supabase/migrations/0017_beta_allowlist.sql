-- Invite-only sign-up for the friends beta. Sign-up is reopened in the
-- Supabase dashboard (Auth → Providers → Email), so this is the actual gate:
-- a BEFORE INSERT trigger on auth.users that rejects any email not on the
-- allowlist. Enforced in the database — no client-side check can bypass it.

-- Who may manage the allowlist. Deliberately NO RLS policies at all (same
-- posture as integration_accounts, 0001_init.sql) — nobody, owner included,
-- can read or write this table directly from the client. The only door in is
-- the SECURITY DEFINER function below, so "make myself an owner" isn't a
-- writable operation from any authenticated session.
create table app_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table app_owners enable row level security;

insert into app_owners (user_id) values ('d17826a7-d20a-4a54-8299-fad65a4426be');

-- SECURITY DEFINER so it can read app_owners despite that table's RLS having
-- no policies (a plain subquery from within another table's RLS policy would
-- otherwise inherit the caller's restrictions and always see zero rows — the
-- standard Postgres/Supabase gotcha with nested RLS-protected lookups).
create or replace function public.is_app_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from app_owners where user_id = auth.uid());
$$;
revoke execute on function public.is_app_owner() from public, anon;
grant execute on function public.is_app_owner() to authenticated;

-- The invite list itself. email is always stored lowercased (checked below)
-- so matching against it is never case-sensitive by accident.
create table beta_allowlist (
  email       text primary key check (email = lower(email)),
  invited_by  uuid references auth.users(id),
  invited_at  timestamptz not null default now(),
  note        text
);
alter table beta_allowlist enable row level security;

-- Owner-only, both directions. Everyone else — including a friend checking
-- whether their own email is listed — gets zero rows and every write denied;
-- the anon pre-signup check goes through is_email_beta_invited() instead,
-- which never exposes the list, only a yes/no for one email at a time.
create policy "owners manage" on beta_allowlist for all
  using (is_app_owner()) with check (is_app_owner());

create or replace function public.is_email_beta_invited(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from beta_allowlist where email = lower(check_email));
$$;
grant execute on function public.is_email_beta_invited(text) to anon, authenticated;

-- The actual gate. BEFORE INSERT so a rejected sign-up never creates a row —
-- raising here aborts the whole auth.users insert, which aborts the sign-up.
create or replace function public.enforce_beta_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from beta_allowlist where email = lower(new.email)) then
    raise exception 'beta_invite_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
-- Same defensive lockdown as handle_new_user (0012) — a `returns trigger`
-- function is auto-exposed as a callable RPC by PostgREST purely from living
-- in the public schema, even though Postgres itself refuses to run it outside
-- a real trigger context.
revoke execute on function public.enforce_beta_allowlist() from public, anon, authenticated;

create trigger enforce_beta_allowlist_trigger
  before insert on auth.users
  for each row execute function public.enforce_beta_allowlist();

-- Two real bugs from code review of 0017, fixed here rather than editing an
-- already-applied migration:
--
-- 1. beta_allowlist.invited_by referenced auth.users(id) with no ON DELETE
--    action. Only the owner can ever insert a row (RLS gates writes to
--    is_app_owner()), so invited_by always points at the owner — meaning the
--    owner's own account could never be deleted via delete-account while any
--    invite existed: auth.admin.deleteUser() would hit this FK and fail.
--    Fixed with ON DELETE SET NULL — the invite record (and the friend's
--    access) is preserved; only the "who invited them" attribution clears.
--
-- 2. enforce_beta_allowlist() had no guard for new.email being null. Any
--    email-less auth.users insert (phone/anonymous auth, a future admin
--    flow) would be rejected by a trigger whose whole point is email-based
--    gating, for a request that has nothing to do with it.

alter table beta_allowlist drop constraint beta_allowlist_invited_by_fkey;
alter table beta_allowlist
  add constraint beta_allowlist_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null;

create or replace function public.enforce_beta_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and not exists (select 1 from beta_allowlist where email = lower(new.email)) then
    raise exception 'beta_invite_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

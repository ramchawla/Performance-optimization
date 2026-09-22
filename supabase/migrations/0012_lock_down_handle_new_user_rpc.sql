-- The trigger function from 0011 is auto-exposed as a callable RPC by
-- PostgREST (anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable) purely because it
-- lives in the public schema. It's a `returns trigger` function so Postgres
-- already refuses to run it outside an actual trigger context — but
-- revoking EXECUTE removes the exposed RPC entirely instead of relying on
-- that as the only line of defense.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

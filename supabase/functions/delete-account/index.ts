// Supabase Edge Function: delete-account
// Deploy with: supabase functions deploy delete-account
//
// Self-service account deletion for the friends beta (docs/superpowers/specs
// — beta_allowlist / delete-my-account design). The caller can only ever
// delete their own account: requireUser() reads the id off their own JWT,
// there is no "delete this other user" path.
//
// Order matters:
//   1. Delete the caller's Storage objects (progress-photos/<user_id>/...).
//      Storage is NOT a Postgres table — FK cascades never reach it, so a
//      photo blob left behind after the auth user is gone becomes
//      unreachable garbage (no user_id left to scope a cleanup query to).
//   2. auth.admin.deleteUser(userId) — every public.* table has `references
//      auth.users(id) on delete cascade` (verified before writing this
//      function), so this one call cascades all of the user's app data.
// If step 1 fails, we stop before step 2 so the account (and the ability to
// retry) isn't lost along with an error a retry could still fix.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Verifies the caller's JWT and returns their own user id, or null. Mirrors strava-oauth/garmin-sync. */
async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const userId = await requireUser(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  const supabase = serviceClient();

  try {
    // 1. Storage — the folder-per-user convention lib/queries/body.ts uses
    // (`${userId}/${uuid}.${ext}`), so listing that one folder finds every
    // photo without needing progress_photos rows at all (which is deliberate:
    // this must still work even if a row/blob pair ever went out of sync).
    // .list() defaults to a 100-item page — paginate until a short page, or
    // photo #101+ for a heavy user would silently survive account deletion
    // as permanently unreachable storage (no user_id left to clean it up by).
    const LIST_PAGE = 100;
    for (let offset = 0; ; offset += LIST_PAGE) {
      const { data: files, error: listErr } = await supabase.storage
        .from("progress-photos")
        .list(userId, { limit: LIST_PAGE, offset });
      if (listErr) throw new Error(`storage list: ${listErr.message}`);
      if (!files || files.length === 0) break;
      const { error: removeErr } = await supabase.storage
        .from("progress-photos")
        .remove(files.map((f) => `${userId}/${f.name}`));
      if (removeErr) throw new Error(`storage remove: ${removeErr.message}`);
      if (files.length < LIST_PAGE) break;
    }

    // 2. The auth user — cascades every public.* row (all FKs verified
    // `on delete cascade` before this function was written).
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (deleteErr) throw new Error(`auth delete: ${deleteErr.message}`);

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("delete-account:", message);
    return json({ error: message }, 500);
  }
});

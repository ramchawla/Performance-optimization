// Supabase Edge Function: strava-oauth
// Deploy with: supabase functions deploy strava-oauth --no-verify-jwt
//
// Implements TECHNICAL-DESIGN.md §7:
//   - OAuth2 code flow, tokens stored in integration_accounts
//   - ALWAYS check expires_at and refresh before calling the Strava API
//     (Strava access tokens expire every 6 hours)
//   - Read-only for v1: poll GET /athlete/activities on a "Sync now" button.
//     Writing our runs back to Strava is deferred to P2.
//
// verify_jwt is OFF because ?action=callback is a browser redirect from
// Strava and carries no Authorization header. Every OTHER action verifies the
// caller's JWT explicitly via requireUser() — do not add an action without it.
//
// Required secrets:
//   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET  — from the Strava API application
//   STRAVA_STATE_SECRET                     — any long random string; signs the
//                                             OAuth state so the callback can't
//                                             be forged for another user
//   APP_URL                                 — where to send the browser after
//                                             the callback completes

import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@^4";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
const SCOPES = "read,activity:read_all";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// ---- state signing -------------------------------------------------------
// The state param round-trips through Strava, so it has to prove which user
// started the flow without being forgeable.

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A stable UUID derived from a seed. cardio_sessions.client_id is `not null
 * unique`, and an upsert rewrites every column it's given — a random id would
 * therefore churn on every re-sync. Deriving it from the Strava activity id
 * keeps re-syncs true no-ops.
 */
async function stableUuid(seed: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  const hex = [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function signState(userId: string, secret: string): Promise<string> {
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

const STATE_TTL_MS = 10 * 60 * 1000;

async function verifyState(state: string, secret: string): Promise<string | null> {
  const [userId, issuedAt, sig] = state.split(".");
  if (!userId || !issuedAt || !sig) return null;
  const expected = await hmac(`${userId}.${issuedAt}`, secret);
  // Length-safe compare; these are same-length hex strings.
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;
  return userId;
}

// ---- clients -------------------------------------------------------------

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

/** Verifies the caller's JWT and returns their user id, or null. */
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

// ---- Strava payloads -----------------------------------------------------

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(), // unix seconds
  athlete: z.object({ id: z.number() }).optional(),
});

const ActivitySchema = z.object({
  id: z.number(),
  start_date: z.string(),
  type: z.string().optional(),
  sport_type: z.string().optional(),
  distance: z.number().optional(),
  moving_time: z.number().optional(),
  elapsed_time: z.number().optional(),
  average_heartrate: z.number().optional(),
  max_heartrate: z.number().optional(),
  name: z.string().optional(),
}).passthrough();

const ActivitiesSchema = z.array(ActivitySchema);

// ---- token lifecycle -----------------------------------------------------

interface Account {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  provider_user_id: string | null;
}

async function exchange(body: Record<string, string>) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("STRAVA_CLIENT_ID"),
      client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
  return TokenResponseSchema.parse(await res.json());
}

/**
 * Returns a valid access token, refreshing (and persisting) first if the
 * stored one is expired or within a minute of it.
 */
async function freshAccessToken(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  account: Account
): Promise<string> {
  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (account.access_token && expiresAt - Date.now() > 60_000) return account.access_token;
  if (!account.refresh_token) throw new Error("No refresh token stored — reconnect Strava");

  const token = await exchange({ grant_type: "refresh_token", refresh_token: account.refresh_token });
  const { error } = await supabase
    .from("integration_accounts")
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(token.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "strava");
  if (error) throw error;
  return token.access_token;
}

// ---- handler -------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const clientId = Deno.env.get("STRAVA_CLIENT_ID");
  const stateSecret = Deno.env.get("STRAVA_STATE_SECRET");
  if (!clientId || !Deno.env.get("STRAVA_CLIENT_SECRET") || !stateSecret) {
    return json({ error: "Strava secrets not configured" }, 500);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";
  const supabase = serviceClient();

  try {
    // --- callback: browser redirect from Strava, no JWT ---------------------
    if (action === "callback") {
      const appUrl = Deno.env.get("APP_URL") ?? "";
      const error = url.searchParams.get("error");
      if (error) return Response.redirect(`${appUrl}/settings?strava=denied`, 302);

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) return json({ error: "missing code or state" }, 400);

      const userId = await verifyState(state, stateSecret);
      if (!userId) return json({ error: "invalid or expired state" }, 400);

      const token = await exchange({ grant_type: "authorization_code", code });
      const { error: upsertErr } = await supabase.from("integration_accounts").upsert(
        {
          user_id: userId,
          provider: "strava",
          provider_user_id: token.athlete ? String(token.athlete.id) : null,
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expires_at: new Date(token.expires_at * 1000).toISOString(),
          scopes: SCOPES.split(","),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );
      if (upsertErr) throw upsertErr;

      return Response.redirect(`${appUrl}/settings?strava=connected`, 302);
    }

    // --- everything else requires the caller's JWT -------------------------
    const userId = await requireUser(req);
    if (!userId) return json({ error: "unauthorized" }, 401);

    if (action === "authorize") {
      const redirectUri = `${url.origin}${url.pathname}?action=callback`;
      const authorize = new URL(STRAVA_AUTHORIZE_URL);
      authorize.searchParams.set("client_id", clientId);
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("approval_prompt", "auto");
      authorize.searchParams.set("scope", SCOPES);
      authorize.searchParams.set("state", await signState(userId, stateSecret));
      return json({ url: authorize.toString() });
    }

    const { data: account, error: accountErr } = await supabase
      .from("integration_accounts")
      .select("access_token, refresh_token, expires_at, provider_user_id, updated_at")
      .eq("user_id", userId)
      .eq("provider", "strava")
      .maybeSingle();
    if (accountErr) throw accountErr;

    if (action === "status") {
      return json({
        connected: !!account,
        athleteId: account?.provider_user_id ?? null,
        lastSyncAt: account?.updated_at ?? null,
      });
    }

    if (action === "disconnect") {
      const { error } = await supabase
        .from("integration_accounts")
        .delete()
        .eq("user_id", userId)
        .eq("provider", "strava");
      if (error) throw error;
      return json({ ok: true, connected: false });
    }

    if (action === "sync") {
      if (!account) return json({ error: "Strava not connected" }, 400);
      const accessToken = await freshAccessToken(supabase, userId, account);

      // Personal scale: one page of 50 covers any realistic gap between syncs.
      const res = await fetch(`${STRAVA_ACTIVITIES_URL}?per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 429) return json({ error: "Strava rate limit hit — try again later" }, 429);
      if (!res.ok) return json({ error: `Strava activities fetch failed (${res.status})` }, 502);

      const activities = ActivitiesSchema.parse(await res.json());
      const rows = await Promise.all(activities.map(async (a) => ({
        client_id: await stableUuid(`strava:${userId}:${a.id}`),
        user_id: userId,
        started_at: a.start_date,
        activity: (a.sport_type ?? a.type ?? "run").toLowerCase(),
        distance_m: a.distance !== undefined ? Math.round(a.distance) : null,
        duration_s: a.moving_time ?? a.elapsed_time ?? null,
        avg_hr_bpm: a.average_heartrate !== undefined ? Math.round(a.average_heartrate) : null,
        max_hr_bpm: a.max_heartrate !== undefined ? Math.round(a.max_heartrate) : null,
        source: "strava" as const,
        external_id: String(a.id),
        notes: a.name ?? null,
        updated_at: new Date().toISOString(),
      })));

      let imported = 0;
      if (rows.length > 0) {
        // Idempotent on (user_id, source, external_id) — see 0001_init.sql:288.
        const { error, count } = await supabase
          .from("cardio_sessions")
          .upsert(rows, { onConflict: "user_id,source,external_id", count: "exact" });
        if (error) throw error;
        imported = count ?? rows.length;
      }

      const { error: touchErr } = await supabase
        .from("integration_accounts")
        .update({ updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("provider", "strava");
      if (touchErr) throw touchErr;

      return json({ ok: true, fetched: activities.length, imported });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

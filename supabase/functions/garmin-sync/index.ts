// Supabase Edge Function: garmin-sync
// Deploy with: supabase functions deploy garmin-sync
//
// Unofficial Garmin Connect integration — there is no public, self-serve
// Garmin Health API (partner-only, approval-gated), so this talks to the same
// undocumented endpoints the Garmin Connect app and community libraries use,
// via the `garmin-connect` npm package (github.com/Pythe1337N/garmin-connect).
// See TECHNICAL-DESIGN.md §7b for the decisions this implements.
//
// Unlike Strava, Garmin has no OAuth app-registration flow — "connecting"
// means the app submits the user's real Garmin username/password to Garmin's
// SSO once, server-side. The raw password is NEVER persisted: after a
// successful login we store only the resulting OAuth1 (long-lived, ~1yr) and
// OAuth2 (short-lived, auto-refreshed) token pair, reusing them on every sync
// via loadToken(). If they ever go stale, `sync` returns `reauth_required`
// and the user re-enters their password once via the Settings form — we do
// not attempt silent password-based re-login.
//
// Every field pulled from Garmin's internal API is extracted defensively
// (optional chaining, guessed key names) and the full raw response is always
// stored in health_metrics.raw — same "permissive, extract known fields,
// never fail the request" rule as ingest-health (§4). These endpoints are
// undocumented and can change without notice; if an extraction stops
// populating, the raw payload is there to inspect and fix the key name.

import { createClient } from "jsr:@supabase/supabase-js@2";
// garmin-connect is CommonJS (`module.exports = { GarminConnect, ... }`) — Deno's
// npm: interop does NOT synthesize a named export for that shape (confirmed via a
// live "does not provide an export named 'GarminConnect'" worker boot error), so
// this has to come in as the default export and be destructured, not named-imported.
// deno-types aren't reliable for this package's interop shape either, hence `any`.
import GarminConnectPkg from "npm:garmin-connect@^1";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GarminConnect: any = (GarminConnectPkg as any).GarminConnect;
// `GarminConnect` above is a value, not usable in type position — this alias is
// the type-position stand-in for it throughout the file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GarminClient = any;

// Called via fetch() from the browser (lib/queries/integrations.ts), not just
// curl/server-to-server — a POST with Content-Type: application/json triggers
// a CORS preflight. Every response (OPTIONS included) needs these headers or
// the browser blocks the request before it ever reaches the code below, which
// surfaces to the user as a bare "Load failed" / "Failed to fetch" with no
// status code to debug from. Confirmed live: curl bypasses CORS entirely and
// looked fine while the browser was actually failing.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role — Edge Function only, per CLAUDE.md rule 4
    { auth: { persistSession: false } }
  );
}

/** Verifies the caller's JWT and returns their user id, or null. Mirrors strava-oauth. */
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

/** Stable UUID derived from a seed — see strava-oauth's identical helper for why. */
async function stableUuid(seed: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  const hex = [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** 'YYYY-MM-DD' for `daysAgo` days before today, in the given IANA timezone. */
function localDateString(daysAgo: number, timezone: string): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return new Date(d.toLocaleString("en-US", { timeZone: timezone })).toISOString().slice(0, 10);
}

// ---- token storage -------------------------------------------------------
// integration_accounts.access_token / refresh_token are plain text columns
// designed for OAuth2 bearer strings (see 0001_init.sql §10). Garmin's SSO
// produces a pair of *token objects* (OAuth1 + OAuth2), not simple strings,
// so they're JSON-serialized into those same columns rather than adding new
// ones — access_token holds oauth2Token, refresh_token holds oauth1Token.
// Same "plaintext column, single-user v1, move to Vault before multi-user"
// posture already accepted for Strava's tokens in §8 — arguably a smaller
// blast radius here, since these are revocable-by-reconnect session tokens,
// never the account password itself.

interface StoredTokens {
  oauth1Token: unknown;
  oauth2Token: unknown;
}

async function loadAccount(supabase: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await supabase
    .from("integration_accounts")
    .select("access_token, refresh_token, provider_user_id, updated_at")
    .eq("user_id", userId)
    .eq("provider", "garmin")
    .maybeSingle();
  if (error) throw error;
  return data;
}

function clientFromStoredTokens(tokens: StoredTokens): GarminClient {
  const client = new GarminConnect({ username: "", password: "" });
  // Argument order is (oauth1, oauth2) per the library's documented example —
  // easy to get backwards since both are opaque token objects.
  client.loadToken(tokens.oauth1Token, tokens.oauth2Token);
  return client;
}

async function persistTokens(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  client: GarminClient
) {
  const oauth2Token = (client as unknown as { client: { oauth2Token: unknown } }).client.oauth2Token;
  const oauth1Token = (client as unknown as { client: { oauth1Token: unknown } }).client.oauth1Token;
  const { error } = await supabase.from("integration_accounts").update({
    access_token: JSON.stringify(oauth2Token),
    refresh_token: JSON.stringify(oauth1Token),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("provider", "garmin");
  if (error) throw error;
}

// ---- normalization ---------------------------------------------------------

type Agg = "latest" | "larger";

async function upsertMetric(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  metricType: string,
  metricDate: string,
  value: number,
  unit: string,
  raw: unknown,
  aggregation: Agg = "latest"
) {
  if (!Number.isFinite(value)) return false;

  if (aggregation === "larger") {
    const { data: existing } = await supabase
      .from("health_metrics")
      .select("value")
      .eq("user_id", userId).eq("metric_type", metricType).eq("metric_date", metricDate).eq("source", "garmin")
      .maybeSingle();
    if (existing && value <= existing.value) return false;
  }

  const { error } = await supabase.from("health_metrics").upsert(
    { user_id: userId, metric_type: metricType, metric_date: metricDate, value, unit, source: "garmin", raw },
    { onConflict: "user_id,metric_type,metric_date,source" }
  );
  return !error;
}

/** One day's worth of Garmin pulls, extracted defensively — see file header. */
async function syncDay(
  supabase: ReturnType<typeof serviceClient>,
  client: GarminClient,
  userId: string,
  date: string
) {
  let upserted = 0;
  const errors: string[] = [];

  const attempts: Array<() => Promise<void>> = [
    async () => {
      const steps = await client.getSteps(date);
      if (typeof steps === "number" && (await upsertMetric(supabase, userId, "steps", date, steps, "count", { steps }, "larger"))) upserted++;
    },
    async () => {
      const duration = await client.getSleepDuration(date);
      const seconds = (duration?.hours ?? 0) * 3600 + (duration?.minutes ?? 0) * 60;
      if (seconds > 0 && (await upsertMetric(supabase, userId, "sleep_duration_s", date, seconds, "s", duration))) upserted++;
    },
    async () => {
      const sleep = await client.getSleepData(date);
      const dto = (sleep as Record<string, unknown> | undefined)?.dailySleepDTO as Record<string, unknown> | undefined;
      const deep = dto?.deepSleepSeconds;
      const light = dto?.lightSleepSeconds;
      const rem = dto?.remSleepSeconds;
      if (typeof deep === "number") await upsertMetric(supabase, userId, "sleep_deep_s", date, deep, "s", sleep);
      if (typeof light === "number") await upsertMetric(supabase, userId, "sleep_light_s", date, light, "s", sleep);
      if (typeof rem === "number") await upsertMetric(supabase, userId, "sleep_rem_s", date, rem, "s", sleep);
    },
    async () => {
      const hr = await client.getHeartRate(date);
      const resting = (hr as Record<string, unknown> | undefined)?.restingHeartRate;
      if (typeof resting === "number" && (await upsertMetric(supabase, userId, "resting_hr_bpm", date, resting, "bpm", hr))) upserted++;
    },
    async () => {
      // Undocumented endpoint (garmin-connect npm has no high-level HRV method) —
      // path verified against cyberjunky/python-garminconnect's garmin_connect_hrv_url.
      const hrv = await client.get(`/hrv-service/hrv/${date}`, {});
      const avg = (hrv as Record<string, unknown> | undefined)?.hrvSummary as Record<string, unknown> | undefined;
      const value = avg?.lastNightAvg;
      if (typeof value === "number" && (await upsertMetric(supabase, userId, "hrv_ms", date, value, "ms", hrv))) upserted++;
    },
    async () => {
      // Undocumented — path verified against garmin_connect_daily_stress_url.
      const stress = await client.get(`/wellness-service/wellness/dailyStress/${date}`, {});
      const value = (stress as Record<string, unknown> | undefined)?.avgStressLevel;
      if (typeof value === "number" && value >= 0 && (await upsertMetric(supabase, userId, "stress_avg", date, value, "score", stress))) upserted++;
    },
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`syncDay ${date}:`, message);
      errors.push(message);
    }
  }

  return { upserted, errors };
}

async function syncActivities(
  supabase: ReturnType<typeof serviceClient>,
  client: GarminClient,
  userId: string
) {
  const activities = (await client.getActivities(0, 20)) as Array<Record<string, unknown>>;
  let imported = 0;
  const errors: string[] = [];

  for (const a of activities) {
    try {
      const activityId = a.activityId;
      const startLocal = a.startTimeLocal ?? a.startTimeGMT;
      if (activityId === undefined || typeof startLocal !== "string") continue;

      const activityType = (a.activityType as Record<string, unknown> | undefined)?.typeKey;
      const row = {
        client_id: await stableUuid(`garmin:${userId}:${activityId}`),
        user_id: userId,
        started_at: new Date(startLocal.replace(" ", "T") + "Z").toISOString(),
        activity: typeof activityType === "string" ? activityType.toLowerCase() : "workout",
        distance_m: typeof a.distance === "number" ? Math.round(a.distance) : null,
        duration_s: typeof a.duration === "number" ? Math.round(a.duration) : null,
        avg_hr_bpm: typeof a.averageHR === "number" ? Math.round(a.averageHR) : null,
        max_hr_bpm: typeof a.maxHR === "number" ? Math.round(a.maxHR) : null,
        source: "garmin" as const,
        external_id: String(activityId),
        notes: typeof a.activityName === "string" ? a.activityName : null,
        updated_at: new Date().toISOString(),
      };

      // Idempotent on (user_id, source, external_id) — same constraint Strava uses.
      const { error } = await supabase
        .from("cardio_sessions")
        .upsert(row, { onConflict: "user_id,source,external_id" });
      if (error) errors.push(`activity ${activityId}: ${error.message}`);
      else imported++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { fetched: activities.length, imported, errors };
}

// ---- handler ---------------------------------------------------------------

const SYNC_WINDOW_DAYS = 7; // personal-scale backfill window, mirrors strava-oauth's "one page covers any realistic gap"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";
  const supabase = serviceClient();

  // No auth required: read-only probes against Garmin's own public endpoints,
  // no user data or credentials touched. Kept ahead of requireUser purely so
  // it's reachable for diagnosis without a live user session on hand.
  if (action === "debug-network") {
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    const probe = async (label: string, target: string) => {
      try {
        const res = await fetch(target, { headers: { "User-Agent": UA }, redirect: "manual" });
        const body = await res.text();
        return {
          label,
          url: target,
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          bodySnippet: body.slice(0, 300),
        };
      } catch (err) {
        return { label, url: target, error: err instanceof Error ? err.message : String(err) };
      }
    };

    const results = await Promise.all([
      probe("connectapi_root", "https://connectapi.garmin.com/"),
      probe(
        "oauth_preauthorized_bogus_ticket",
        "https://connectapi.garmin.com/oauth-service/oauth/preauthorized?ticket=diagnostic-bogus-ticket&login-url=https://sso.garmin.com/sso/embed&accepts-mfa-tokens=true"
      ),
      probe("sso_embed", "https://sso.garmin.com/sso/embed?clientId=GarminConnect&locale=en"),
    ]);

    return json({ results });
  }

  const userId = await requireUser(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  try {
    if (action === "status") {
      const account = await loadAccount(supabase, userId);
      return json({ connected: !!account, lastSyncAt: account?.updated_at ?? null });
    }

    if (action === "disconnect") {
      const { error } = await supabase.from("integration_accounts").delete().eq("user_id", userId).eq("provider", "garmin");
      if (error) throw error;
      return json({ ok: true, connected: false });
    }

    if (action === "connect") {
      const body = await req.json().catch(() => ({}));
      const { username, password } = body as { username?: string; password?: string };
      if (!username || !password) return json({ error: "username and password are required" }, 400);

      const client = new GarminConnect({ username, password });
      try {
        await client.login();
      } catch (err) {
        // Garmin SSO failure — wrong credentials, MFA enabled (unsupported by
        // this library), or Garmin's login flow changed shape. Surface it
        // rather than a generic 500 so the Settings UI can say something real.
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: `Garmin login failed: ${message}` }, 401);
      }

      const { error: upsertErr } = await supabase.from("integration_accounts").upsert(
        {
          user_id: userId,
          provider: "garmin",
          access_token: JSON.stringify((client as unknown as { client: { oauth2Token: unknown } }).client.oauth2Token),
          refresh_token: JSON.stringify((client as unknown as { client: { oauth1Token: unknown } }).client.oauth1Token),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );
      if (upsertErr) throw upsertErr;

      return json({ ok: true, connected: true });
    }

    if (action === "connect-with-tokens") {
      // Fallback for when `connect` 429s from this function's own IP (see
      // scripts/garmin-local-login.ts) — the login already happened
      // elsewhere; this just stores the resulting token pair. No password
      // ever touches this action, so there's nothing here to validate a
      // login with — a malformed/expired token pair just fails on the next
      // `sync` the normal way (reauth_required).
      const body = await req.json().catch(() => ({}));
      const { oauth1Token, oauth2Token } = body as { oauth1Token?: unknown; oauth2Token?: unknown };
      if (!oauth1Token || !oauth2Token) return json({ error: "oauth1Token and oauth2Token are required" }, 400);

      const { error: upsertErr } = await supabase.from("integration_accounts").upsert(
        {
          user_id: userId,
          provider: "garmin",
          access_token: JSON.stringify(oauth2Token),
          refresh_token: JSON.stringify(oauth1Token),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );
      if (upsertErr) throw upsertErr;

      return json({ ok: true, connected: true });
    }

    if (action === "sync") {
      const account = await loadAccount(supabase, userId);
      if (!account?.access_token || !account?.refresh_token) return json({ error: "Garmin not connected" }, 400);

      const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
      const timezone = profile?.timezone ?? "America/Toronto";

      let client: GarminClient;
      try {
        client = clientFromStoredTokens({
          oauth1Token: JSON.parse(account.refresh_token),
          oauth2Token: JSON.parse(account.access_token),
        });
      } catch (err) {
        // Same blind spot as below — this could be a genuinely malformed
        // stored token (JSON.parse) or loadToken() itself throwing for a
        // different reason, and both looked identical from the outside.
        console.error("sync: clientFromStoredTokens threw:", err instanceof Error ? err.stack ?? err.message : String(err));
        return json({ error: "reauth_required" }, 401);
      }

      const errors: string[] = [];
      let upserted = 0;

      for (let daysAgo = 0; daysAgo < SYNC_WINDOW_DAYS; daysAgo++) {
        const date = localDateString(daysAgo, timezone);
        const result = await syncDay(supabase, client, userId, date);
        upserted += result.upserted;
        errors.push(...result.errors);
      }

      let activityResult = { fetched: 0, imported: 0, errors: [] as string[] };
      try {
        activityResult = await syncActivities(supabase, client, userId);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      errors.push(...activityResult.errors);

      // Nothing landed and everything errored — near-certainly an expired
      // session (every call above independently hits the same auth check)
      // rather than seven days of coincidental per-metric failures.
      if (upserted === 0 && activityResult.imported === 0 && errors.length > 0) {
        // reauth_required discards `errors` from the client response, which
        // made this heuristic firing for a NON-auth reason undiagnosable —
        // log what actually happened before returning the generic signal.
        console.error("sync: all attempts failed, returning reauth_required. Underlying errors:", JSON.stringify(errors));
        return json({ error: "reauth_required" }, 401);
      }

      await persistTokens(supabase, userId, client);

      return json({
        ok: errors.length === 0,
        upserted,
        activitiesFetched: activityResult.fetched,
        activitiesImported: activityResult.imported,
        errors: errors.slice(0, 10), // don't blow up the response on a bad week
      });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * integration_accounts is service-role only by design (0001_init.sql:461) —
 * the client cannot read it directly, so connection state comes from the
 * strava-oauth function instead.
 */
export interface StravaStatus {
  connected: boolean;
  athleteId: string | null;
  lastSyncAt: string | null;
}

async function callStrava<T>(action: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/strava-oauth?action=${action}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Strava request failed (${res.status})`);
  return body as T;
}

export function useStravaStatus() {
  return useQuery({
    queryKey: ["integration", "strava", "status"],
    queryFn: () => callStrava<StravaStatus>("status"),
    retry: false,
  });
}

/** Hands back the Strava consent URL; the caller navigates to it. */
export function useStravaConnect() {
  return useMutation({
    mutationFn: () => callStrava<{ url: string }>("authorize"),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}

export function useStravaDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callStrava<{ ok: boolean }>("disconnect", "POST"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "strava"] }),
  });
}

export function useStravaSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callStrava<{ fetched: number; imported: number }>("sync", "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration", "strava"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ---- Garmin -----------------------------------------------------------
// Unlike Strava, Garmin has no OAuth redirect flow — "connect" posts the
// user's Garmin username/password directly to garmin-sync, which logs in
// server-side and never stores the raw password (see that function's header
// comment). `sync` can return `reauth_required` if the stored session has
// gone stale, which the UI treats as "not connected" rather than an error.

export interface GarminStatus {
  connected: boolean;
  lastSyncAt: string | null;
}

export interface GarminSyncResult {
  upserted: number;
  activitiesFetched: number;
  activitiesImported: number;
  errors: string[];
}

async function callGarmin<T>(
  action: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  params: Record<string, string> = {}
): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/garmin-sync?${new URLSearchParams({ action, ...params })}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }
  );
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = responseBody?.error === "reauth_required" ? "reauth_required" : responseBody?.error;
    throw new Error(message ?? `Garmin request failed (${res.status})`);
  }
  return responseBody as T;
}

export function useGarminStatus() {
  return useQuery({
    queryKey: ["integration", "garmin", "status"],
    queryFn: () => callGarmin<GarminStatus>("status"),
    retry: false,
  });
}

export function useGarminConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      callGarmin<{ ok: boolean; connected: boolean }>("connect", "POST", creds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "garmin"] }),
  });
}

/** Fallback for when `connect` 429s from this function's IP — see scripts/garmin-local-login.ts. */
export function useGarminConnectWithTokens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tokens: { oauth1Token: unknown; oauth2Token: unknown }) =>
      callGarmin<{ ok: boolean; connected: boolean }>("connect-with-tokens", "POST", tokens),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "garmin"] }),
  });
}

export function useGarminDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callGarmin<{ ok: boolean }>("disconnect", "POST"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration", "garmin"] }),
  });
}

export function useGarminSync() {
  const qc = useQueryClient();
  return useMutation({
    // Manual "Sync now" re-pulls a week; auto-sync passes days: 2 (today +
    // yesterday, when sleep/HRV finalise) to keep hourly Garmin calls low.
    mutationFn: (opts?: { days?: number }) =>
      callGarmin<GarminSyncResult>("sync", "POST", undefined, opts?.days ? { days: String(opts.days) } : {}),
    onSuccess: () => invalidateGarminData(qc),
  });
}

function invalidateGarminData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["integration", "garmin"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["sleep"] });
}

const BACKFILL_DAYS = 90;
const BACKFILL_CHUNK = 14; // garmin-sync caps a call at 14 days (~70 Garmin requests)

/**
 * One-time history pull so 30/90-day trends aren't empty. Chunked from the
 * client because 90 days in one invocation (~450 Garmin requests) would blow
 * the edge function's wall-clock limit. Stops on the first failed chunk;
 * earlier chunks stay written (upserts are idempotent), so re-running resumes.
 */
export function useGarminBackfill(onProgress: (daysDone: number, total: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      let upserted = 0;
      for (let offset = 0; offset < BACKFILL_DAYS; offset += BACKFILL_CHUNK) {
        const days = Math.min(BACKFILL_CHUNK, BACKFILL_DAYS - offset);
        const res = await callGarmin<GarminSyncResult>("sync", "POST", undefined, {
          offset: String(offset),
          days: String(days),
        });
        upserted += res.upserted;
        onProgress(offset + days, BACKFILL_DAYS);
      }
      return { upserted };
    },
    onSettled: () => invalidateGarminData(qc),
  });
}

const AUTO_SYNC_STORAGE_KEY = "garmin_last_auto_sync";
const SYNC_REQUEST_EVENT = "garmin-sync-request";
// ponytail: 30-min throttle — an auto-sync is ~10 Garmin calls (2 days + today's
// fitness) on an unofficial API that has IP-flagged us once. Tighten only with cause.
const AUTO_SYNC_INTERVAL_MS = 30 * 60_000;

/**
 * Ask for a Garmin sync now, skipping the throttle — e.g. right after a workout
 * is finished in the app, when fresh watch data is most likely. Handled by
 * useGarminAutoSync wherever it's mounted (the (main) layout).
 */
export function requestGarminSync() {
  window.dispatchEvent(new Event(SYNC_REQUEST_EVENT));
}

/**
 * There is no server-side cron for Garmin (see TECHNICAL-DESIGN.md §7b), and
 * Garmin offers no push to personal apps — so "automatic" means these triggers:
 *   - app opened, or brought back to the foreground (visibilitychange), at
 *     most once per 30 min;
 *   - requestGarminSync(), e.g. finishing a workout — immediate, unthrottled.
 * Best-effort by design — a failure here isn't worth a toast; Settings'
 * "Sync now" + its status text is the surface for real errors. localStorage
 * is per-device, which is fine: any device opening the app keeps data fresh.
 */
export function useGarminAutoSync() {
  const { data: status } = useGarminStatus();
  // TanStack's mutate is referentially stable, so depending on it doesn't re-run the effect.
  const { mutate } = useGarminSync();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!status?.connected) return;

    const run = (force: boolean) => {
      if (inFlight.current) return;
      let lastAuto = 0;
      try {
        lastAuto = Number(localStorage.getItem(AUTO_SYNC_STORAGE_KEY) ?? 0);
      } catch {
        // Storage unavailable (private mode, etc.) — fall through and sync.
      }
      if (!force && Date.now() - lastAuto < AUTO_SYNC_INTERVAL_MS) return;
      inFlight.current = true;
      mutate(
        { days: 2 },
        {
          onSettled: () => {
            inFlight.current = false;
            try {
              localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));
            } catch {
              // Non-fatal — worst case the next trigger fires again.
            }
          },
        }
      );
    };

    const onVisible = () => document.visibilityState === "visible" && run(false);
    const onRequest = () => run(true);
    run(false);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(SYNC_REQUEST_EVENT, onRequest);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(SYNC_REQUEST_EVENT, onRequest);
    };
  }, [status?.connected, mutate]);
}

/** Last time Apple Health actually delivered anything — the only honest status there is. */
/**
 * REL-4's ingest heartbeat. The Shortcut can stop firing for reasons the app
 * never observes — a revoked automation, a phone that never charged overnight —
 * and the symptom is silence, indistinguishable from a quiet week. Unflagged,
 * you'd find out months later as a hole in a chart.
 */
const HEARTBEAT_STALE_HOURS = 48;

export function useHealthExportStatus() {
  return useQuery({
    queryKey: ["integration", "health_export", "status"],
    // Staleness is derived here rather than in the component: reading the clock
    // during render is impure, and React may render at any time it likes.
    queryFn: async (): Promise<{
      lastMetricAt: string | null;
      hoursSince: number | null;
      stale: boolean;
    }> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("health_metrics")
        .select("created_at")
        .eq("source", "health_export")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      const lastMetricAt = data?.created_at ?? null;
      const hoursSince = lastMetricAt
        ? (Date.now() - new Date(lastMetricAt).getTime()) / 3_600_000
        : null;
      return {
        lastMetricAt,
        hoursSince,
        stale: hoursSince !== null && hoursSince > HEARTBEAT_STALE_HOURS,
      };
    },
    // Without this the answer is computed once and then frozen for the life of
    // the tab, so a page left open would never cross the threshold.
    refetchInterval: 15 * 60_000,
  });
}

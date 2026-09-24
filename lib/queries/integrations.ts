import { useEffect } from "react";
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
  body?: unknown
): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/garmin-sync?action=${action}`,
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
    mutationFn: () => callGarmin<GarminSyncResult>("sync", "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration", "garmin"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

const AUTO_SYNC_STORAGE_KEY = "garmin_last_auto_sync";
// ponytail: 1h throttle — each sync is ~43 Garmin calls on an unofficial API that has
// already IP-flagged us once; per-load with no throttle risks getting the account flagged.
const AUTO_SYNC_INTERVAL_MS = 3_600_000;

/**
 * There is no server-side cron for Garmin (see TECHNICAL-DESIGN.md §7b) — this
 * is what "automatic" means instead: fire a background sync from the client at
 * most once per hour, on app load (mounted in the (main) layout), so opening the app in the morning has last night's
 * sleep/HRV without a manual tap. Best-effort by design — a failure here
 * isn't worth a toast, the Settings "Sync now" button + its status text is the
 * surface for real errors. localStorage is per-device, which is fine: any
 * device opening the app keeps the data fresh.
 */
export function useGarminAutoSync() {
  const { data: status } = useGarminStatus();
  const sync = useGarminSync();

  useEffect(() => {
    if (!status?.connected) return;
    let lastAuto = 0;
    try {
      lastAuto = Number(localStorage.getItem(AUTO_SYNC_STORAGE_KEY) ?? 0);
    } catch {
      // Storage unavailable (private mode, etc.) — just sync every mount.
    }
    if (Date.now() - lastAuto < AUTO_SYNC_INTERVAL_MS) return;

    sync.mutate(undefined, {
      onSettled: () => {
        try {
          localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));
        } catch {
          // Non-fatal — worst case this fires again next mount.
        }
      },
    });
    // Deliberately mount-triggered only, not a `sync` dependency — re-running
    // whenever the mutation object identity changes would defeat the guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);
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

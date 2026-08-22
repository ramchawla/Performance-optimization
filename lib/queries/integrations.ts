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

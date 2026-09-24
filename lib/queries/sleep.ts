import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/database.types";
import { enqueueAndSync } from "@/lib/sync/syncWorker";
import { dailyClientId } from "@/lib/sync/stableId";

export type SleepLog = Database["public"]["Tables"]["sleep_logs"]["Row"];

/**
 * Garmin supplies every sleep measurement; sleep_logs is the subjective layer
 * (docs/superpowers/specs/2026-09-24-sleep-section-design.md).
 */
export const SLEEP_TAGS = [
  { key: "caffeine_late", label: "Late caffeine" },
  { key: "alcohol", label: "Alcohol" },
  { key: "late_meal", label: "Late meal" },
  { key: "screens", label: "Screens in bed" },
  { key: "stressed", label: "Stressed" },
  { key: "sick", label: "Sick" },
  { key: "travel", label: "Travel" },
  { key: "nap", label: "Napped" },
] as const;

/** Scalar metrics the Sleep page reads per night and for trends. */
export const SLEEP_METRICS = [
  "sleep_score",
  "sleep_duration_s",
  "sleep_need_s",
  "sleep_deep_s",
  "sleep_light_s",
  "sleep_rem_s",
  "sleep_awake_s",
  "sleep_awake_count",
  "sleep_start_offset_s",
  "sleep_end_offset_s",
  "sleep_resp_avg",
  "sleep_stress_avg",
  "sleep_hr_avg",
  "body_battery_gain",
  "hrv_ms",
  "hrv_weekly_avg",
  "hrv_baseline_low",
  "hrv_baseline_high",
  "resting_hr_bpm",
] as const;

export type SleepMetric = (typeof SLEEP_METRICS)[number];
export type NightMetrics = Partial<Record<SleepMetric, number>>;

// Same order as daily_rollup (migration 0010): a watch beats a phone export.
const SOURCE_RANK: Record<string, number> = { garmin: 0, health_export: 1, strava: 2, manual: 3 };

async function requireUserId() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return { supabase, userId: data.user.id };
}

/** health_metrics rows → one value per (date, metric), highest-priority source wins. */
function pickBySource(
  rows: Array<{ metric_date: string; metric_type: string; value: number; source: string }>
): Map<string, NightMetrics> {
  const best = new Map<string, { rank: number; value: number }>();
  for (const r of rows) {
    const key = `${r.metric_date}|${r.metric_type}`;
    const rank = SOURCE_RANK[r.source] ?? 9;
    const prev = best.get(key);
    if (!prev || rank < prev.rank) best.set(key, { rank, value: Number(r.value) });
  }
  const byDate = new Map<string, NightMetrics>();
  for (const [key, { value }] of best) {
    const [date, metric] = key.split("|");
    const night = byDate.get(date) ?? {};
    night[metric as SleepMetric] = value;
    byDate.set(date, night);
  }
  return byDate;
}

export interface SleepNight {
  metrics: NightMetrics;
  /** Full getSleepData payload (hypnogram, overnight HR/respiration, score qualifiers). */
  sleepRaw: Record<string, Json | undefined> | null;
  /** HRV payload (5-min overnight readings, Garmin's status/baseline). */
  hrvRaw: Record<string, Json | undefined> | null;
  log: SleepLog | null;
}

export function useSleepNight(date: string) {
  return useQuery({
    queryKey: ["sleep", "night", date],
    queryFn: async (): Promise<SleepNight> => {
      const { supabase, userId } = await requireUserId();
      const [metricsRes, rawRes, logRes] = await Promise.all([
        supabase
          .from("health_metrics")
          .select("metric_date, metric_type, value, source")
          .eq("user_id", userId)
          .eq("metric_date", date)
          .in("metric_type", SLEEP_METRICS),
        // Only these two rows carry a payload (garmin-sync stores one copy per night).
        supabase
          .from("health_metrics")
          .select("metric_type, raw")
          .eq("user_id", userId)
          .eq("metric_date", date)
          .eq("source", "garmin")
          .in("metric_type", ["sleep_duration_s", "hrv_ms"]),
        supabase.from("sleep_logs").select("*").eq("user_id", userId).eq("log_date", date).maybeSingle(),
      ]);
      if (metricsRes.error) throw metricsRes.error;
      if (rawRes.error) throw rawRes.error;
      if (logRes.error) throw logRes.error;

      const asObj = (v: Json | null | undefined) =>
        v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Json | undefined>) : null;
      return {
        metrics: pickBySource(metricsRes.data).get(date) ?? {},
        sleepRaw: asObj(rawRes.data.find((r) => r.metric_type === "sleep_duration_s")?.raw),
        hrvRaw: asObj(rawRes.data.find((r) => r.metric_type === "hrv_ms")?.raw),
        log: logRes.data,
      };
    },
  });
}

export interface TrendNight {
  date: string;
  metrics: NightMetrics;
  log: Pick<SleepLog, "quality" | "tags"> | null;
}

/**
 * The last `days` nights plus 28 more so every night in the window can be
 * compared against a full trailing baseline. Oldest first. Scalars only —
 * no raw payloads, so a 90-day trend stays a small read.
 */
export function useSleepTrend(days: number) {
  return useQuery({
    queryKey: ["sleep", "trend", days],
    queryFn: async (): Promise<TrendNight[]> => {
      const { supabase, userId } = await requireUserId();
      const since = new Date(Date.now() - (days + 28) * 86_400_000).toLocaleDateString("en-CA");
      // PostgREST caps a response at 1000 rows by default and truncates silently;
      // 118 days × ~19 metrics is ~2200, so page through it.
      const PAGE = 1000;
      const metricRows: Array<{ metric_date: string; metric_type: string; value: number; source: string }> = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("health_metrics")
          .select("metric_date, metric_type, value, source")
          .eq("user_id", userId)
          .gte("metric_date", since)
          .in("metric_type", SLEEP_METRICS)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        metricRows.push(...data);
        if (data.length < PAGE) break;
      }
      const logsRes = await supabase
        .from("sleep_logs")
        .select("log_date, quality, tags")
        .eq("user_id", userId)
        .gte("log_date", since);
      if (logsRes.error) throw logsRes.error;

      const byDate = pickBySource(metricRows);
      const logs = new Map(logsRes.data.map((l) => [l.log_date, { quality: l.quality, tags: l.tags }]));
      const dates = [...new Set([...byDate.keys(), ...logs.keys()])].sort();
      return dates.map((date) => ({ date, metrics: byDate.get(date) ?? {}, log: logs.get(date) ?? null }));
    },
  });
}

export interface SleepFeelInput {
  logDate: string; // wake-up date, YYYY-MM-DD (CLAUDE.md rule 5)
  quality: number | null;
  notes: string | null;
  tags: string[];
}

/**
 * Offline-writable via the outbox (CLAUDE.md rule 3). One row per day, so the
 * client_id is derived from (user_id, log_date) — see lib/sync/stableId.ts.
 * The payload carries only the subjective columns: upsert's ON CONFLICT only
 * updates the columns sent, so any older manually-entered measurements survive.
 */
export function useUpsertSleepFeel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SleepFeelInput): Promise<string> => {
      const { userId } = await requireUserId();
      const clientId = await dailyClientId(userId, input.logDate);
      await enqueueAndSync("sleep_logs", "upsert", {
        client_id: clientId,
        user_id: userId,
        log_date: input.logDate,
        quality: input.quality,
        notes: input.notes,
        tags: input.tags,
        updated_at: new Date().toISOString(),
      });
      return clientId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sleep"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

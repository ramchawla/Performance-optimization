import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { enqueueAndSync } from "@/lib/sync/syncWorker";
import { dailyClientId } from "@/lib/sync/stableId";

export type SleepLog = Database["public"]["Tables"]["sleep_logs"]["Row"];

/**
 * Every field is optional by design — a night can be logged as just "7 hours"
 * or as the full Apple breakdown, and anything in between.
 */
export interface SleepLogInput {
  logDate: string; // wake-up date, YYYY-MM-DD (CLAUDE.md rule 5)
  bedtimeAt: string | null; // ISO timestamp
  waketimeAt: string | null;
  durationS: number | null;
  remS: number | null;
  deepS: number | null;
  coreS: number | null;
  scoreDisruptions: number | null;
  scoreConsistency: number | null;
  scoreDuration: number | null;
  quality: number | null;
  notes: string | null;
}

export function useSleepLog(logDate: string) {
  return useQuery({
    queryKey: ["sleep", logDate],
    queryFn: async (): Promise<SleepLog | null> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("log_date", logDate)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSleepHistory(limit = 30) {
  return useQuery({
    queryKey: ["sleep", "history", limit],
    queryFn: async (): Promise<SleepLog[]> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("log_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Offline-writable via the outbox (CLAUDE.md rule 3).
 *
 * One row per day, so the client_id is derived from (user_id, log_date) rather
 * than random — see lib/sync/stableId.ts. Editing the same night twice must
 * produce the same key, otherwise the second edit tries to insert a second row
 * for that date and is rejected by the day-unique constraint forever.
 */
export function useUpsertSleepLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SleepLogInput): Promise<string> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const clientId = await dailyClientId(userData.user.id, input.logDate);
      await enqueueAndSync("sleep_logs", "upsert", {
        client_id: clientId,
        user_id: userData.user.id,
        log_date: input.logDate,
        bedtime_at: input.bedtimeAt,
        waketime_at: input.waketimeAt,
        duration_s: input.durationS,
        rem_s: input.remS,
        deep_s: input.deepS,
        core_s: input.coreS,
        score_disruptions: input.scoreDisruptions,
        score_consistency: input.scoreConsistency,
        score_duration: input.scoreDuration,
        quality: input.quality,
        notes: input.notes,
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

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
 * ponytail: direct write, not via the offline outbox. Sleep gets logged in the
 * morning at home, and adding a table to the outbox list means amending
 * TECHNICAL-DESIGN §3 and the writer's table union. Revisit if a night ever
 * gets lost to a dead connection.
 */
export function useUpsertSleepLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SleepLogInput): Promise<SleepLog> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("sleep_logs")
        .upsert(
          {
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
          },
          { onConflict: "user_id,log_date" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["sleep"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      return row;
    },
  });
}

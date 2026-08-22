import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { enqueueAndSync } from "@/lib/sync/syncWorker";
import type { Database } from "@/lib/database.types";
import { todayLocal } from "@/lib/datetime";

export type MobilityLog = Database["public"]["Tables"]["mobility_logs"]["Row"];

/** Most recent `limit` mobility_logs rows, newest first — schema is one flat row/day (no routines/sessions). */
export function useMobilityHistory(limit = 14) {
  return useQuery({
    queryKey: ["mobility-logs", limit],
    queryFn: async (): Promise<MobilityLog[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("mobility_logs")
        .select("*")
        .order("log_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export interface LogMobilityInput {
  exercisesDone: string[];
  hipTightness: number | null;
  durationMin: number | null;
  notes?: string | null;
}

/** Upserts today's mobility_logs row — schema's unique(user_id, log_date) means
 * logging twice in one day must edit the same row, so we reuse today's existing
 * client_id (if any) rather than always minting a new one. */
export function useLogMobility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogMobilityInput) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      const logDate = todayLocal();
      const { data: existing } = await supabase
        .from("mobility_logs")
        .select("client_id")
        .eq("user_id", userData.user.id)
        .eq("log_date", logDate)
        .maybeSingle();

      const clientId = existing?.client_id ?? crypto.randomUUID();
      await enqueueAndSync("mobility_logs", "upsert", {
        id: clientId,
        client_id: clientId,
        user_id: userData.user.id,
        log_date: logDate,
        completed: true,
        exercises_done: input.exercisesDone,
        hip_tightness: input.hipTightness,
        duration_min: input.durationMin,
        notes: input.notes ?? null,
      });
      return clientId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobility-logs"] }),
  });
}

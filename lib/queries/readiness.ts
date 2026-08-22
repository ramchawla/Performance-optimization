import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { type ReadinessField } from "@/lib/calc/readiness";
import { enqueueAndSync } from "@/lib/sync/syncWorker";
import { dailyClientId } from "@/lib/sync/stableId";

export { READINESS_FIELDS, ILLNESS_OPTIONS, type ReadinessField } from "@/lib/calc/readiness";

export type ReadinessLog = Database["public"]["Tables"]["readiness_logs"]["Row"];


export function useReadinessLog(logDate: string) {
  return useQuery({
    queryKey: ["readiness", logDate],
    queryFn: async (): Promise<ReadinessLog | null> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("readiness_logs")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("log_date", logDate)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useReadinessHistory(limit = 30) {
  return useQuery({
    queryKey: ["readiness", "history", limit],
    queryFn: async (): Promise<ReadinessLog[]> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("readiness_logs")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("log_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export type ReadinessInput = {
  logDate: string;
  illness: string | null;
  readinessScore: number | null;
  notes: string | null;
} & Partial<Record<ReadinessField, number | null>>;

/**
 * Offline-writable via the outbox (CLAUDE.md rule 3). One row per day, so the
 * client_id is derived from (user_id, log_date) — same reasoning as sleep_logs,
 * see lib/sync/stableId.ts.
 */
export function useUpsertReadiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReadinessInput): Promise<string> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { logDate, illness, readinessScore, notes, ...ratings } = input;
      const clientId = await dailyClientId(userData.user.id, logDate);
      await enqueueAndSync("readiness_logs", "upsert", {
        client_id: clientId,
        user_id: userData.user.id,
        log_date: logDate,
        illness,
        readiness_score: readinessScore,
        notes,
        ...ratings,
        updated_at: new Date().toISOString(),
      });
      return clientId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["readiness"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

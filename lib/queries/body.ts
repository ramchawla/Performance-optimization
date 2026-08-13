import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { enqueue } from "@/lib/sync/outbox";
import type { Database } from "@/lib/database.types";

export type BodyMetric = Database["public"]["Tables"]["body_metrics"]["Row"];
export type ProgressPhoto = Database["public"]["Tables"]["progress_photos"]["Row"];

/** Most recent `limit` body_metrics rows, newest first. */
export function useBodyMetricsHistory(limit = 90) {
  return useQuery({
    queryKey: ["body-metrics", limit],
    queryFn: async (): Promise<BodyMetric[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("body_metrics")
        .select("*")
        .order("measured_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export interface LogBodyMetricInput {
  weightKg?: number | null;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
  bodyFatPct?: number | null;
  bfMethod?: Database["public"]["Tables"]["body_metrics"]["Row"]["bf_method"];
}

/** Logs a weigh-in / measurement snapshot — offline-writable via outbox (CLAUDE.md rule 3). */
export function useLogBodyMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogBodyMetricInput) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      const clientId = crypto.randomUUID();
      await enqueue("body_metrics", "upsert", {
        id: clientId,
        client_id: clientId,
        user_id: userData.user.id,
        weight_kg: input.weightKg ?? null,
        waist_cm: input.waistCm ?? null,
        neck_cm: input.neckCm ?? null,
        hip_cm: input.hipCm ?? null,
        body_fat_pct: input.bodyFatPct ?? null,
        bf_method: input.bfMethod ?? null,
      });
      return clientId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body-metrics"] }),
  });
}

export function useProgressPhotos() {
  return useQuery({
    queryKey: ["progress-photos"],
    queryFn: async (): Promise<ProgressPhoto[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("progress_photos")
        .select("*")
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

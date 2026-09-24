import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { combineLocal } from "@/lib/datetime";
import type { Database } from "@/lib/database.types";

export type CardioSession = Database["public"]["Tables"]["cardio_sessions"]["Row"];

export const ACTIVITIES = ["run", "bike", "swim", "row", "walk", "ruck", "hike", "elliptical", "hiit", "other"] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const ACTIVITY_LABELS: Record<Activity, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  row: "Row",
  walk: "Walk",
  ruck: "Ruck",
  hike: "Hike",
  elliptical: "Elliptical",
  hiit: "HIIT",
  other: "Other",
};

export function useCardioHistory(limit = 30) {
  return useQuery({
    queryKey: ["cardio", limit],
    queryFn: async (): Promise<CardioSession[]> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("cardio_sessions")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export interface LogCardioInput {
  /** Local date + "HH:MM" — backdating is the normal case, not an edge case. */
  date: string;
  time: string;
  activity: Activity;
  distanceM?: number | null;
  durationS?: number | null;
  avgHrBpm?: number | null;
  maxHrBpm?: number | null;
  perceivedEffort?: number | null;
  notes?: string | null;
}

export function useLogCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogCardioInput): Promise<CardioSession> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const clientId = crypto.randomUUID();
      const { data, error } = await supabase
        .from("cardio_sessions")
        .insert({
          client_id: clientId,
          user_id: userData.user.id,
          started_at: combineLocal(input.date, input.time),
          activity: input.activity,
          distance_m: input.distanceM ?? null,
          duration_s: input.durationS ?? null,
          avg_hr_bpm: input.avgHrBpm ?? null,
          max_hr_bpm: input.maxHrBpm ?? null,
          perceived_effort: input.perceivedEffort ?? null,
          source: "manual",
          notes: input.notes ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cardio"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("cardio_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cardio"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export interface ActivityDetail {
  session: CardioSession;
  /** Garmin payloads keyed by part (summary, detail, splits, hr_zones, sets); empty for non-Garmin sessions. */
  parts: Partial<Record<"summary" | "detail" | "splits" | "hr_zones" | "sets", unknown>>;
}

/** One session plus, for Garmin activities, its stored per-activity payloads (garmin_payloads, 0014). */
export function useActivityDetail(id: string) {
  return useQuery({
    queryKey: ["cardio", "detail", id],
    queryFn: async (): Promise<ActivityDetail> => {
      const supabase = createClient();
      const { data: session, error } = await supabase.from("cardio_sessions").select("*").eq("id", id).single();
      if (error) throw error;
      if (session.source !== "garmin" || !session.external_id) return { session, parts: {} };

      const kinds = (["summary", "detail", "splits", "hr_zones", "sets"] as const).map((p) => `activity_${p}:${session.external_id}`);
      const { data: payloads, error: pErr } = await supabase.from("garmin_payloads").select("kind, payload").in("kind", kinds);
      if (pErr) throw pErr;
      const parts: ActivityDetail["parts"] = {};
      for (const p of payloads) {
        const part = p.kind.slice("activity_".length, p.kind.indexOf(":")) as keyof ActivityDetail["parts"];
        parts[part] = p.payload;
      }
      return { session, parts };
    },
  });
}

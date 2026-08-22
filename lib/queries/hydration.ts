import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { combineLocal, todayLocal } from "@/lib/datetime";
import { enqueueAndSync } from "@/lib/sync/syncWorker";
import type { Database } from "@/lib/database.types";

export type HydrationLog = Database["public"]["Tables"]["hydration_logs"]["Row"];

export const DRINK_TYPES = [
  "water",
  "electrolyte",
  "coffee",
  "tea",
  "juice",
  "soda",
  "protein_shake",
  "alcohol",
  "other",
] as const;
export type DrinkType = (typeof DRINK_TYPES)[number];

export const DRINK_LABELS: Record<DrinkType, string> = {
  water: "Water",
  electrolyte: "Electrolyte",
  coffee: "Coffee",
  tea: "Tea",
  juice: "Juice",
  soda: "Soda",
  protein_shake: "Shake",
  alcohol: "Alcohol",
  other: "Other",
};

export const DRINK_CONTEXTS = ["waking", "with_meal", "training", "pre_bed", "other"] as const;
export type DrinkContext = (typeof DRINK_CONTEXTS)[number];

export const CONTEXT_LABELS: Record<DrinkContext, string> = {
  waking: "On waking",
  with_meal: "With a meal",
  training: "Training",
  pre_bed: "Before bed",
  other: "Other",
};

/**
 * Typical caffeine content, used to prefill rather than to override — the
 * field stays editable because a double espresso and a drip coffee are not
 * the same drink.
 */
export const TYPICAL_CAFFEINE_MG: Partial<Record<DrinkType, number>> = {
  coffee: 95,
  tea: 40,
  soda: 35,
};

/** Common pours, so logging a glass of water is one tap. */
export const QUICK_VOLUMES_ML = [250, 500, 750, 1000];

export function useHydrationLog(logDate: string) {
  return useQuery({
    queryKey: ["hydration", logDate],
    queryFn: async (): Promise<HydrationLog[]> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("hydration_logs")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("log_date", logDate)
        .order("consumed_at");
      if (error) throw error;
      return data;
    },
  });
}

export interface LogDrinkInput {
  logDate?: string;
  /** Local "HH:MM"; defaults to now. */
  time?: string;
  volumeMl: number;
  drinkType: DrinkType;
  caffeineMg?: number | null;
  alcoholUnits?: number | null;
  sodiumMg?: number | null;
  context?: DrinkContext | null;
  notes?: string | null;
}

/**
 * Offline-writable via the outbox (CLAUDE.md rule 3) — water is logged in gyms,
 * on trains and in basements, which is exactly where a direct write is lost.
 * Append-only, so a random client_id per row is the right idempotency key.
 */
export function useLogDrink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogDrinkInput): Promise<string> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const logDate = input.logDate ?? todayLocal();
      const clientId = crypto.randomUUID();
      await enqueueAndSync("hydration_logs", "upsert", {
        id: clientId,
        client_id: clientId,
        user_id: userData.user.id,
        log_date: logDate,
        consumed_at: input.time ? combineLocal(logDate, input.time) : new Date().toISOString(),
        volume_ml: input.volumeMl,
        drink_type: input.drinkType,
        caffeine_mg: input.caffeineMg ?? null,
        alcohol_units: input.alcoholUnits ?? null,
        sodium_mg: input.sodiumMg ?? null,
        context: input.context ?? null,
        notes: input.notes ?? null,
      });
      return clientId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hydration"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteDrink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("hydration_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hydration"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

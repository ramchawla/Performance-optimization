import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { enqueue } from "@/lib/sync/outbox";
import { scaleServing, sumDailyTotals, type DailyTotals } from "@/lib/calc/nutritionTotals";
import type { Food } from "@/lib/queries/foods";
import type { Database } from "@/lib/database.types";

type NutritionLog = Database["public"]["Tables"]["nutrition_logs"]["Row"];
type MealType = Database["public"]["Enums"]["meal_type"];

export interface LogFoodInput {
  food: Food;
  quantity: number;
  meal: MealType;
  logDate: string; // client-side, user's timezone — CLAUDE.md rule 5
}

/** Logs a food entry with macros snapshotted at write time (CLAUDE.md rule 2) — editing the food later never rewrites past logs. */
export function useLogFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogFoodInput) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      const scaled = scaleServing(
        {
          calories: input.food.calories,
          proteinG: input.food.protein_g,
          carbsG: input.food.carbs_g,
          fatG: input.food.fat_g,
          fiberG: input.food.fiber_g,
          micros: (input.food.micros as Record<string, number>) ?? {},
        },
        input.quantity
      );

      const clientId = crypto.randomUUID();
      await enqueue("nutrition_logs", "upsert", {
        id: clientId,
        client_id: clientId,
        user_id: userData.user.id,
        log_date: input.logDate,
        meal: input.meal,
        food_id: input.food.id,
        description: input.food.brand ? `${input.food.name} (${input.food.brand})` : input.food.name,
        quantity: input.quantity,
        calories: scaled.calories,
        protein_g: scaled.proteinG,
        carbs_g: scaled.carbsG,
        fat_g: scaled.fatG,
        fiber_g: scaled.fiberG,
        micros: scaled.micros,
      });

      return clientId;
    },
    onSuccess: (_data, input) => qc.invalidateQueries({ queryKey: ["nutrition-log", input.logDate] }),
  });
}

export function useDeleteNutritionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, logDate }: { id: string; logDate: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from("nutrition_logs").delete().eq("id", id);
      if (error) throw error;
      return logDate;
    },
    onSuccess: (logDate) => qc.invalidateQueries({ queryKey: ["nutrition-log", logDate] }),
  });
}

export function useDailyLog(logDate: string) {
  return useQuery({
    queryKey: ["nutrition-log", logDate],
    queryFn: async (): Promise<NutritionLog[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("nutrition_logs")
        .select("*")
        .eq("log_date", logDate)
        .order("logged_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useDailyTotals(logDate: string): { data: DailyTotals | undefined; isLoading: boolean } {
  const { data: logs, isLoading } = useDailyLog(logDate);
  if (!logs) return { data: undefined, isLoading };
  return {
    data: sumDailyTotals(
      logs.map((l) => ({
        calories: l.calories,
        proteinG: l.protein_g,
        carbsG: l.carbs_g,
        fatG: l.fat_g,
        fiberG: l.fiber_g,
        micros: (l.micros as Record<string, number>) ?? {},
      }))
    ),
    isLoading,
  };
}

export interface NutritionTargets {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export function useNutritionTargets() {
  return useQuery({
    queryKey: ["profile", "nutrition-targets"],
    queryFn: async (): Promise<NutritionTargets> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("profiles")
        .select("target_calories, target_protein_g, target_carbs_g, target_fat_g")
        .eq("user_id", userData.user.id)
        .single();
      if (error) throw error;

      return {
        calories: data.target_calories,
        proteinG: data.target_protein_g,
        carbsG: data.target_carbs_g,
        fatG: data.target_fat_g,
      };
    },
  });
}

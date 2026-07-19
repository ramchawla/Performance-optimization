import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type Food = Database["public"]["Tables"]["foods"]["Row"];

/**
 * Tier 1 of the three-tier search (TECHNICAL-DESIGN §5): own + shared foods,
 * ranked by how often the current user has logged them. This is the whole
 * low-friction bet — USDA (tier 2) is a discovery fallback, not the common path.
 */
export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: ["foods", "search", query],
    queryFn: async (): Promise<Food[]> => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      let q = supabase.from("foods").select("*").order("name").limit(50);
      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
      const { data: foods, error } = await q;
      if (error) throw error;

      if (!userData.user) return foods;

      const { data: freq, error: freqErr } = await supabase
        .from("nutrition_logs")
        .select("food_id")
        .eq("user_id", userData.user.id)
        .not("food_id", "is", null)
        .order("logged_at", { ascending: false })
        .limit(200);
      if (freqErr) throw freqErr;

      const counts = new Map<string, number>();
      for (const row of freq) {
        if (!row.food_id) continue;
        counts.set(row.food_id, (counts.get(row.food_id) ?? 0) + 1);
      }
      return [...foods].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
    },
  });
}

/** Most recently logged distinct foods — the fast path for repeat meals. */
export function useRecentFoods(limit = 10) {
  return useQuery({
    queryKey: ["foods", "recent", limit],
    queryFn: async (): Promise<Food[]> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data: logs, error } = await supabase
        .from("nutrition_logs")
        .select("food_id, logged_at")
        .eq("user_id", userData.user.id)
        .not("food_id", "is", null)
        .order("logged_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const orderedIds: string[] = [];
      for (const row of logs) {
        if (row.food_id && !orderedIds.includes(row.food_id)) orderedIds.push(row.food_id);
        if (orderedIds.length >= limit) break;
      }
      if (orderedIds.length === 0) return [];

      const { data: foods, error: foodsErr } = await supabase
        .from("foods")
        .select("*")
        .in("id", orderedIds);
      if (foodsErr) throw foodsErr;

      const byId = new Map(foods.map((f) => [f.id, f]));
      return orderedIds.map((id) => byId.get(id)).filter((f): f is Food => f !== undefined);
    },
  });
}

export interface CreateFoodInput {
  name: string;
  brand?: string | null;
  servingDesc: string;
  servingGrams?: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  micros?: Record<string, number>;
}

export function useCreateFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFoodInput): Promise<Food> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("foods")
        .insert({
          user_id: userData.user.id,
          source: "custom",
          name: input.name,
          brand: input.brand ?? null,
          serving_desc: input.servingDesc,
          serving_grams: input.servingGrams ?? null,
          calories: input.calories,
          protein_g: input.proteinG,
          carbs_g: input.carbsG,
          fat_g: input.fatG,
          fiber_g: input.fiberG ?? null,
          micros: input.micros ?? {},
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foods"] }),
  });
}

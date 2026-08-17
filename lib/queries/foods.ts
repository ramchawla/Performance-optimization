import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type Food = Database["public"]["Tables"]["foods"]["Row"];

/** Shape returned by the food-search edge function (USDA FoodData Central proxy). */
const UsdaFoodSchema = z.object({
  external_id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  serving_desc: z.string(),
  serving_grams: z.number().nullable(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().nullable(),
  micros: z.record(z.string(), z.number()),
});
const UsdaSearchResponseSchema = z.object({ results: z.array(UsdaFoodSchema) });

export type UsdaFood = z.infer<typeof UsdaFoodSchema>;

/**
 * One row in the picker. `local` set = already in the foods table and loggable
 * as-is; `usda` set = a remote hit that has to be imported before it can be
 * referenced by a nutrition_log (see useImportFood).
 */
export interface FoodResult {
  key: string;
  name: string;
  brand: string | null;
  servingDesc: string;
  calories: number;
  local: Food | null;
  usda: UsdaFood | null;
}

function toResult(food: Food): FoodResult {
  return {
    key: food.id,
    name: food.name,
    brand: food.brand,
    servingDesc: food.serving_desc,
    calories: food.calories,
    local: food,
    usda: null,
  };
}

/** Both USDA data sets in parallel: whole foods (Foundation/SR Legacy) + packaged (Branded). */
async function searchUsda(query: string, accessToken: string): Promise<UsdaFood[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  async function call(branded: boolean): Promise<UsdaFood[]> {
    const url = `${base}/functions/v1/food-search?q=${encodeURIComponent(query)}${branded ? "&branded=1" : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey },
    });
    if (!res.ok) throw new Error(`USDA search failed (${res.status})`);
    return UsdaSearchResponseSchema.parse(await res.json()).results;
  }

  const [whole, branded] = await Promise.all([call(false), call(true)]);
  return [...whole, ...branded];
}

/**
 * Tiers 1+2 of the three-tier search (TECHNICAL-DESIGN §5). Tier 1 is own +
 * shared foods ranked by how often they've been logged — the low-friction
 * common path. Tier 2 (USDA) is the discovery fallback for anything not
 * cached yet, and only fires once the query is specific enough to be worth a
 * round trip.
 *
 * A tier-2 failure is reported as `usdaError` rather than thrown: local
 * results are still useful on their own, but the failure must not be silent
 * (CLAUDE.md rule 7).
 */
export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: ["foods", "search", query],
    queryFn: async (): Promise<{ results: FoodResult[]; usdaError: string | null }> => {
      const supabase = createClient();
      const trimmed = query.trim();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      let q = supabase.from("foods").select("*").order("name").limit(50);
      if (trimmed) q = q.ilike("name", `%${trimmed}%`);
      const { data: foods, error } = await q;
      if (error) throw error;

      let local = foods;
      if (user) {
        const { data: freq, error: freqErr } = await supabase
          .from("nutrition_logs")
          .select("food_id")
          .eq("user_id", user.id)
          .not("food_id", "is", null)
          .order("logged_at", { ascending: false })
          .limit(200);
        if (freqErr) throw freqErr;

        const counts = new Map<string, number>();
        for (const row of freq) {
          if (!row.food_id) continue;
          counts.set(row.food_id, (counts.get(row.food_id) ?? 0) + 1);
        }
        local = [...foods].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
      }

      const results = local.map(toResult);
      const token = sessionData.session?.access_token;
      if (trimmed.length < 2 || !token) return { results, usdaError: null };

      // Anything already cached locally wins — don't offer to re-import it.
      const cachedExternalIds = new Set(
        local.filter((f) => f.source === "usda" && f.external_id).map((f) => f.external_id!)
      );

      try {
        const usda = await searchUsda(trimmed, token);
        const seen = new Set(cachedExternalIds);
        for (const item of usda) {
          if (seen.has(item.external_id)) continue;
          seen.add(item.external_id);
          results.push({
            key: `usda:${item.external_id}`,
            name: item.name,
            brand: item.brand,
            servingDesc: item.serving_desc,
            calories: item.calories,
            local: null,
            usda: item,
          });
        }
        return { results, usdaError: null };
      } catch (err) {
        return { results, usdaError: err instanceof Error ? err.message : "USDA search failed" };
      }
    },
  });
}

/**
 * Persist a USDA search hit into `foods` so a nutrition_log can reference it.
 * RLS only permits inserting rows you own (`insert own foods`, 0001_init.sql:416),
 * so these are per-user cache rows, not the shared `user_id is null` kind.
 */
export function useImportFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: UsdaFood): Promise<Food> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("foods")
        .upsert(
          {
            user_id: userData.user.id,
            source: "usda",
            external_id: item.external_id,
            name: item.name,
            brand: item.brand,
            serving_desc: item.serving_desc,
            serving_grams: item.serving_grams,
            calories: item.calories,
            protein_g: item.protein_g,
            carbs_g: item.carbs_g,
            fat_g: item.fat_g,
            fiber_g: item.fiber_g,
            micros: item.micros,
          },
          { onConflict: "source,external_id,user_id" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foods"] }),
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { enqueue } from "@/lib/sync/outbox";
import { scaleServing, sumDailyTotals } from "@/lib/calc/nutritionTotals";
import type { Food } from "@/lib/queries/foods";
import type { Database } from "@/lib/database.types";

type Recipe = Database["public"]["Tables"]["recipes"]["Row"];
type MealType = Database["public"]["Enums"]["meal_type"];

export interface RecipeWithItems extends Recipe {
  items: Array<{ id: string; quantity: number; food: Food }>;
}

export function useRecipes() {
  return useQuery({
    queryKey: ["recipes"],
    queryFn: async (): Promise<RecipeWithItems[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recipes")
        .select("*, recipe_items(id, quantity, foods(*))")
        .order("name");
      if (error) throw error;

      type Joined = Recipe & { recipe_items: Array<{ id: string; quantity: number; foods: Food }> };
      return (data as unknown as Joined[]).map((r) => ({
        ...r,
        items: r.recipe_items.map((i) => ({ id: i.id, quantity: i.quantity, food: i.foods })),
      }));
    },
  });
}

export interface CreateRecipeInput {
  name: string;
  servings: number;
  items: Array<{ foodId: string; quantity: number }>;
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRecipeInput) => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data: recipe, error } = await supabase
        .from("recipes")
        .insert({ user_id: userData.user.id, name: input.name, servings: input.servings })
        .select("*")
        .single();
      if (error) throw error;

      const { error: itemsErr } = await supabase
        .from("recipe_items")
        .insert(input.items.map((i) => ({ recipe_id: recipe.id, food_id: i.foodId, quantity: i.quantity })));
      if (itemsErr) throw itemsErr;

      return recipe;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

/** Logs `portions` servings of a recipe — totals snapshotted the same way a single food is (CLAUDE.md rule 2). */
export function useLogRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipe, portions, meal, logDate }: { recipe: RecipeWithItems; portions: number; meal: MealType; logDate: string }) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      const recipeTotal = sumDailyTotals(
        recipe.items.map((i) =>
          scaleServing(
            {
              calories: i.food.calories,
              proteinG: i.food.protein_g,
              carbsG: i.food.carbs_g,
              fatG: i.food.fat_g,
              fiberG: i.food.fiber_g,
              micros: (i.food.micros as Record<string, number>) ?? {},
            },
            i.quantity
          )
        )
      );
      const perServing = scaleServing(
        { ...recipeTotal, calories: recipeTotal.calories, proteinG: recipeTotal.proteinG, carbsG: recipeTotal.carbsG, fatG: recipeTotal.fatG, fiberG: recipeTotal.fiberG, micros: recipeTotal.micros },
        1 / recipe.servings
      );
      const scaled = scaleServing(perServing, portions);

      const clientId = crypto.randomUUID();
      await enqueue("nutrition_logs", "upsert", {
        id: clientId,
        client_id: clientId,
        user_id: userData.user.id,
        log_date: logDate,
        meal,
        recipe_id: recipe.id,
        description: `${recipe.name} (${portions} serving${portions === 1 ? "" : "s"})`,
        quantity: portions,
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

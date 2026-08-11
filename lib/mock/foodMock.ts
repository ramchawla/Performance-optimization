/**
 * Preview-only mock data for the Food tab (log/search/recipes). Lets these
 * pages render fully populated without a signed-in account or logged
 * history — same reasoning as lib/mock/dashboardMock.ts.
 * ponytail: swap for useDailyLog/useDailyTotals/useNutritionTargets/useFoods/
 * useRecipes once there's real seed data (or a real logged-in account) to
 * query against.
 */

import { scaleServing } from "@/lib/calc/nutritionTotals";
import type { NutritionTargets } from "@/lib/queries/nutrition";
import type { Food } from "@/lib/queries/foods";
import type { RecipeWithItems } from "@/lib/queries/recipes";
import type { Database } from "@/lib/database.types";

type NutritionLog = Database["public"]["Tables"]["nutrition_logs"]["Row"];
type MealType = Database["public"]["Enums"]["meal_type"];

const LOG_DATE = "2026-08-08";
const USER_ID = "mock-user";

function food(partial: Omit<Food, "created_at" | "external_id" | "source" | "user_id" | "serving_grams" | "fiber_g" | "micros"> & {
  servingGrams?: number | null;
  fiberG?: number | null;
  micros?: Record<string, number>;
}): Food {
  return {
    id: partial.id,
    name: partial.name,
    brand: partial.brand,
    calories: partial.calories,
    protein_g: partial.protein_g,
    carbs_g: partial.carbs_g,
    fat_g: partial.fat_g,
    fiber_g: partial.fiberG ?? null,
    serving_desc: partial.serving_desc,
    serving_grams: partial.servingGrams ?? null,
    micros: partial.micros ?? {},
    source: "custom",
    external_id: null,
    user_id: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

export const MOCK_FOODS: Food[] = [
  food({ id: "f-chicken-breast", name: "Chicken breast, grilled", brand: null, serving_desc: "170g cooked", servingGrams: 170, calories: 280, protein_g: 53, carbs_g: 0, fat_g: 6 }),
  food({ id: "f-greek-yogurt", name: "Greek yogurt, 2%", brand: "Fage", serving_desc: "3/4 cup", servingGrams: 170, calories: 150, protein_g: 20, carbs_g: 6, fat_g: 4, micros: { calcium_mg: 220, b12_mcg: 1.1 } }),
  food({ id: "f-banana", name: "Banana", brand: null, serving_desc: "1 medium", servingGrams: 118, calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiberG: 3.1 }),
  food({ id: "f-oats", name: "Rolled oats", brand: "Quaker", serving_desc: "1/2 cup dry", servingGrams: 40, calories: 150, protein_g: 5, carbs_g: 27, fat_g: 3, fiberG: 4, micros: { iron_mg: 1.7 } }),
  food({ id: "f-almond-butter", name: "Almond butter", brand: "Justin's", serving_desc: "2 tbsp", servingGrams: 32, calories: 190, protein_g: 7, carbs_g: 7, fat_g: 17, micros: { zinc_mg: 1 } }),
  food({ id: "f-brown-rice", name: "Brown rice, cooked", brand: null, serving_desc: "1 cup", servingGrams: 195, calories: 216, protein_g: 5, carbs_g: 45, fat_g: 1.8, fiberG: 3.5 }),
  food({ id: "f-broccoli", name: "Broccoli, steamed", brand: null, serving_desc: "1 cup", servingGrams: 156, calories: 55, protein_g: 3.7, carbs_g: 11, fat_g: 0.6, fiberG: 5, micros: { folate_mcg: 57 } }),
  food({ id: "f-salmon", name: "Salmon, baked", brand: null, serving_desc: "6 oz", servingGrams: 170, calories: 367, protein_g: 40, carbs_g: 0, fat_g: 22, micros: { vit_d_mcg: 14.2, b12_mcg: 2.6 } }),
  food({ id: "f-whey", name: "Whey protein, Gold Standard", brand: "Optimum Nutrition", serving_desc: "1 scoop", servingGrams: 31, calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1, micros: { calcium_mg: 130 } }),
  food({ id: "f-eggs", name: "Eggs, large", brand: null, serving_desc: "2 eggs", servingGrams: 100, calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10, micros: { b12_mcg: 0.6, vit_d_mcg: 1.1 } }),
  food({ id: "f-avocado", name: "Avocado", brand: null, serving_desc: "1/2 medium", servingGrams: 68, calories: 120, protein_g: 1.5, carbs_g: 6, fat_g: 11, fiberG: 5 }),
  food({ id: "f-sweet-potato", name: "Sweet potato, baked", brand: null, serving_desc: "1 medium", servingGrams: 150, calories: 130, protein_g: 2.3, carbs_g: 30, fat_g: 0.2, fiberG: 4 }),
  food({ id: "f-ground-beef", name: "Ground beef, 90/10", brand: null, serving_desc: "4 oz cooked", servingGrams: 113, calories: 215, protein_g: 24, carbs_g: 0, fat_g: 13 }),
  food({ id: "f-bread", name: "Whole wheat bread", brand: "Dave's Killer Bread", serving_desc: "1 slice", servingGrams: 45, calories: 110, protein_g: 5, carbs_g: 22, fat_g: 1.5, fiberG: 5 }),
  food({ id: "f-peanut-butter", name: "Peanut butter, natural", brand: "Jif", serving_desc: "2 tbsp", servingGrams: 32, calories: 190, protein_g: 8, carbs_g: 7, fat_g: 16 }),
  food({ id: "f-blueberries", name: "Blueberries", brand: null, serving_desc: "1 cup", servingGrams: 148, calories: 84, protein_g: 1.1, carbs_g: 21, fat_g: 0.5, fiberG: 3.6 }),
  food({ id: "f-cottage-cheese", name: "Cottage cheese", brand: "Good Culture", serving_desc: "1 cup", servingGrams: 226, calories: 220, protein_g: 25, carbs_g: 9, fat_g: 8, micros: { calcium_mg: 138 } }),
  food({ id: "f-protein-bar", name: "Protein bar", brand: "Quest", serving_desc: "1 bar", servingGrams: 60, calories: 190, protein_g: 21, carbs_g: 22, fat_g: 8, fiberG: 13 }),
  food({ id: "f-olive-oil", name: "Olive oil", brand: null, serving_desc: "1 tbsp", servingGrams: 14, calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5 }),
  food({ id: "f-spinach", name: "Spinach, raw", brand: null, serving_desc: "2 cups", servingGrams: 60, calories: 14, protein_g: 1.7, carbs_g: 2.2, fat_g: 0.2, fiberG: 1.4, micros: { iron_mg: 1.5, folate_mcg: 120 } }),
];

const byId = new Map(MOCK_FOODS.map((f) => [f.id, f]));
function f(id: string): Food {
  const found = byId.get(id);
  if (!found) throw new Error(`mock food ${id} missing`);
  return found;
}

function entry(id: string, meal: MealType, time: string, foodId: string, quantity: number): NutritionLog {
  const foodItem = f(foodId);
  const scaled = scaleServing(
    { calories: foodItem.calories, proteinG: foodItem.protein_g, carbsG: foodItem.carbs_g, fatG: foodItem.fat_g, fiberG: foodItem.fiber_g, micros: (foodItem.micros as Record<string, number>) ?? {} },
    quantity
  );
  return {
    id,
    client_id: id,
    user_id: USER_ID,
    log_date: LOG_DATE,
    logged_at: `${LOG_DATE}T${time}:00Z`,
    meal,
    food_id: foodItem.id,
    recipe_id: null,
    description: foodItem.brand ? `${foodItem.name} (${foodItem.brand})` : foodItem.name,
    quantity,
    calories: Math.round(scaled.calories),
    protein_g: Math.round(scaled.proteinG),
    carbs_g: Math.round(scaled.carbsG),
    fat_g: Math.round(scaled.fatG),
    fiber_g: scaled.fiberG !== null ? Math.round(scaled.fiberG * 10) / 10 : null,
    micros: scaled.micros,
    source: "manual",
    updated_at: `${LOG_DATE}T${time}:00Z`,
  };
}

export const MOCK_LOG_ENTRIES: NutritionLog[] = [
  entry("log-01", "breakfast", "07:35", "f-oats", 1),
  entry("log-02", "breakfast", "07:35", "f-greek-yogurt", 1),
  entry("log-03", "breakfast", "07:35", "f-banana", 1),
  entry("log-04", "lunch", "12:20", "f-chicken-breast", 1.5),
  entry("log-05", "lunch", "12:20", "f-brown-rice", 1),
  entry("log-06", "lunch", "12:20", "f-broccoli", 1),
  entry("log-07", "pre_workout", "16:45", "f-bread", 1),
  entry("log-08", "pre_workout", "16:45", "f-peanut-butter", 1),
  entry("log-09", "post_workout", "18:10", "f-whey", 1),
  entry("log-10", "post_workout", "18:10", "f-cottage-cheese", 0.5),
  entry("log-11", "dinner", "19:30", "f-salmon", 1),
  entry("log-12", "dinner", "19:30", "f-sweet-potato", 1),
  entry("log-13", "dinner", "19:30", "f-avocado", 0.5),
  entry("log-14", "snack", "21:00", "f-protein-bar", 1),
];

export const MOCK_NUTRITION_TARGETS: NutritionTargets = {
  calories: 2400,
  proteinG: 180,
  carbsG: 240,
  fatG: 80,
};

function recipe(
  id: string,
  name: string,
  servings: number,
  items: Array<{ foodId: string; quantity: number }>
): RecipeWithItems {
  return {
    id,
    name,
    notes: null,
    servings,
    user_id: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    items: items.map((it, i) => ({ id: `${id}-item-${i}`, quantity: it.quantity, food: f(it.foodId) })),
  };
}

export const MOCK_RECIPES: RecipeWithItems[] = [
  recipe("r-post-workout-shake", "Post-workout shake", 1, [
    { foodId: "f-whey", quantity: 1 },
    { foodId: "f-banana", quantity: 1 },
    { foodId: "f-almond-butter", quantity: 0.5 },
  ]),
  recipe("r-chicken-rice-bowl", "Chicken rice bowl", 2, [
    { foodId: "f-chicken-breast", quantity: 2 },
    { foodId: "f-brown-rice", quantity: 2 },
    { foodId: "f-broccoli", quantity: 2 },
    { foodId: "f-olive-oil", quantity: 1 },
  ]),
  recipe("r-overnight-oats", "Overnight oats", 1, [
    { foodId: "f-oats", quantity: 1 },
    { foodId: "f-greek-yogurt", quantity: 1 },
    { foodId: "f-blueberries", quantity: 1 },
  ]),
];

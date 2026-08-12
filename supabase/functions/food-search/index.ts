// Supabase Edge Function: food-search
// Proxies USDA FoodData Central so USDA_API_KEY stays server-side.
// Implements tier 2 of the three-tier search strategy in TECHNICAL-DESIGN.md §5.
// Tier 1 (own/frequent foods) and tier 3 (Open Food Facts barcodes, P1) are
// handled elsewhere — this function is USDA search only.
//
// GET /food-search?q=<query>&branded=1
//   - default: dataType=Foundation,SR Legacy (whole foods)
//   - branded=1: dataType=Branded (packaged foods)
// Returns: { results: NormalizedFood[] }

import { z } from "npm:zod@^4";

const USDA_NUTRIENT_NUMBERS = {
  calories: "208",
  protein_g: "203",
  fat_g: "204",
  carbs_g: "205",
  fiber_g: "291",
  b12_mcg: "418",
  iron_mg: "303",
  calcium_mg: "301",
  vit_d_mcg: "328",
  zinc_mg: "309",
  folate_mcg: "417",
} as const;

// Permissive — USDA's shape has many optional/varying fields we don't use.
const UsdaFoodNutrientSchema = z.object({
  nutrientNumber: z.string().optional(),
  value: z.number().optional(),
}).passthrough();

const UsdaFoodSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  brandOwner: z.string().optional(),
  brandName: z.string().optional(),
  servingSize: z.number().optional(),
  servingSizeUnit: z.string().optional(),
  foodNutrients: z.array(UsdaFoodNutrientSchema).default([]),
}).passthrough();

const UsdaSearchResponseSchema = z.object({
  foods: z.array(UsdaFoodSchema).default([]),
}).passthrough();

const NormalizedFoodSchema = z.object({
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

type NormalizedFood = z.infer<typeof NormalizedFoodSchema>;

function nutrientValue(
  nutrients: z.infer<typeof UsdaFoodNutrientSchema>[],
  number: string
): number | undefined {
  return nutrients.find((n) => n.nutrientNumber === number)?.value;
}

// USDA's /search foodNutrients values are per 100g regardless of dataType.
// Scale to the item's serving size when known (Branded items usually have
// one); default to a 100g serving otherwise (Foundation/SR Legacy).
function normalize(food: z.infer<typeof UsdaFoodSchema>): NormalizedFood | null {
  const per100 = {
    calories: nutrientValue(food.foodNutrients, USDA_NUTRIENT_NUMBERS.calories),
    protein_g: nutrientValue(food.foodNutrients, USDA_NUTRIENT_NUMBERS.protein_g),
    fat_g: nutrientValue(food.foodNutrients, USDA_NUTRIENT_NUMBERS.fat_g),
    carbs_g: nutrientValue(food.foodNutrients, USDA_NUTRIENT_NUMBERS.carbs_g),
  };
  // Skip items USDA has no usable macro data for — a search hit we can't log.
  if (
    per100.calories === undefined ||
    per100.protein_g === undefined ||
    per100.fat_g === undefined ||
    per100.carbs_g === undefined
  ) {
    return null;
  }

  const servingGrams = food.servingSize && food.servingSizeUnit?.toLowerCase() === "g"
    ? food.servingSize
    : 100;
  const scale = servingGrams / 100;

  const fiberPer100 = nutrientValue(food.foodNutrients, USDA_NUTRIENT_NUMBERS.fiber_g);

  const micros: Record<string, number> = {};
  for (const key of ["b12_mcg", "iron_mg", "calcium_mg", "vit_d_mcg", "zinc_mg", "folate_mcg"] as const) {
    const v = nutrientValue(food.foodNutrients, USDA_NUTRIENT_NUMBERS[key]);
    if (v !== undefined) micros[key] = Math.round(v * scale * 100) / 100;
  }

  return {
    external_id: String(food.fdcId),
    name: food.description,
    brand: food.brandOwner ?? food.brandName ?? null,
    serving_desc: servingGrams === 100 ? "100 g" : `${servingGrams} g serving`,
    serving_grams: servingGrams,
    calories: Math.round(per100.calories * scale * 10) / 10,
    protein_g: Math.round(per100.protein_g * scale * 10) / 10,
    carbs_g: Math.round(per100.carbs_g * scale * 10) / 10,
    fat_g: Math.round(per100.fat_g * scale * 10) / 10,
    fiber_g: fiberPer100 !== undefined ? Math.round(fiberPer100 * scale * 10) / 10 : null,
    micros,
  };
}

Deno.serve(async (req: Request) => {
  const apiKey = Deno.env.get("USDA_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "USDA_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    return new Response(JSON.stringify({ error: "missing q param" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const branded = url.searchParams.get("branded") === "1";
  const dataType = branded ? "Branded" : "Foundation,SR Legacy";

  const usdaUrl = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  usdaUrl.searchParams.set("api_key", apiKey);
  usdaUrl.searchParams.set("query", query);
  usdaUrl.searchParams.set("dataType", dataType);
  usdaUrl.searchParams.set("pageSize", "25");

  const usdaRes = await fetch(usdaUrl);
  if (!usdaRes.ok) {
    return new Response(JSON.stringify({ error: "USDA lookup failed", status: usdaRes.status }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = UsdaSearchResponseSchema.safeParse(await usdaRes.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "unexpected USDA response shape" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = parsed.data.foods
    .map(normalize)
    .filter((f): f is NormalizedFood => f !== null)
    .map((f) => NormalizedFoodSchema.parse(f));

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

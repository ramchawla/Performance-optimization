"use client";

import { useState } from "react";
import { useCreateRecipe, useLogRecipe, useRecipes, type RecipeWithItems } from "@/lib/queries/recipes";
import { FoodPicker } from "@/components/food/FoodPicker";
import type { Food } from "@/lib/queries/foods";
import type { Database } from "@/lib/database.types";

type MealType = Database["public"]["Enums"]["meal_type"];
const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function RecipeBuilder({ onDone }: { onDone: () => void }) {
  const createRecipe = useCreateRecipe();
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [items, setItems] = useState<Array<{ food: Food; quantity: number }>>([]);
  const [picking, setPicking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    await createRecipe.mutateAsync({
      name,
      servings: Number(servings) || 1,
      items: items.map((i) => ({ foodId: i.food.id, quantity: i.quantity })),
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded border border-neutral-300 p-3">
      <p className="text-xs font-medium text-neutral-500">New recipe</p>
      <input required placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      <label className="flex items-center gap-2 text-sm">
        Servings
        <input type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)}
          className="w-16 rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={item.food.id} className="flex items-center justify-between text-sm">
            <span>{item.food.name}</span>
            <span className="flex items-center gap-2">
              <input type="number" step="0.25" min="0.25" value={item.quantity}
                onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) || 1 } : it))}
                aria-label={`Quantity of ${item.food.name}`}
                className="w-16 rounded border border-neutral-300 px-2 py-1 text-xs" />
              <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${item.food.name}`} className="text-xs text-neutral-400 hover:text-red-600">✕</button>
            </span>
          </li>
        ))}
      </ul>

      {picking ? (
        <FoodPicker onSelect={(food) => { setItems((prev) => [...prev, { food, quantity: 1 }]); setPicking(false); }} />
      ) : (
        <button type="button" onClick={() => setPicking(true)} className="text-xs text-blue-600 underline">+ Add ingredient</button>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={createRecipe.isPending || items.length === 0}
          className="flex-1 rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {createRecipe.isPending ? "Saving…" : "Save recipe"}
        </button>
        <button type="button" onClick={onDone} className="rounded border border-neutral-300 px-3 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function LogRecipeRow({ recipe }: { recipe: RecipeWithItems }) {
  const logRecipe = useLogRecipe();
  const [portions, setPortions] = useState("1");
  const [meal, setMeal] = useState<MealType>("dinner");
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded border border-neutral-200 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{recipe.name}</p>
          <p className="text-xs text-neutral-400">{recipe.servings} servings · {recipe.items.length} ingredients</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-xs text-blue-600 underline">
          {open ? "Close" : "Log"}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex items-center gap-2">
          <input type="number" step="0.5" min="0.5" value={portions} onChange={(e) => setPortions(e.target.value)}
            aria-label="Portions" className="w-16 rounded border border-neutral-300 px-2 py-1.5 text-sm" />
          <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} aria-label="Meal"
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm">
            {MEALS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
          </select>
          <button
            onClick={() => logRecipe.mutate({ recipe, portions: Number(portions) || 1, meal, logDate: todayLocal() }, { onSuccess: () => setOpen(false) })}
            disabled={logRecipe.isPending}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {logRecipe.isPending ? "Logging…" : "Log to today"}
          </button>
        </div>
      )}
    </li>
  );
}

export default function RecipesPage() {
  const { data: recipes } = useRecipes();
  const [building, setBuilding] = useState(false);

  return (
    <main className="p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Recipes</h1>
        {!building && (
          <button onClick={() => setBuilding(true)} className="text-xs text-blue-600 underline">+ New recipe</button>
        )}
      </div>

      {building && (
        <div className="mt-3">
          <RecipeBuilder onDone={() => setBuilding(false)} />
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {recipes?.map((r) => <LogRecipeRow key={r.id} recipe={r} />)}
        {recipes?.length === 0 && !building && (
          <li className="text-xs text-neutral-400">No recipes yet. Batch meal-prep? Save it once, log it every day.</li>
        )}
      </ul>
    </main>
  );
}

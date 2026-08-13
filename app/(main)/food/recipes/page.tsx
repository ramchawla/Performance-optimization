"use client";

import { useState } from "react";
import { useCreateRecipe, useLogRecipe, useRecipes, type RecipeWithItems } from "@/lib/queries/recipes";
import { FoodPicker } from "@/components/food/FoodPicker";
import { FoodSubnav } from "@/components/food/FoodSubnav";
import type { Food } from "@/lib/queries/foods";
import type { Database } from "@/lib/database.types";

type MealType = Database["public"]["Enums"]["meal_type"];
const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

const inputCls =
  "rounded-xl border border-surface-raised bg-bg px-2 py-1.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none";

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
    <form onSubmit={handleSubmit} className="animate-enter space-y-2 rounded-2xl border border-surface-raised bg-surface p-3">
      <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">New recipe</p>
      <input required placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)}
        className={`w-full ${inputCls}`} />
      <label className="flex items-center gap-2 text-sm text-fg">
        Servings
        <input type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)}
          className={`w-16 ${inputCls}`} />
      </label>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={item.food.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg/60 px-2.5 py-1.5 text-sm text-fg">
              <span className="truncate">{item.food.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <input type="number" step="0.25" min="0.25" value={item.quantity}
                  onChange={(e) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) || 1 } : it))}
                  aria-label={`Quantity of ${item.food.name}`}
                  className={`w-16 ${inputCls} py-1 text-xs`} />
                <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove ${item.food.name}`}
                  className="min-h-11 min-w-11 rounded-xl text-xs text-muted transition-colors duration-200 hover:text-red-400 active:scale-[0.98]">
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {picking ? (
        <FoodPicker onSelect={(food) => { setItems((prev) => [...prev, { food, quantity: 1 }]); setPicking(false); }} />
      ) : (
        <button type="button" onClick={() => setPicking(true)}
          className="text-xs font-medium text-accent transition-colors duration-200 hover:text-fg">
          + Add ingredient
        </button>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={createRecipe.isPending || items.length === 0}
          className="flex-1 min-h-11 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50">
          {createRecipe.isPending ? "Saving…" : "Save recipe"}
        </button>
        <button type="button" onClick={onDone}
          className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]">
          Cancel
        </button>
      </div>
    </form>
  );
}

function LogRecipeRow({ recipe }: { recipe: RecipeWithItems }) {
  const logRecipe = useLogRecipe();
  const [portions, setPortions] = useState("1");
  const [meal, setMeal] = useState<MealType>("dinner");
  const [open, setOpen] = useState(false);
  // Pop-confirm on a successful log — reuses .animate-spring-pop, same beat
  // as LogEntryForm's single-food flow.
  const [justLogged, setJustLogged] = useState(false);

  const totalKcal = recipe.items.reduce((sum, i) => sum + i.food.calories * i.quantity, 0) / recipe.servings;

  function handleLog() {
    logRecipe.mutate(
      { recipe, portions: Number(portions) || 1, meal, logDate: todayLocal() },
      {
        onSuccess: () => {
          setJustLogged(true);
          window.setTimeout(() => {
            setJustLogged(false);
            setOpen(false);
          }, 900);
        },
      }
    );
  }

  return (
    <li className="rounded-2xl border border-surface-raised bg-surface p-3 transition-colors duration-200 hover:border-accent/30">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-display text-sm font-bold text-accent">
          {recipe.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-fg">{recipe.name}</p>
          <p className="text-xs text-muted">{recipe.servings} servings · {recipe.items.length} ingredients</p>
        </div>
        <span className="shrink-0 font-display text-sm font-bold text-fg">{Math.round(totalKcal)}</span>
        <button onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-xs font-medium text-accent transition-colors duration-200 hover:text-fg">
          {open ? "Close" : "Log"}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex items-center gap-2">
          {justLogged ? (
            <span className="animate-spring-pop font-display text-sm font-bold text-accent">✓ Logged to today</span>
          ) : (
            <>
              <input type="number" step="0.5" min="0.5" value={portions} onChange={(e) => setPortions(e.target.value)}
                aria-label="Portions" className={`w-16 ${inputCls}`} />
              <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} aria-label="Meal"
                className={inputCls}>
                {MEALS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
              <button
                onClick={handleLog}
                disabled={logRecipe.isPending}
                className="min-h-11 rounded-xl bg-accent px-3 py-1.5 font-display text-xs font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50">
                {logRecipe.isPending ? "Logging…" : "Log to today"}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function RecipesPage() {
  const { data: recipes } = useRecipes();
  const [building, setBuilding] = useState(false);

  return (
    <main className="min-h-screen bg-bg p-4 pb-24">
      <FoodSubnav />
      <div className="mt-3 flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-fg">Recipes</h1>
        {!building && (
          <button onClick={() => setBuilding(true)}
            className="text-xs font-medium text-accent transition-colors duration-200 hover:text-fg">
            + New recipe
          </button>
        )}
      </div>

      {building && (
        <div className="mt-3">
          <RecipeBuilder onDone={() => setBuilding(false)} />
        </div>
      )}

      <ul className="stagger mt-4 space-y-2">
        {recipes?.map((r) => <LogRecipeRow key={r.id} recipe={r} />)}
        {recipes?.length === 0 && !building && (
          <li className="text-xs text-muted">No recipes yet. Batch meal-prep? Save it once, log it every day.</li>
        )}
      </ul>
    </main>
  );
}

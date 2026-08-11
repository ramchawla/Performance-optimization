"use client";

import { useState } from "react";
import { useLogFood } from "@/lib/queries/nutrition";
import type { Food } from "@/lib/queries/foods";
import type { Database } from "@/lib/database.types";

type MealType = Database["public"]["Enums"]["meal_type"];
const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];

export function LogEntryForm({
  food,
  logDate,
  defaultMeal,
  onLogged,
  onCancel,
}: {
  food: Food;
  logDate: string;
  defaultMeal: MealType;
  onLogged: () => void;
  onCancel: () => void;
}) {
  const logFood = useLogFood();
  const [quantity, setQuantity] = useState("1");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  // Pop-confirm before collapsing: reuses .animate-spring-pop (train-tab
  // motion) so a successful log gets the same delightful "logged" beat as a
  // completed set, then hands off to the parent's close/refresh.
  const [justLogged, setJustLogged] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await logFood.mutateAsync({ food, quantity: Number(quantity) || 1, meal, logDate });
    setJustLogged(true);
    window.setTimeout(onLogged, 650);
  }

  const qty = Number(quantity) || 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-surface-raised bg-surface p-3">
      <p className="font-display text-sm font-bold text-fg">{food.name}</p>
      <p className="font-mono text-xs text-muted">
        {Math.round(food.calories * qty)} kcal · {Math.round(food.protein_g * qty)}p /{" "}
        {Math.round(food.carbs_g * qty)}c / {Math.round(food.fat_g * qty)}f
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-fg">
          <input type="number" step="0.25" min="0.25" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            aria-label="Quantity" className="w-16 rounded-xl border border-surface-raised bg-bg px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none" />
          × {food.serving_desc}
        </label>
        <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} aria-label="Meal"
          className="rounded-xl border border-surface-raised bg-bg px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none">
          {MEALS.map((m) => (
            <option key={m} value={m}>{m.replace("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={logFood.isPending || justLogged}
          className={`flex-1 min-h-11 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50 ${
            justLogged ? "animate-spring-pop" : ""
          }`}>
          {justLogged ? "✓ Logged!" : logFood.isPending ? "Logging…" : "Log"}
        </button>
        <button type="button" onClick={onCancel} disabled={justLogged}
          className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98] disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

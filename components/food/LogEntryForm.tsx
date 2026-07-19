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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await logFood.mutateAsync({ food, quantity: Number(quantity) || 1, meal, logDate });
    onLogged();
  }

  const qty = Number(quantity) || 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded border border-neutral-300 p-3">
      <p className="text-sm font-medium">{food.name}</p>
      <p className="text-xs text-neutral-500">
        {Math.round(food.calories * qty)} kcal · {Math.round(food.protein_g * qty)}p /{" "}
        {Math.round(food.carbs_g * qty)}c / {Math.round(food.fat_g * qty)}f
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-sm">
          <input type="number" step="0.25" min="0.25" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            aria-label="Quantity" className="w-16 rounded border border-neutral-300 px-2 py-1.5 text-sm" />
          × {food.serving_desc}
        </label>
        <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} aria-label="Meal"
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm">
          {MEALS.map((m) => (
            <option key={m} value={m}>{m.replace("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={logFood.isPending}
          className="flex-1 rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {logFood.isPending ? "Logging…" : "Log"}
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-neutral-300 px-3 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

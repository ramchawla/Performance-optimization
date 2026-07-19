"use client";

import { useState } from "react";
import { useDailyLog, useDailyTotals, useDeleteNutritionLog, useNutritionTargets } from "@/lib/queries/nutrition";
import { FoodPicker } from "@/components/food/FoodPicker";
import { LogEntryForm } from "@/components/food/LogEntryForm";
import { CustomFoodForm } from "@/components/food/CustomFoodForm";
import { MacroSummary } from "@/components/food/MacroSummary";
import type { Food } from "@/lib/queries/foods";
import type { Database } from "@/lib/database.types";

type MealType = Database["public"]["Enums"]["meal_type"];
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export default function FoodLogPage() {
  const [logDate, setLogDate] = useState(todayLocal);
  const [picking, setPicking] = useState<{ meal: MealType } | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);

  const { data: entries } = useDailyLog(logDate);
  const { data: totals } = useDailyTotals(logDate);
  const { data: targets } = useNutritionTargets();
  const deleteLog = useDeleteNutritionLog();

  function closePicker() {
    setPicking(null);
    setSelectedFood(null);
    setCreatingCustom(false);
  }

  return (
    <main className="p-4 pb-24">
      <div className="flex items-center justify-between">
        <button onClick={() => setLogDate((d) => shiftDate(d, -1))} className="px-2 text-lg">‹</button>
        <h1 className="text-lg font-semibold">
          {logDate === todayLocal()
            ? "Today"
            : new Date(`${logDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </h1>
        <button onClick={() => setLogDate((d) => shiftDate(d, 1))} className="px-2 text-lg">›</button>
      </div>

      {totals && targets && (
        <div className="mt-3">
          <MacroSummary totals={totals} targets={targets} />
        </div>
      )}

      <div className="mt-4 space-y-4">
        {MEAL_ORDER.map((meal) => {
          const mealEntries = entries?.filter((e) => e.meal === meal) ?? [];
          if (mealEntries.length === 0 && picking?.meal !== meal) {
            return (
              <button key={meal} onClick={() => setPicking({ meal })}
                className="w-full rounded border border-dashed border-neutral-300 px-3 py-2 text-left text-xs text-neutral-400">
                + {meal.replace("_", " ")}
              </button>
            );
          }
          return (
            <section key={meal} className="rounded border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold capitalize">{meal.replace("_", " ")}</h2>
                <button onClick={() => setPicking({ meal })} className="text-xs text-blue-600 underline">+ Add</button>
              </div>
              <ul className="mt-2 space-y-1">
                {mealEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span>{e.description} <span className="text-xs text-neutral-400">×{e.quantity}</span></span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">{Math.round(e.calories)} kcal</span>
                      <button onClick={() => deleteLog.mutate({ id: e.id, logDate })} aria-label={`Remove ${e.description}`}
                        className="text-xs text-neutral-400 hover:text-red-600">✕</button>
                    </span>
                  </li>
                ))}
              </ul>
              {picking?.meal === meal && (
                <div className="mt-3 space-y-2">
                  {selectedFood ? (
                    <LogEntryForm food={selectedFood} logDate={logDate} defaultMeal={meal} onLogged={closePicker} onCancel={closePicker} />
                  ) : creatingCustom ? (
                    <CustomFoodForm onCreated={(food) => setSelectedFood(food)} />
                  ) : (
                    <>
                      <FoodPicker onSelect={setSelectedFood} />
                      <button onClick={() => setCreatingCustom(true)} className="text-xs text-blue-600 underline">
                        Can&apos;t find it — add custom food
                      </button>
                      <button onClick={closePicker} className="ml-3 text-xs text-neutral-400 underline">Cancel</button>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

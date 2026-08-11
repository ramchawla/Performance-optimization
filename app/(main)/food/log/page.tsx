"use client";

import { useEffect, useRef, useState } from "react";
import { FoodPicker } from "@/components/food/FoodPicker";
import { LogEntryForm } from "@/components/food/LogEntryForm";
import { CustomFoodForm } from "@/components/food/CustomFoodForm";
import { MacroSummary } from "@/components/food/MacroSummary";
import { FoodSubnav } from "@/components/food/FoodSubnav";
import { sumDailyTotals } from "@/lib/calc/nutritionTotals";
import { MOCK_FOODS, MOCK_LOG_ENTRIES, MOCK_NUTRITION_TARGETS } from "@/lib/mock/foodMock";
import type { Food } from "@/lib/queries/foods";
import type { Database } from "@/lib/database.types";

type MealType = Database["public"]["Enums"]["meal_type"];
type Entry = (typeof MOCK_LOG_ENTRIES)[number];

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];

// Per-meal icon monogram + tint — decorative identifiers only (kinetic
// mockup's per-meal dot colors), drawn from Tailwind's stock palette rather
// than raw hex so nothing off-brand leaks in; the primary UI signal color
// stays accent/accent-dim everywhere else.
const MEAL_META: Record<MealType, { label: string; abbr: string; subtitle: string; iconBg: string; iconText: string; kcalText: string }> = {
  breakfast: { label: "Breakfast", abbr: "AM", subtitle: "Not logged yet", iconBg: "bg-amber-400/15", iconText: "text-amber-400", kcalText: "text-amber-400" },
  lunch: { label: "Lunch", abbr: "L", subtitle: "Not logged yet", iconBg: "bg-pink-400/15", iconText: "text-pink-400", kcalText: "text-pink-400" },
  dinner: { label: "Dinner", abbr: "PM", subtitle: "Not logged yet", iconBg: "bg-fuchsia-400/15", iconText: "text-fuchsia-400", kcalText: "text-fuchsia-400" },
  snack: { label: "Snack", abbr: "SN", subtitle: "Not logged yet", iconBg: "bg-teal-400/15", iconText: "text-teal-400", kcalText: "text-teal-400" },
  pre_workout: { label: "Pre-Workout", abbr: "PRE", subtitle: "Fuel before you lift", iconBg: "bg-sky-400/15", iconText: "text-sky-400", kcalText: "text-sky-400" },
  post_workout: { label: "Post-Workout", abbr: "PST", subtitle: "Refuel window is open", iconBg: "bg-violet-400/15", iconText: "text-violet-400", kcalText: "text-violet-400" },
};

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

// ponytail: rendering mock foodMock data directly instead of useDailyLog/
// useDailyTotals/useNutritionTargets — same preview pass as the dashboard.
// Swap back to those hooks (plus useDeleteNutritionLog for real deletes) once
// there's real logged history to query. Deletes here only mutate local state.
export default function FoodLogPage() {
  const [logDate, setLogDate] = useState(todayLocal);
  const [picking, setPicking] = useState<{ meal: MealType } | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  // Reversible-delete affordance (the kinetic mockup's confirm+undo motif,
  // wired to a real reversible action rather than a fake "logged" toggle).
  const [undo, setUndo] = useState<{ id: string; description: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const baseEntries = logDate === todayLocal() ? MOCK_LOG_ENTRIES : [];
  const entries = baseEntries.filter((e) => !deletedIds.has(e.id));
  const totals = sumDailyTotals(
    entries.map((e) => ({
      calories: e.calories,
      proteinG: e.protein_g,
      carbsG: e.carbs_g,
      fatG: e.fat_g,
      fiberG: e.fiber_g,
      micros: (e.micros as Record<string, number>) ?? {},
    }))
  );
  const targets = MOCK_NUTRITION_TARGETS;

  function closePicker() {
    setPicking(null);
    setSelectedFood(null);
    setCreatingCustom(false);
  }

  function removeEntry(entry: Entry) {
    setDeletedIds((prev) => new Set(prev).add(entry.id));
    setUndo({ id: entry.id, description: entry.description });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4000);
  }

  function undoRemove() {
    if (!undo) return;
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(undo.id);
      return next;
    });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
  }

  return (
    <main className="min-h-screen bg-bg p-4 pb-24">
      <FoodSubnav />

      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setLogDate((d) => shiftDate(d, -1))} aria-label="Previous day"
          className="min-h-11 min-w-11 rounded-xl px-2 text-lg text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]">
          ‹
        </button>
        <h1 className="font-display text-lg font-bold text-fg">
          {logDate === todayLocal()
            ? "Today"
            : new Date(`${logDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </h1>
        <button onClick={() => setLogDate((d) => shiftDate(d, 1))} aria-label="Next day"
          className="min-h-11 min-w-11 rounded-xl px-2 text-lg text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]">
          ›
        </button>
      </div>

      {totals && targets && (
        <div className="mt-3">
          <MacroSummary totals={totals} targets={targets} />
        </div>
      )}

      <div className="stagger mt-4 space-y-3">
        {MEAL_ORDER.map((meal) => {
          const meta = MEAL_META[meal];
          const mealEntries = entries?.filter((e) => e.meal === meal) ?? [];
          const mealKcal = mealEntries.reduce((sum, e) => sum + e.calories, 0);

          if (mealEntries.length === 0 && picking?.meal !== meal) {
            return (
              <button key={meal} onClick={() => setPicking({ meal })}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-surface-raised bg-surface/40 p-3 text-left transition-colors duration-200 hover:border-accent/40 active:scale-[0.98]">
                <span className={`animate-food-bounce flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold ${meta.iconBg} ${meta.iconText}`}>
                  +
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold text-fg">{meta.label}</span>
                  <span className="block text-xs text-muted">{meta.subtitle}</span>
                </span>
                <span className="shrink-0 rounded-xl bg-accent px-3 py-1.5 font-display text-xs font-bold text-bg">
                  Log
                </span>
              </button>
            );
          }

          return (
            <section key={meal} className="rounded-2xl border border-surface-raised bg-surface p-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold ${meta.iconBg} ${meta.iconText}`}>
                  {meta.abbr}
                </span>
                <h2 className="min-w-0 flex-1 font-display text-sm font-bold text-fg">{meta.label}</h2>
                {mealKcal > 0 && <span className={`font-display text-sm font-bold ${meta.kcalText}`}>{Math.round(mealKcal)}</span>}
                <button onClick={() => setPicking({ meal })}
                  className="shrink-0 text-xs font-medium text-accent transition-colors duration-200 hover:text-fg">
                  + Add
                </button>
              </div>
              {mealEntries.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {mealEntries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between text-sm text-fg">
                      <span>{e.description} <span className="text-xs text-muted">×{e.quantity}</span></span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted">{Math.round(e.calories)} kcal</span>
                        <button onClick={() => removeEntry(e)} aria-label={`Remove ${e.description}`}
                          className="min-h-11 min-w-11 rounded-xl text-xs text-muted transition-colors duration-200 hover:text-red-400 active:scale-[0.98]">
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {picking?.meal === meal && (
                <div className="mt-3 space-y-2">
                  {selectedFood ? (
                    <LogEntryForm food={selectedFood} logDate={logDate} defaultMeal={meal} onLogged={closePicker} onCancel={closePicker} />
                  ) : creatingCustom ? (
                    <CustomFoodForm onCreated={(food) => setSelectedFood(food)} />
                  ) : (
                    <>
                      <FoodPicker onSelect={setSelectedFood} foods={MOCK_FOODS} />
                      <button onClick={() => setCreatingCustom(true)}
                        className="text-xs font-medium text-accent transition-colors duration-200 hover:text-fg">
                        Can&apos;t find it — add custom food
                      </button>
                      <button onClick={closePicker}
                        className="ml-3 text-xs font-medium text-muted transition-colors duration-200 hover:text-fg">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {undo && (
        <div className="animate-enter fixed bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-accent/30 bg-surface-raised px-4 py-2 shadow-[0_0_20px_-6px_var(--accent)]">
          <span className="text-xs text-fg">Removed {undo.description}</span>
          <button onClick={undoRemove} className="font-mono text-xs font-semibold text-accent underline underline-offset-2">
            Undo
          </button>
        </div>
      )}
    </main>
  );
}

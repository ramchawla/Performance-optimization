"use client";

import { useState } from "react";
import { FoodPicker } from "@/components/food/FoodPicker";
import { CustomFoodForm } from "@/components/food/CustomFoodForm";
import { MICRO_VOCAB, type MicroKey } from "@/lib/nutrition";
import type { Food } from "@/lib/queries/foods";

export default function FoodLibraryPage() {
  const [selected, setSelected] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <main className="p-4 pb-24">
      <h1 className="text-lg font-semibold">Food library</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Browse your saved foods, or add a new one ahead of logging it. To log a meal, use the day view in Log.
      </p>

      <div className="mt-4">
        {creating ? (
          <CustomFoodForm onCreated={(food) => { setSelected(food); setCreating(false); }} />
        ) : (
          <>
            <FoodPicker onSelect={setSelected} />
            <button onClick={() => setCreating(true)} className="mt-2 text-xs text-blue-600 underline">
              + Add custom food
            </button>
          </>
        )}
      </div>

      {selected && (
        <section className="mt-4 rounded border border-neutral-200 p-3">
          <h2 className="text-sm font-semibold">
            {selected.name}
            {selected.brand && <span className="text-neutral-400"> — {selected.brand}</span>}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">Per {selected.serving_desc}</p>
          <p className="mt-1 text-sm">
            {selected.calories} kcal · {selected.protein_g}p / {selected.carbs_g}c / {selected.fat_g}f
            {selected.fiber_g !== null && ` · ${selected.fiber_g}g fiber`}
          </p>
          {Object.keys((selected.micros as Record<string, number>) ?? {}).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
              {Object.entries(selected.micros as Record<string, number>).map(([key, value]) => (
                <span key={key}>{MICRO_VOCAB[key as MicroKey] ?? key}: {value}</span>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

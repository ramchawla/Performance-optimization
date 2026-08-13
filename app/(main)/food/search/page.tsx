"use client";

import { useState } from "react";
import { FoodPicker } from "@/components/food/FoodPicker";
import { CustomFoodForm } from "@/components/food/CustomFoodForm";
import { FoodSubnav } from "@/components/food/FoodSubnav";
import { MICRO_VOCAB, type MicroKey } from "@/lib/nutrition";
import type { Food } from "@/lib/queries/foods";

function StatPill({ n, l }: { n: string; l: string }) {
  return (
    <div className="flex-1 rounded-xl bg-bg/60 p-2 text-center">
      <div className="font-display text-sm font-bold text-fg">{n}</div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted">{l}</div>
    </div>
  );
}

export default function FoodLibraryPage() {
  const [selected, setSelected] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <main className="min-h-screen bg-bg p-4 pb-24">
      <FoodSubnav />
      <h1 className="mt-3 font-display text-lg font-bold text-fg">Food library</h1>
      <p className="mt-1 text-xs text-muted">
        Browse your saved foods, or add a new one ahead of logging it. To log a meal, use the day view in Log.
      </p>

      <div className="mt-4">
        {creating ? (
          <CustomFoodForm onCreated={(food) => { setSelected(food); setCreating(false); }} />
        ) : (
          <>
            <FoodPicker onSelect={setSelected} />
            <button onClick={() => setCreating(true)}
              className="mt-2 text-xs font-medium text-accent transition-colors duration-200 hover:text-fg">
              + Add custom food
            </button>
          </>
        )}
      </div>

      {selected && (
        <section className="animate-enter mt-4 rounded-2xl border border-surface-raised bg-surface p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-display text-sm font-bold text-accent">
              {selected.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-sm font-bold text-fg">{selected.name}</h2>
              <p className="truncate text-xs text-muted">
                {selected.brand ? `${selected.brand} · ` : ""}Per {selected.serving_desc}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <StatPill n={`${selected.calories}`} l="Kcal" />
            <StatPill n={`${selected.protein_g}g`} l="Protein" />
            <StatPill n={`${selected.carbs_g}g`} l="Carb" />
            <StatPill n={`${selected.fat_g}g`} l="Fat" />
          </div>
          {selected.fiber_g !== null && (
            <p className="mt-2 font-mono text-xs text-muted">{selected.fiber_g}g fiber</p>
          )}
          {Object.keys((selected.micros as Record<string, number>) ?? {}).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(selected.micros as Record<string, number>).map(([key, value]) => (
                <span key={key} className="rounded-full bg-bg/60 px-2 py-0.5 font-mono text-xs text-muted">
                  {MICRO_VOCAB[key as MicroKey] ?? key}: {value}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

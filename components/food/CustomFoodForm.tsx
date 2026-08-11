"use client";

import { useState } from "react";
import { useCreateFood } from "@/lib/queries/foods";
import { MICRO_VOCAB, type MicroKey } from "@/lib/nutrition";
import type { Food } from "@/lib/queries/foods";

export function CustomFoodForm({ onCreated }: { onCreated: (food: Food) => void }) {
  const createFood = useCreateFood();
  const [name, setName] = useState("");
  const [servingDesc, setServingDesc] = useState("1 serving");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [micros, setMicros] = useState<Partial<Record<MicroKey, string>>>({});
  const [showMicros, setShowMicros] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const food = await createFood.mutateAsync({
      name,
      servingDesc,
      calories: Number(calories) || 0,
      proteinG: Number(protein) || 0,
      carbsG: Number(carbs) || 0,
      fatG: Number(fat) || 0,
      micros: Object.fromEntries(
        Object.entries(micros)
          .filter(([, v]) => v && Number(v) > 0)
          .map(([k, v]) => [k, Number(v)])
      ),
    });
    onCreated(food);
  }

  const inputCls =
    "w-full rounded-xl border border-surface-raised bg-bg px-2 py-1.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-surface-raised bg-surface p-3">
      <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">New custom food</p>
      <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      <input required placeholder="Serving (e.g. 1 cup, 100g)" value={servingDesc}
        onChange={(e) => setServingDesc(e.target.value)} className={inputCls} />
      <div className="grid grid-cols-4 gap-2">
        <input required type="number" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} className={inputCls} />
        <input type="number" placeholder="protein g" value={protein} onChange={(e) => setProtein(e.target.value)} className={inputCls} />
        <input type="number" placeholder="carbs g" value={carbs} onChange={(e) => setCarbs(e.target.value)} className={inputCls} />
        <input type="number" placeholder="fat g" value={fat} onChange={(e) => setFat(e.target.value)} className={inputCls} />
      </div>
      <button type="button" onClick={() => setShowMicros((v) => !v)}
        className="text-xs font-medium text-accent transition-colors duration-200 hover:text-fg">
        {showMicros ? "Hide" : "Add"} micronutrients
      </button>
      {showMicros && (
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MICRO_VOCAB) as MicroKey[]).map((key) => (
            <input key={key} type="number" placeholder={MICRO_VOCAB[key]}
              value={micros[key] ?? ""}
              onChange={(e) => setMicros((m) => ({ ...m, [key]: e.target.value }))}
              className={inputCls} />
          ))}
        </div>
      )}
      <button type="submit" disabled={createFood.isPending}
        className="w-full min-h-11 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50">
        {createFood.isPending ? "Saving…" : "Save food"}
      </button>
    </form>
  );
}

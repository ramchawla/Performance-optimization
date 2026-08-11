"use client";

import { useState } from "react";
import { useFoodSearch, useRecentFoods, type Food } from "@/lib/queries/foods";

export function FoodPicker({ onSelect, foods: overrideFoods }: { onSelect: (food: Food) => void; foods?: Food[] }) {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useFoodSearch(query);
  const { data: recent } = useRecentFoods();

  const q = query.trim().toLowerCase();
  // ponytail: optional static `foods` list lets preview pages skip the real
  // Supabase-backed search entirely — drop once there's real food data to search.
  const overrideList = overrideFoods
    ? q
      ? overrideFoods.filter((food) => food.name.toLowerCase().includes(q) || (food.brand ?? "").toLowerCase().includes(q))
      : overrideFoods
    : null;

  const showRecent = !overrideFoods && !q && recent && recent.length > 0;
  const list = overrideList ?? (showRecent ? recent : results);
  const loading = !overrideFoods && isLoading;

  return (
    <div className="rounded-2xl border border-surface-raised bg-surface p-3">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search foods…"
        aria-label="Search foods"
        className="w-full rounded-xl border border-surface-raised bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted transition-shadow duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
      <p aria-live="polite" className="sr-only">
        {loading ? "Searching…" : `${list?.length ?? 0} results`}
      </p>
      {loading && <p className="mt-2 text-xs text-muted">Searching…</p>}
      {showRecent && <p className="mt-2 text-xs font-medium text-muted">Recent</p>}
      <ul className="stagger mt-2 max-h-64 space-y-1.5 overflow-y-auto">
        {list?.map((food) => (
          <li key={food.id}>
            <button
              type="button"
              onClick={() => onSelect(food)}
              className="flex w-full min-h-11 items-center gap-2.5 rounded-xl border border-surface-raised bg-bg/40 px-3 py-2 text-left transition-colors duration-200 hover:border-accent/40 hover:bg-surface-raised active:scale-[0.98]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-bold text-fg">{food.name}</span>
                <span className="block truncate text-xs text-muted">
                  {food.brand ? `${food.brand} · ${food.serving_desc}` : food.serving_desc}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">{food.calories} kcal</span>
            </button>
          </li>
        ))}
        {list?.length === 0 && !loading && (
          <li className="px-2 py-2 text-xs text-muted">No matches. Create a custom food below.</li>
        )}
      </ul>
    </div>
  );
}

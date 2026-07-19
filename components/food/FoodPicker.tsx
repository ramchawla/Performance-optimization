"use client";

import { useState } from "react";
import { useFoodSearch, useRecentFoods, type Food } from "@/lib/queries/foods";

export function FoodPicker({ onSelect }: { onSelect: (food: Food) => void }) {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useFoodSearch(query);
  const { data: recent } = useRecentFoods();

  const showRecent = !query.trim() && recent && recent.length > 0;
  const list = showRecent ? recent : results;

  return (
    <div className="rounded border border-neutral-300 p-3">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search foods…"
        aria-label="Search foods"
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <p aria-live="polite" className="sr-only">
        {isLoading ? "Searching…" : `${list?.length ?? 0} results`}
      </p>
      {isLoading && <p className="mt-2 text-xs text-neutral-500">Searching…</p>}
      {showRecent && <p className="mt-2 text-xs font-medium text-neutral-400">Recent</p>}
      <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto">
        {list?.map((food) => (
          <li key={food.id}>
            <button
              type="button"
              onClick={() => onSelect(food)}
              className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-neutral-100"
            >
              <span>
                {food.name}
                {food.brand && <span className="text-neutral-400"> — {food.brand}</span>}
              </span>
              <span className="text-xs text-neutral-400">
                {food.calories} kcal / {food.serving_desc}
              </span>
            </button>
          </li>
        ))}
        {list?.length === 0 && !isLoading && (
          <li className="px-2 py-2 text-xs text-neutral-400">No matches. Create a custom food below.</li>
        )}
      </ul>
    </div>
  );
}

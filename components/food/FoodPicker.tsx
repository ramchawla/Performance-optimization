"use client";

import { useEffect, useState } from "react";
import { useFoodSearch, useImportFood, useRecentFoods, type Food, type FoodResult } from "@/lib/queries/foods";

/** Keystrokes are cheap; USDA round trips are not. */
function useDebounced(value: string, ms = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function FoodPicker({ onSelect }: { onSelect: (food: Food) => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const { data, isLoading } = useFoodSearch(debouncedQuery);
  const { data: recent } = useRecentFoods();
  const importFood = useImportFood();
  const [importError, setImportError] = useState<string | null>(null);

  const q = query.trim();
  const showRecent = !q && recent && recent.length > 0;
  const list: FoodResult[] | undefined = showRecent
    ? recent.map((f) => ({
        key: f.id,
        name: f.name,
        brand: f.brand,
        servingDesc: f.serving_desc,
        calories: f.calories,
        local: f,
        usda: null,
      }))
    : data?.results;

  // Stale results linger while the debounce settles — say so rather than
  // showing yesterday's matches under today's query.
  const loading = isLoading || (!!q && q !== debouncedQuery.trim());

  function handleSelect(result: FoodResult) {
    setImportError(null);
    if (result.local) {
      onSelect(result.local);
      return;
    }
    if (!result.usda) return;
    importFood.mutate(result.usda, {
      onSuccess: onSelect,
      onError: (err) => setImportError(err instanceof Error ? err.message : "Could not save that food"),
    });
  }

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
      {data?.usdaError && !loading && (
        <p className="mt-2 text-xs text-amber-400">Food database unavailable — showing saved foods only.</p>
      )}
      {importError && <p className="mt-2 text-xs text-red-400">{importError}</p>}
      <ul className="stagger mt-2 max-h-64 space-y-1.5 overflow-y-auto">
        {list?.map((food) => (
          <li key={food.key}>
            <button
              type="button"
              disabled={importFood.isPending}
              onClick={() => handleSelect(food)}
              className="flex w-full min-h-11 items-center gap-2.5 rounded-xl border border-surface-raised bg-bg/40 px-3 py-2 text-left transition-colors duration-200 hover:border-accent/40 hover:bg-surface-raised active:scale-[0.98] disabled:opacity-50"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-bold text-fg">{food.name}</span>
                <span className="block truncate text-xs text-muted">
                  {food.brand ? `${food.brand} · ${food.servingDesc}` : food.servingDesc}
                </span>
              </span>
              {food.usda && (
                <span className="shrink-0 rounded-full bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  USDA
                </span>
              )}
              <span className="shrink-0 font-mono text-xs text-muted">{Math.round(food.calories)} kcal</span>
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

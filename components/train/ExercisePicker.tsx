"use client";

import { useState } from "react";
import { useExerciseSearch, type Exercise } from "@/lib/queries/exercises";

export function ExercisePicker({ onSelect }: { onSelect: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const { data: exercises, isLoading } = useExerciseSearch(query);

  return (
    <div className="rounded-2xl bg-surface p-3">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises…"
        className="w-full rounded-xl border border-surface-raised bg-surface-raised px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {isLoading && <p className="mt-2 text-xs text-muted">Searching…</p>}
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {exercises?.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => onSelect(ex)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm text-fg hover:bg-surface-raised"
            >
              <span>{ex.name}</span>
              <span className="text-xs text-muted">{ex.equipment}</span>
            </button>
          </li>
        ))}
        {exercises?.length === 0 && !isLoading && (
          <li className="px-2 py-2 text-xs text-muted">No matches.</li>
        )}
      </ul>
    </div>
  );
}

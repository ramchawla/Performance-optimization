"use client";

import { useState } from "react";
import { useExerciseSearch, type Exercise } from "@/lib/queries/exercises";

export function ExercisePicker({ onSelect }: { onSelect: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const { data: exercises, isLoading } = useExerciseSearch(query);

  return (
    <div className="rounded border border-neutral-300 p-3">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises…"
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      {isLoading && <p className="mt-2 text-xs text-neutral-500">Searching…</p>}
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {exercises?.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => onSelect(ex)}
              className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-neutral-100"
            >
              <span>{ex.name}</span>
              <span className="text-xs text-neutral-400">{ex.equipment}</span>
            </button>
          </li>
        ))}
        {exercises?.length === 0 && !isLoading && (
          <li className="px-2 py-2 text-xs text-neutral-400">No matches.</li>
        )}
      </ul>
    </div>
  );
}

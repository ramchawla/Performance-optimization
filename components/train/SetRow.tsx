"use client";

import { useState } from "react";
import { displayWeightKg, inputToKg } from "@/lib/units";

const WEIGHT_UNIT = "lb" as const;

export function SetRow({
  setNumber,
  isWarmup,
  actualReps,
  actualWeightKg,
  actualRpe,
  prefillReps,
  prefillWeightKg,
  prefillRpe,
  lastLabel,
  onLog,
}: {
  setNumber: number;
  isWarmup: boolean;
  actualReps: number | null;
  actualWeightKg: number | null;
  actualRpe: number | null;
  prefillReps: number | null;
  prefillWeightKg: number | null;
  prefillRpe: number | null;
  lastLabel: string | null;
  onLog: (result: { reps: number; weightKg: number; rpe: number | null }) => void;
}) {
  const isLogged = actualReps !== null;
  const [reps, setReps] = useState(actualReps ?? prefillReps ?? 0);
  const [weight, setWeight] = useState(displayWeightKg(actualWeightKg ?? prefillWeightKg, WEIGHT_UNIT) ?? 0);
  const [rpe, setRpe] = useState<number | undefined>(actualRpe ?? prefillRpe ?? undefined);

  return (
    <div className={`rounded p-2 ${isLogged ? "bg-green-50" : "bg-neutral-50"}`}>
      {lastLabel && !isLogged && <div className="mb-1 text-[11px] text-neutral-400">Last: {lastLabel}</div>}
      <div className="flex items-center gap-2">
        <span className="w-5 text-xs text-neutral-400">{isWarmup ? "W" : setNumber}</span>
        <input
          type="number"
          value={reps}
          onChange={(e) => setReps(Number(e.target.value))}
          aria-label="Reps"
          className="w-14 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          aria-label={`Weight (${WEIGHT_UNIT})`}
          className="w-16 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          step="0.5"
          value={rpe ?? ""}
          placeholder="RPE"
          onChange={(e) => setRpe(e.target.value === "" ? undefined : Number(e.target.value))}
          aria-label="RPE"
          className="w-14 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => onLog({ reps, weightKg: inputToKg(weight, WEIGHT_UNIT), rpe: rpe ?? null })}
          className={`ml-auto rounded px-3 py-1.5 text-xs font-medium text-white ${isLogged ? "bg-neutral-500" : "bg-neutral-900"}`}
        >
          {isLogged ? "Update" : "Log"}
        </button>
      </div>
    </div>
  );
}

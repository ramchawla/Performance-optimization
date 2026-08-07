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
    <div className={`rounded-xl p-2 ${isLogged ? "bg-accent/10 ring-1 ring-accent/40" : "bg-surface-raised"}`}>
      {lastLabel && !isLogged && <div className="mb-1 text-[11px] text-muted">Last: {lastLabel}</div>}
      <div className="flex items-center gap-2">
        <span className="w-5 text-xs text-muted">{isWarmup ? "W" : setNumber}</span>
        <input
          type="number"
          value={reps}
          onChange={(e) => setReps(Number(e.target.value))}
          aria-label="Reps"
          className="w-14 rounded-lg border border-surface-raised bg-surface px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
        />
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          aria-label={`Weight (${WEIGHT_UNIT})`}
          className="w-16 rounded-lg border border-surface-raised bg-surface px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
        />
        <input
          type="number"
          step="0.5"
          value={rpe ?? ""}
          placeholder="RPE"
          onChange={(e) => setRpe(e.target.value === "" ? undefined : Number(e.target.value))}
          aria-label="RPE"
          className="w-14 rounded-lg border border-surface-raised bg-surface px-2 py-1.5 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onLog({ reps, weightKg: inputToKg(weight, WEIGHT_UNIT), rpe: rpe ?? null })}
          className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium ${isLogged ? "bg-surface text-fg" : "bg-accent text-bg"}`}
        >
          {isLogged ? "Update" : "Log"}
        </button>
      </div>
    </div>
  );
}

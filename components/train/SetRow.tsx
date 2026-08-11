"use client";

import { useEffect, useRef, useState } from "react";
import { displayWeightKg, inputToKg } from "@/lib/units";

const WEIGHT_UNIT = "lb" as const;

export type SetStatus = "done" | "active" | "upcoming";

export function SetRow({
  status,
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
  status: SetStatus;
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

  // Spring-pop the checkball + flash the row once, the moment this set
  // transitions from not-logged to logged (not on every re-render/re-log).
  const wasLogged = useRef(isLogged);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (isLogged && !wasLogged.current) {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 550);
      wasLogged.current = true;
      return () => clearTimeout(t);
    }
    wasLogged.current = isLogged;
  }, [isLogged]);

  const inputBase =
    "w-full min-w-0 rounded-lg border border-transparent bg-surface px-1.5 py-2.5 text-center font-mono text-lg font-bold tabular-nums text-fg focus:border-accent focus:outline-none";

  return (
    <div
      className={`rounded-xl p-2.5 transition-colors duration-150 ${
        status === "active"
          ? "bg-surface-raised ring-1 ring-accent/50 shadow-[0_0_14px_-6px_var(--accent)]"
          : status === "done"
            ? "bg-surface"
            : "bg-surface/50"
      } ${justCompleted ? "animate-set-complete" : ""}`}
      data-status={status}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1.5 text-xs font-bold ${
            status === "done" ? "text-accent" : status === "active" ? "text-fg" : "text-muted"
          }`}
        >
          <span
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] leading-none ${
              status === "done" ? "border-accent bg-accent text-bg" : "border-surface-raised text-transparent"
            } ${justCompleted ? "animate-spring-pop" : ""}`}
            aria-hidden="true"
          >
            ✓
          </span>
          {isWarmup ? "Warmup" : `Set ${setNumber}`}
        </span>
        {status === "upcoming" && <span className="text-[11px] text-muted">Not started</span>}
        {status === "active" && lastLabel && <span className="truncate text-[11px] text-muted">Last: {lastLabel}</span>}
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-1.5">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">{WEIGHT_UNIT}</span>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            aria-label={`Weight (${WEIGHT_UNIT})`}
            className={inputBase}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">Reps</span>
          <input
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            aria-label="Reps"
            className={inputBase}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">RPE</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={rpe ?? ""}
            placeholder="—"
            onChange={(e) => setRpe(e.target.value === "" ? undefined : Number(e.target.value))}
            aria-label="RPE"
            className={inputBase}
          />
        </label>
        <button
          type="button"
          onClick={() => onLog({ reps, weightKg: inputToKg(weight, WEIGHT_UNIT), rpe: rpe ?? null })}
          className={`h-11 min-w-11 flex-shrink-0 rounded-lg px-3 text-xs font-bold transition-transform duration-150 hover:brightness-110 active:scale-90 ${
            status === "active" ? "bg-accent text-bg" : "bg-surface-raised text-fg"
          }`}
        >
          {isLogged ? "Update" : "Log"}
        </button>
      </div>
    </div>
  );
}

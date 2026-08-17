"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { presetSeconds, type Preset, type PresetExercise } from "@/lib/mobility/presets";

/** A per-side exercise becomes two steps, so the switch is an explicit prompt. */
interface Step {
  exercise: PresetExercise;
  side: "left" | "right" | null;
  seconds: number;
}

function buildSteps(preset: Preset): Step[] {
  return preset.exercises.flatMap<Step>((exercise) =>
    exercise.perSide
      ? [
          { exercise, side: "left", seconds: exercise.seconds },
          { exercise, side: "right", seconds: exercise.seconds },
        ]
      : [{ exercise, side: null, seconds: exercise.seconds }]
  );
}

function mmss(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const RING = 2 * Math.PI * 52;

export function PresetPlayer({
  preset,
  onFinish,
  onExit,
}: {
  preset: Preset;
  /** elapsedSec is real time spent, which is not the same as the prescribed total. */
  onFinish: (elapsedSec: number) => void;
  onExit: () => void;
}) {
  const steps = useMemo(() => buildSteps(preset), [preset]);
  // index/remaining/done move together — advancing is one transition, not
  // three, which keeps it inside the tick instead of in a reactive effect.
  const [{ index, remaining, done }, setProgress] = useState(() => ({
    index: 0,
    remaining: buildSteps(preset)[0]?.seconds ?? 0,
    done: false,
  }));
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const advance = useCallback(
    (from: { index: number; remaining: number; done: boolean }) =>
      from.index >= steps.length - 1
        ? { ...from, remaining: 0, done: true }
        : { index: from.index + 1, remaining: steps[from.index + 1].seconds, done: false },
    [steps]
  );

  useEffect(() => {
    if (!running || done) return;
    const id = setInterval(() => {
      setElapsed((e) => e + 1);
      setProgress((p) => (p.remaining > 1 ? { ...p, remaining: p.remaining - 1 } : advance(p)));
    }, 1000);
    return () => clearInterval(id);
  }, [running, done, advance]);

  function skip() {
    setProgress(advance);
  }

  if (done) {
    return (
      <div className="animate-enter rounded-2xl border border-surface-raised bg-surface p-5 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg text-bg">
          ✓
        </span>
        <p className="font-display text-lg font-bold text-fg">{preset.name} done</p>
        <p className="mt-1 text-xs text-muted">{mmss(elapsed)} on the clock</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onFinish(elapsed)}
            className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98]"
          >
            Log it
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]"
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  const progress = step ? 1 - Math.max(0, remaining) / step.seconds : 0;

  return (
    <div className="animate-enter rounded-2xl border border-surface-raised bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">{preset.name}</p>
        <p className="font-mono text-[11px] text-muted">
          {index + 1} / {steps.length}
        </p>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-raised)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <p className="-mt-[4.75rem] font-mono text-3xl font-bold tabular-nums text-fg">{mmss(remaining)}</p>
      </div>

      <div className="mt-10 text-center">
        <p className="font-display text-lg font-bold text-fg">
          {step.exercise.name}
          {step.side && <span className="text-accent"> · {step.side}</span>}
        </p>
        {step.exercise.cue && <p className="mt-1 text-xs text-muted">{step.exercise.cue}</p>}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="min-h-11 flex-1 rounded-xl border border-surface-raised px-3 py-2 font-display text-sm font-bold text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]"
        >
          {running ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={skip}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98]"
        >
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="mt-2 min-h-11 w-full text-xs text-muted transition-colors duration-200 hover:text-fg"
      >
        Quit without logging
      </button>

      <ol className="mt-4 space-y-1 border-t border-surface-raised pt-3">
        {preset.exercises.map((ex, i) => (
          <li
            key={`${ex.name}-${i}`}
            className={`flex justify-between text-xs ${ex.name === step.exercise.name ? "text-accent" : "text-muted"}`}
          >
            <span className="truncate">
              {ex.name}
              {ex.perSide && " (per side)"}
            </span>
            <span className="ml-2 shrink-0 font-mono">{ex.seconds}s</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-right font-mono text-[10px] text-muted">
        {Math.round(presetSeconds(preset) / 60)} min prescribed
      </p>
    </div>
  );
}

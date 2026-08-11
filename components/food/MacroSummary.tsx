"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { DailyTotals } from "@/lib/calc/nutritionTotals";
import { macroProgress, type MacroTargets } from "@/lib/calc/nutritionTotals";
import { MICRO_VOCAB, type MicroKey } from "@/lib/nutrition";

function clampFraction(ratio: number | null): number {
  if (ratio === null) return 0;
  return Math.max(0, Math.min(1, ratio));
}

/** Animates a ring's stroke-dashoffset in from empty on first mount — same
 * double-rAF pattern as WeekRing.tsx's useEffect, factored out since this
 * component drives two rings off the same totals. */
function useRingFill(circleRef: RefObject<SVGCircleElement | null>, fraction: number) {
  const hasAnimatedIn = useRef(false);
  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;
    const len = circle.getTotalLength();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    circle.style.strokeDasharray = `${len}`;

    if (!hasAnimatedIn.current && !reduceMotion) {
      hasAnimatedIn.current = true;
      circle.style.strokeDashoffset = `${len}`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          circle.style.strokeDashoffset = `${len * (1 - fraction)}`;
        });
      });
    } else {
      hasAnimatedIn.current = true;
      circle.style.strokeDashoffset = `${len * (1 - fraction)}`;
    }
  }, [circleRef, fraction]);
}

function MiniBar({ label, consumed, target, ratio }: { label: string; consumed: number; target: number | null; ratio: number | null }) {
  const pct = ratio !== null ? Math.min(100, Math.round(ratio * 100)) : null;
  return (
    <div className="rounded-xl bg-bg/60 p-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular-nums text-fg">
          {Math.round(consumed)}
          {target ? ` / ${target}` : ""}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-1.5 rounded-full transition-[width] duration-700 ease-out ${
            ratio !== null && ratio > 1 ? "bg-amber-500" : "bg-accent"
          }`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function MacroSummary({ totals, targets }: { totals: DailyTotals; targets: MacroTargets }) {
  const progress = macroProgress(totals, targets);
  const microEntries = Object.entries(totals.micros).filter(([, v]) => v > 0);

  const proteinFraction = clampFraction(progress.proteinG);
  const caloriesFraction = clampFraction(progress.calories);
  const outerRef = useRef<SVGCircleElement>(null);
  const innerRef = useRef<SVGCircleElement>(null);
  useRingFill(outerRef, proteinFraction);
  useRingFill(innerRef, caloriesFraction);

  const proteinRemaining = targets.proteinG ? Math.max(0, Math.round(targets.proteinG - totals.proteinG)) : null;

  return (
    <div className="rounded-2xl border border-surface-raised bg-surface p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-[112px] w-[112px] shrink-0">
          <svg viewBox="0 0 120 120" className="h-[112px] w-[112px] -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-raised)" strokeWidth="11" />
            <circle cx="60" cy="60" r="39" fill="none" stroke="var(--surface-raised)" strokeWidth="11" />
            <circle
              ref={outerRef}
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="11"
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
            />
            <circle
              ref={innerRef}
              cx="60"
              cy="60"
              r="39"
              fill="none"
              stroke="var(--accent-dim)"
              strokeWidth="11"
              strokeLinecap="round"
              className="[transition-delay:120ms] transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl font-bold text-fg">{Math.round(caloriesFraction * 100)}%</span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted">of goal</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-fg">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            Protein{" "}
            <b className="font-mono tabular-nums">
              {Math.round(totals.proteinG)}
              {targets.proteinG ? ` / ${targets.proteinG}g` : "g"}
            </b>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-fg">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent-dim" />
            Calories{" "}
            <b className="font-mono tabular-nums">
              {Math.round(totals.calories)}
              {targets.calories ? ` / ${targets.calories}` : ""}
            </b>
          </div>
          {proteinRemaining !== null && proteinRemaining > 0 && (
            <p className="mt-2 inline-block rounded-lg border border-accent/25 bg-accent/10 px-2 py-1 font-mono text-xs text-accent">
              {proteinRemaining}g protein to go
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniBar label="Carbs" consumed={totals.carbsG} target={targets.carbsG} ratio={progress.carbsG} />
        <MiniBar label="Fat" consumed={totals.fatG} target={targets.fatG} ratio={progress.fatG} />
      </div>

      {microEntries.length > 0 && (
        <div className="mt-3 border-t border-surface-raised pt-2">
          <p className="text-xs text-muted">Micros today</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {microEntries.map(([key, value]) => (
              <span key={key} className="rounded-full bg-bg/60 px-2 py-0.5 font-mono text-xs text-muted">
                {MICRO_VOCAB[key as MicroKey] ?? key}: {Math.round(value * 10) / 10}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

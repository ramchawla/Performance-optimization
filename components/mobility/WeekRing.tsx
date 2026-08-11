"use client";

import { useEffect, useRef, useState } from "react";

interface WeekRingProps {
  activeDays: number;
  totalDays: number;
  streakWeeks: number;
}

/** Weekly consistency ring (animates in via getTotalLength) + lit streak pearls. */
export function WeekRing({ activeDays, totalDays, streakWeeks }: WeekRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const hasAnimatedIn = useRef(false);

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;
    const len = circle.getTotalLength();
    const fraction = totalDays > 0 ? activeDays / totalDays : 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    circle.style.strokeDasharray = `${len}`;

    if (!hasAnimatedIn.current && !reduceMotion) {
      hasAnimatedIn.current = true;
      circle.style.strokeDashoffset = `${len}`; // start empty, then animate to fraction
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          circle.style.strokeDashoffset = `${len * (1 - fraction)}`;
        });
      });
    } else {
      hasAnimatedIn.current = true;
      circle.style.strokeDashoffset = `${len * (1 - fraction)}`;
    }
  }, [activeDays, totalDays]);

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[92px] w-[92px] shrink-0">
        <svg viewBox="0 0 92 92" className="h-[92px] w-[92px] -rotate-90">
          <circle cx="46" cy="46" r="42" fill="none" stroke="var(--surface-raised)" strokeWidth="8" />
          <circle
            ref={circleRef}
            cx="46"
            cy="46"
            r="42"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold text-fg">
            {activeDays}
            <span className="text-xs font-normal text-muted">/{totalDays}</span>
          </span>
          <span className="mt-0.5 text-[9px] tracking-wide text-muted">this week</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5" aria-label={`${streakWeeks} week streak`}>
          {Array.from({ length: streakWeeks }).map((_, i) => (
            <Pearl key={i} delayMs={250 + i * 180} />
          ))}
        </div>
        <span className="text-xs text-muted">{streakWeeks}-week streak</span>
      </div>
    </div>
  );
}

function Pearl({ delayMs }: { delayMs: number }) {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    // reduced-motion instant state is handled in CSS below (motion-reduce:*)
    // rather than here, so this effect never needs a synchronous setState.
    const t = setTimeout(() => setLit(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return (
    <span
      className={`h-3.5 w-3.5 rounded-full transition-all duration-300 motion-reduce:scale-100 motion-reduce:bg-accent motion-reduce:opacity-100 motion-reduce:shadow-[0_0_10px_-2px_var(--accent)] motion-reduce:transition-none ${
        lit
          ? "scale-100 bg-accent opacity-100 shadow-[0_0_10px_-2px_var(--accent)]"
          : "scale-[0.7] bg-surface-raised opacity-50"
      }`}
    />
  );
}

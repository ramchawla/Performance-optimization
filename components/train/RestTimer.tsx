"use client";

import { useEffect, useState } from "react";
import { useActiveSessionStore } from "@/stores/activeSession";

const RADIUS = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Always-visible rest timer, auto-started on set completion (TECHNICAL-DESIGN §2). */
export function RestTimer() {
  const endsAt = useActiveSessionStore((s) => s.restTimerEndsAt);
  const totalSecondsAtStart = useActiveSessionStore((s) => s.restTimerTotalSeconds);
  const clear = useActiveSessionStore((s) => s.clearRestTimer);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt && now >= endsAt) clear();
  }, [now, endsAt, clear]);

  if (!endsAt) return null;
  const remainingMs = Math.max(0, endsAt - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const progress = totalSecondsAtStart ? Math.min(1, remainingMs / (totalSecondsAtStart * 1000)) : 0;
  const dashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-accent/30 bg-surface-raised/95 p-3 shadow-[0_0_20px_-6px_var(--accent)] backdrop-blur">
      <div className="relative h-14 w-14 flex-shrink-0">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="var(--surface)" strokeWidth="5" />
          <circle
            cx="28"
            cy="28"
            r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold tabular-nums text-fg">
          {mm}:{String(ss).padStart(2, "0")}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-fg">Resting</div>
        <div className="truncate text-xs text-muted">Get ready for the next set</div>
      </div>
      <button
        onClick={clear}
        className="flex-shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold text-muted transition-transform duration-150 hover:text-fg active:scale-90"
      >
        Skip
      </button>
    </div>
  );
}

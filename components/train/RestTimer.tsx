"use client";

import { useEffect, useState } from "react";
import { useActiveSessionStore } from "@/stores/activeSession";

/** Always-visible rest timer, auto-started on set completion (TECHNICAL-DESIGN §2). */
export function RestTimer() {
  const endsAt = useActiveSessionStore((s) => s.restTimerEndsAt);
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

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-surface-raised px-4 py-3 shadow-[0_0_16px_-4px_var(--accent)]">
      <span className="font-display text-lg font-bold tabular-nums text-accent">
        {mm}:{String(ss).padStart(2, "0")}
      </span>
      <span className="text-xs text-muted">Rest</span>
      <button onClick={clear} className="text-xs text-fg underline">
        Skip
      </button>
    </div>
  );
}

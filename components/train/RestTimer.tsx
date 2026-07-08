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
    <div className="fixed bottom-16 left-0 right-0 z-40 flex items-center justify-between bg-neutral-900 px-4 py-3 text-white">
      <span className="text-lg font-semibold tabular-nums">
        {mm}:{String(ss).padStart(2, "0")}
      </span>
      <span className="text-xs text-neutral-300">Rest</span>
      <button onClick={clear} className="text-xs underline">
        Skip
      </button>
    </div>
  );
}

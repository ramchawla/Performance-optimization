"use client";

import { useRef, useState } from "react";
import { WeekRing } from "@/components/mobility/WeekRing";
import { RoutineCard } from "@/components/mobility/RoutineCard";
import { RecentSessions, type RecentSessionItem } from "@/components/mobility/RecentSessions";
import { MOCK_MOBILITY } from "@/lib/mock/mobilityMock";

// ponytail: rendering MOCK_MOBILITY directly instead of a query hook — there's
// no mobility_routines/mobility_sessions schema yet. Swap to real queries once
// that table + lib/queries wiring exists; the shapes here can guide the schema.
const INITIAL_SESSIONS: RecentSessionItem[] = MOCK_MOBILITY.recentSessions.map((s) => ({
  id: s.id,
  routineName: s.routineName,
  durationLabel: `${s.durationMin} min`,
  daysAgo: s.daysAgo,
  skippedStretch: s.skippedStretch,
  isNew: false,
}));

const lastDaysAgo = Math.max(...MOCK_MOBILITY.recentSessions.map((s) => s.daysAgo));
const GAP_LABEL = `${lastDaysAgo + 1}–${lastDaysAgo + 2} days ago`;

export default function Page() {
  const [weekActiveDays, setWeekActiveDays] = useState(MOCK_MOBILITY.weekActiveDays);
  const [sessions, setSessions] = useState<RecentSessionItem[]>(INITIAL_SESSIONS);
  const nextId = useRef(1);

  function handleComplete(routineName: string, durationSec: number) {
    setWeekActiveDays((d) => Math.min(d + 1, MOCK_MOBILITY.weekTotalDays));

    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const durationLabel = secs === 0 ? `${mins} min` : `${mins}m ${secs}s`;

    const id = `new-${nextId.current++}`;
    setSessions((prev) => [
      { id, routineName, durationLabel, daysAgo: null, skippedStretch: false, isNew: true },
      ...prev.map((s) => ({ ...s, isNew: false })),
    ]);
  }

  return (
    <main className="animate-enter p-4 pb-4">
      <h1 className="font-display text-xl font-bold text-fg">Mobility</h1>

      <section className="mt-5 rounded-2xl bg-surface p-4">
        <WeekRing activeDays={weekActiveDays} totalDays={MOCK_MOBILITY.weekTotalDays} streakWeeks={MOCK_MOBILITY.streakWeeks} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Routines</h2>
        <div className="stagger flex flex-col gap-2.5">
          {MOCK_MOBILITY.routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} onComplete={handleComplete} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent sessions</h2>
        <RecentSessions sessions={sessions} gapLabel={GAP_LABEL} />
      </section>
    </main>
  );
}

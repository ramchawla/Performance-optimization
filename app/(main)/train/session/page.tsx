"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveSessionStore } from "@/stores/activeSession";
import { ExerciseBlock } from "@/components/train/ExerciseBlock";
import { RestTimer } from "@/components/train/RestTimer";
import { MOCK_ACTIVE_SESSION, MOCK_EXERCISE_NAMES } from "@/lib/mock/trainMock";

// ponytail: seeds the real activeSession Zustand store with MOCK_ACTIVE_SESSION
// on mount instead of coming from useStartSession — no seed data locally, this
// is a visual preview of a session in progress. Logging a set still updates
// the (local, in-memory) store and starts the real rest timer, but the
// network writes (useLogSet, useCompleteSession) are skipped so this doesn't
// enqueue outbox entries for fake ids. Exercise names come from a static
// lookup instead of useExercisesByIds since the exercises table has no seed
// data either. Swap back to the real hooks once templates/exercises/sessions
// are seeded in the real DB.
export default function ActiveSessionPage() {
  const router = useRouter();
  const session = useActiveSessionStore((s) => s.session);
  const startSessionInStore = useActiveSessionStore((s) => s.startSession);
  const endSessionInStore = useActiveSessionStore((s) => s.endSession);
  const completeSetInStore = useActiveSessionStore((s) => s.completeSet);
  const addSetInStore = useActiveSessionStore((s) => s.addSet);
  const setDeload = useActiveSessionStore((s) => s.setDeload);
  const setBodyweight = useActiveSessionStore((s) => s.setBodyweight);
  const startRestTimer = useActiveSessionStore((s) => s.startRestTimer);

  useEffect(() => {
    if (!session) {
      startSessionInStore({
        clientId: MOCK_ACTIVE_SESSION.clientId,
        templateId: MOCK_ACTIVE_SESSION.templateId,
        templateNameSnapshot: MOCK_ACTIVE_SESSION.templateNameSnapshot,
        isDeload: MOCK_ACTIVE_SESSION.isDeload,
        exercises: MOCK_ACTIVE_SESSION.exercises,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsed = useElapsedLabel(session?.startedAt ?? null);

  if (!session) {
    return null;
  }

  function handleLogSet(
    exerciseClientId: string,
    setClientId: string,
    _setNumber: number,
    _isWarmup: boolean,
    result: { reps: number; weightKg: number; rpe: number | null },
    restSeconds: number | null
  ) {
    completeSetInStore(exerciseClientId, setClientId, {
      actualReps: result.reps,
      actualWeightKg: result.weightKg,
      actualRpe: result.rpe,
    });
    if (restSeconds) startRestTimer(restSeconds);
  }

  function handleFinish() {
    endSessionInStore();
    router.push("/train/history");
  }

  return (
    <main className="p-4 pb-32">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-fg">
            {session.templateNameSnapshot ?? "Workout"}
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-accent">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent motion-safe:animate-pulse" />
            Live · {elapsed} elapsed
          </div>
        </div>
        <button
          onClick={handleFinish}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg transition-transform duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          Finish
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-fg">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={session.isDeload}
            onChange={(e) => setDeload(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Deload
        </label>
        <label className="flex items-center gap-1">
          Bodyweight (kg)
          <input
            type="number"
            defaultValue={session.bodyweightKg ?? ""}
            onBlur={(e) => setBodyweight(e.target.value === "" ? null : Number(e.target.value))}
            className="w-16 rounded-lg border border-surface-raised bg-surface-raised px-2 py-1 font-mono tabular-nums text-fg focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <div className="stagger mt-4 space-y-4">
        {[...session.exercises]
          .sort((a, b) => a.position - b.position)
          .map((ex) => (
            <ExerciseBlock
              key={ex.clientId}
              exercise={ex}
              exerciseName={MOCK_EXERCISE_NAMES[ex.exerciseId] ?? "…"}
              onLogSet={(setClientId, setNumber, isWarmup, result) =>
                handleLogSet(ex.clientId, setClientId, setNumber, isWarmup, result, ex.restSeconds)
              }
              onAddSet={() => addSetInStore(ex.clientId)}
            />
          ))}
      </div>

      <RestTimer />
    </main>
  );
}

/** mm:ss elapsed since session start, ticking every second. */
function useElapsedLabel(startedAt: string | null): string {
  const [label, setLabel] = useState("0:00");

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    function tick() {
      const totalSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const mm = Math.floor(totalSeconds / 60);
      const ss = totalSeconds % 60;
      setLabel(`${mm}:${String(ss).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return label;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveSessionStore } from "@/stores/activeSession";
import { useExercisesByIds } from "@/lib/queries/exercises";
import { useLogSet, useCompleteSession } from "@/lib/queries/sessions";
import { ExerciseBlock } from "@/components/train/ExerciseBlock";
import { RestTimer } from "@/components/train/RestTimer";

// Session state is populated by useStartSession() (template detail page)
// before navigating here — this page never seeds its own session.
export default function ActiveSessionPage() {
  const router = useRouter();
  const session = useActiveSessionStore((s) => s.session);
  const completeSetInStore = useActiveSessionStore((s) => s.completeSet);
  const addSetInStore = useActiveSessionStore((s) => s.addSet);
  const setDeload = useActiveSessionStore((s) => s.setDeload);
  const setBodyweight = useActiveSessionStore((s) => s.setBodyweight);
  const startRestTimer = useActiveSessionStore((s) => s.startRestTimer);

  const logSet = useLogSet();
  const completeSession = useCompleteSession();
  const exerciseIds = session?.exercises.map((e) => e.exerciseId) ?? [];
  const { data: exerciseNames } = useExercisesByIds(exerciseIds);

  useEffect(() => {
    if (!session) router.replace("/train/templates");
  }, [session, router]);

  const elapsed = useElapsedLabel(session?.startedAt ?? null);

  if (!session) {
    return null;
  }

  function handleLogSet(
    exerciseClientId: string,
    setClientId: string,
    setNumber: number,
    isWarmup: boolean,
    result: { reps: number; weightKg: number; rpe: number | null },
    restSeconds: number | null
  ) {
    completeSetInStore(exerciseClientId, setClientId, {
      actualReps: result.reps,
      actualWeightKg: result.weightKg,
      actualRpe: result.rpe,
    });
    logSet.mutate({
      setClientId,
      sessionExerciseClientId: exerciseClientId,
      setNumber,
      isWarmup,
      actualReps: result.reps,
      actualWeightKg: result.weightKg,
      actualRpe: result.rpe,
    });
    if (restSeconds) startRestTimer(restSeconds);
  }

  async function handleFinish() {
    if (!session) return;
    // useCompleteSession ends the store itself on success — don't duplicate here.
    await completeSession.mutateAsync({
      clientId: session.clientId,
      templateId: session.templateId,
      templateNameSnapshot: session.templateNameSnapshot,
      startedAt: session.startedAt,
      isDeload: session.isDeload,
      bodyweightKg: session.bodyweightKg,
    });
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
              exerciseName={exerciseNames?.[ex.exerciseId] ?? "…"}
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

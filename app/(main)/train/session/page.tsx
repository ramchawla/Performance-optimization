"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActiveSessionStore } from "@/stores/activeSession";
import { useExercisesByIds } from "@/lib/queries/exercises";
import { useLogSet, useCompleteSession } from "@/lib/queries/sessions";
import { ExerciseBlock } from "@/components/train/ExerciseBlock";
import { RestTimer } from "@/components/train/RestTimer";

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

  const exerciseIds = useMemo(() => session?.exercises.map((e) => e.exerciseId) ?? [], [session]);
  const { data: exerciseNames } = useExercisesByIds(exerciseIds);

  if (!session) {
    return (
      <main className="p-6 text-center">
        <p className="text-sm text-muted">No active session.</p>
        <Link href="/train/templates" className="mt-2 inline-block text-sm text-accent">
          Go to templates
        </Link>
      </main>
    );
  }

  async function handleLogSet(
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
    await logSet.mutateAsync({
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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">{session.templateNameSnapshot ?? "Workout"}</h1>
        <button
          onClick={handleFinish}
          disabled={completeSession.isPending}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          Finish
        </button>
      </div>

      <div className="mt-2 flex items-center gap-4 text-sm text-fg">
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
            className="w-16 rounded-lg border border-surface-raised bg-surface-raised px-2 py-1 text-fg focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 space-y-4">
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

"use client";

import type { ActiveSessionExercise } from "@/stores/activeSession";
import { useLastPerformance } from "@/lib/queries/sessions";
import { formatWeightKg } from "@/lib/units";
import { SetRow, type SetStatus } from "./SetRow";

export function ExerciseBlock({
  exercise,
  exerciseName,
  onLogSet,
  onAddSet,
}: {
  exercise: ActiveSessionExercise;
  exerciseName: string;
  onLogSet: (
    setClientId: string,
    setNumber: number,
    isWarmup: boolean,
    result: { reps: number; weightKg: number; rpe: number | null }
  ) => void;
  onAddSet: () => void;
}) {
  const { data: last } = useLastPerformance(exercise.exerciseId);

  // Nothing logged yet on this exercise — dim it so attention stays on
  // whichever exercise is actually in progress, while keeping every set
  // fully interactive (out-of-order logging still works).
  const hasAnyLogged = exercise.sets.some((s) => s.actualReps !== null);
  const firstPendingIndex = exercise.sets.findIndex((s) => s.actualReps === null);

  return (
    <section
      className={`rounded-2xl bg-surface p-3 transition-opacity duration-300 ${hasAnyLogged ? "" : "opacity-60"}`}
    >
      <h2 className="font-display text-sm font-bold text-fg">{exerciseName}</h2>
      <p className="text-xs text-muted">
        Target: {exercise.targetSets ?? "—"} × {exercise.targetRepsMin ?? "?"}–{exercise.targetRepsMax ?? "?"}
        {exercise.targetWeightKg !== null ? ` @ ${formatWeightKg(exercise.targetWeightKg, "lb")}` : ""}
        {exercise.targetRpe !== null ? ` RPE ${exercise.targetRpe}` : ""}
      </p>

      <div className="mt-3 space-y-2">
        {exercise.sets.map((set, i) => {
          const status: SetStatus = set.actualReps !== null ? "done" : i === firstPendingIndex ? "active" : "upcoming";
          const lastSet = last?.sets.find((s) => s.setNumber === set.setNumber);
          return (
            <SetRow
              key={set.clientId}
              status={status}
              setNumber={set.setNumber}
              isWarmup={set.isWarmup}
              actualReps={set.actualReps}
              actualWeightKg={set.actualWeightKg}
              actualRpe={set.actualRpe}
              prefillReps={lastSet?.reps ?? exercise.targetRepsMax}
              prefillWeightKg={lastSet?.weightKg ?? exercise.targetWeightKg}
              prefillRpe={lastSet?.rpe ?? null}
              lastLabel={
                lastSet
                  ? `${lastSet.reps} × ${formatWeightKg(lastSet.weightKg, "lb")}${lastSet.rpe ? ` @ RPE ${lastSet.rpe}` : ""}`
                  : null
              }
              onLog={(result) => onLogSet(set.clientId, set.setNumber, set.isWarmup, result)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2.5 w-full rounded-xl border border-dashed border-surface-raised py-2.5 text-xs font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent active:scale-[0.98]"
      >
        + Add set
      </button>
    </section>
  );
}

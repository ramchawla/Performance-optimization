"use client";

import type { ActiveSessionExercise } from "@/stores/activeSession";
import { useLastPerformance } from "@/lib/queries/sessions";
import { formatWeightKg } from "@/lib/units";
import { SetRow } from "./SetRow";

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

  return (
    <section className="rounded border border-neutral-200 p-3">
      <h2 className="text-sm font-semibold">{exerciseName}</h2>
      <p className="text-xs text-neutral-500">
        Target: {exercise.targetSets ?? "—"} x {exercise.targetRepsMin ?? "?"}–{exercise.targetRepsMax ?? "?"}
        {exercise.targetWeightKg !== null ? ` @ ${formatWeightKg(exercise.targetWeightKg, "lb")}` : ""}
        {exercise.targetRpe !== null ? ` RPE ${exercise.targetRpe}` : ""}
      </p>

      <div className="mt-2 space-y-2">
        {exercise.sets.map((set) => {
          const lastSet = last?.sets.find((s) => s.setNumber === set.setNumber);
          return (
            <SetRow
              key={set.clientId}
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
                  ? `${lastSet.reps} x ${formatWeightKg(lastSet.weightKg, "lb")}${lastSet.rpe ? ` @ RPE ${lastSet.rpe}` : ""}`
                  : null
              }
              onLog={(result) => onLogSet(set.clientId, set.setNumber, set.isWarmup, result)}
            />
          );
        })}
      </div>

      <button type="button" onClick={onAddSet} className="mt-2 text-xs text-blue-600">
        + Add set
      </button>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useTemplateDetail,
  useAddTemplateExercise,
  useUpdateTemplateExercise,
  useRemoveTemplateExercise,
  useReorderTemplateExercises,
  type TemplateExerciseWithName,
} from "@/lib/queries/templates";
import { useStartSession } from "@/lib/queries/sessions";
import { ExercisePicker } from "@/components/train/ExercisePicker";
import { displayWeightKg, inputToKg } from "@/lib/units";

const WEIGHT_UNIT = "lb" as const; // profile-driven unit selection is out of scope for Phase 1

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useTemplateDetail(id);
  const addExercise = useAddTemplateExercise(id);
  const updateExercise = useUpdateTemplateExercise(id);
  const removeExercise = useRemoveTemplateExercise(id);
  const reorderExercises = useReorderTemplateExercises(id);
  const startSession = useStartSession();

  const [showPicker, setShowPicker] = useState(false);
  const [isDeload, setIsDeload] = useState(false);

  if (isLoading || !data) {
    return (
      <main className="p-4">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const { template, exercises } = data;

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    const a = exercises[index];
    const b = exercises[target];
    reorderExercises.mutate([
      { id: a.id, position: b.position },
      { id: b.id, position: a.position },
    ]);
  }

  function toggleSuperset(index: number) {
    const a = exercises[index];
    const b = exercises[index + 1];
    if (!b) return;
    const grouped = a.superset_group !== null && a.superset_group === b.superset_group;
    if (grouped) {
      updateExercise.mutate({ id: a.id, patch: { superset_group: null } });
      updateExercise.mutate({ id: b.id, patch: { superset_group: null } });
    } else {
      const existing = exercises.map((e) => e.superset_group).filter((g): g is number => g !== null);
      const newGroup = existing.length ? Math.max(...existing) + 1 : 1;
      updateExercise.mutate({ id: a.id, patch: { superset_group: newGroup } });
      updateExercise.mutate({ id: b.id, patch: { superset_group: newGroup } });
    }
  }

  async function handleStartSession() {
    const sessionId = await startSession.mutateAsync({
      templateId: template.id,
      templateName: template.name,
      isDeload,
      templateExercises: exercises,
    });
    router.push(`/train/session?sessionId=${sessionId}`);
  }

  return (
    <main className="space-y-4 p-4">
      <h1 className="font-display text-xl font-bold text-fg">{template.name}</h1>

      <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={isDeload}
            onChange={(e) => setIsDeload(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Deload session
        </label>
        <button
          onClick={handleStartSession}
          disabled={startSession.isPending || exercises.length === 0}
          className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
        >
          Start Session
        </button>
      </div>

      <ul className="space-y-3">
        {exercises.map((ex, i) => (
          <ExerciseRow
            key={ex.id}
            exercise={ex}
            index={i}
            isLast={i === exercises.length - 1}
            groupedWithNext={ex.superset_group !== null && ex.superset_group === exercises[i + 1]?.superset_group}
            onMove={(dir) => move(i, dir)}
            onToggleSuperset={() => toggleSuperset(i)}
            onPatch={(patch) => updateExercise.mutate({ id: ex.id, patch })}
            onRemove={() => removeExercise.mutate(ex.id)}
          />
        ))}
      </ul>

      {exercises.length === 0 && (
        <p className="text-sm text-muted">No exercises yet — add one below.</p>
      )}

      <div>
        {showPicker ? (
          <ExercisePicker
            onSelect={(exercise) => {
              const nextPosition = (exercises[exercises.length - 1]?.position ?? 0) + 10;
              addExercise.mutate({ exerciseId: exercise.id, position: nextPosition, restSeconds: exercise.default_rest_seconds });
              setShowPicker(false);
            }}
          />
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            className="w-full rounded-2xl border border-dashed border-surface-raised py-3 text-sm text-muted"
          >
            + Add exercise
          </button>
        )}
      </div>
    </main>
  );
}

function ExerciseRow({
  exercise,
  index,
  isLast,
  groupedWithNext,
  onMove,
  onToggleSuperset,
  onPatch,
  onRemove,
}: {
  exercise: TemplateExerciseWithName;
  index: number;
  isLast: boolean;
  groupedWithNext: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggleSuperset: () => void;
  onPatch: (patch: Record<string, number | string | null>) => void;
  onRemove: () => void;
}) {
  const displayWeight = displayWeightKg(exercise.target_weight_kg, WEIGHT_UNIT);

  const fieldClass =
    "rounded-lg border border-surface-raised bg-surface-raised px-2 py-1 text-fg focus:border-accent focus:outline-none";

  return (
    <li className="rounded-2xl bg-surface p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-xs text-muted disabled:opacity-30" aria-label="Move up">▲</button>
          <button onClick={() => onMove(1)} disabled={isLast} className="text-xs text-muted disabled:opacity-30" aria-label="Move down">▼</button>
        </div>
        <span className="flex-1 text-sm font-medium text-fg">{exercise.exercises?.name ?? "Unknown exercise"}</span>
        <button onClick={onRemove} className="text-xs text-red-400">Remove</button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
        <label className="flex flex-col gap-0.5">
          Sets
          <input
            type="number"
            defaultValue={exercise.target_sets}
            onBlur={(e) => onPatch({ target_sets: Number(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Reps min
          <input
            type="number"
            defaultValue={exercise.target_reps_min ?? ""}
            onBlur={(e) => onPatch({ target_reps_min: e.target.value === "" ? null : Number(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Reps max
          <input
            type="number"
            defaultValue={exercise.target_reps_max ?? ""}
            onBlur={(e) => onPatch({ target_reps_max: e.target.value === "" ? null : Number(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Weight ({WEIGHT_UNIT})
          <input
            type="number"
            defaultValue={displayWeight ?? ""}
            onBlur={(e) =>
              onPatch({ target_weight_kg: e.target.value === "" ? null : inputToKg(Number(e.target.value), WEIGHT_UNIT) })
            }
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          RPE
          <input
            type="number"
            step="0.5"
            defaultValue={exercise.target_rpe ?? ""}
            onBlur={(e) => onPatch({ target_rpe: e.target.value === "" ? null : Number(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Rest (s)
          <input
            type="number"
            defaultValue={exercise.rest_seconds ?? ""}
            onBlur={(e) => onPatch({ rest_seconds: e.target.value === "" ? null : Number(e.target.value) })}
            className={fieldClass}
          />
        </label>
      </div>

      {!isLast && (
        <button onClick={onToggleSuperset} className="mt-2 text-xs text-accent">
          {groupedWithNext ? "Ungroup from next" : "Group with next (superset)"}
        </button>
      )}
    </li>
  );
}

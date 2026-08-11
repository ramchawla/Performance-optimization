"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type TemplateExerciseWithName } from "@/lib/queries/templates";
import { ExercisePicker } from "@/components/train/ExercisePicker";
import { displayWeightKg, inputToKg } from "@/lib/units";
import { MOCK_TEMPLATE_DETAILS, MOCK_TEMPLATES } from "@/lib/mock/trainMock";

const WEIGHT_UNIT = "lb" as const; // profile-driven unit selection is out of scope for Phase 1

type RenderGroup =
  | { type: "single"; exercise: TemplateExerciseWithName; index: number }
  | { type: "superset"; items: Array<{ exercise: TemplateExerciseWithName; index: number }> };

/** Collapses consecutive same-superset_group runs into one visual grouping —
 * the underlying flat, position-ordered array (and its indices) is untouched. */
function groupForDisplay(exercises: TemplateExerciseWithName[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  let i = 0;
  while (i < exercises.length) {
    const exercise = exercises[i];
    if (exercise.superset_group !== null) {
      const items = [{ exercise, index: i }];
      let j = i + 1;
      while (j < exercises.length && exercises[j].superset_group === exercise.superset_group) {
        items.push({ exercise: exercises[j], index: j });
        j++;
      }
      if (items.length > 1) {
        groups.push({ type: "superset", items });
        i = j;
        continue;
      }
    }
    groups.push({ type: "single", exercise, index: i });
    i++;
  }
  return groups;
}

// ponytail: rendering MOCK_TEMPLATE_DETAILS from local state instead of
// useTemplateDetail(id) — no seed data locally, this is a visual preview.
// Reorder/superset/field edits mutate local state only (no network); "Start
// Session" navigates straight to /train/session, which seeds its own mock
// active session, instead of calling useStartSession. Swap back to the real
// hooks (useTemplateDetail, useAddTemplateExercise, useUpdateTemplateExercise,
// useRemoveTemplateExercise, useReorderTemplateExercises, useStartSession)
// once templates/exercises are seeded in the real DB.
export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const detail = MOCK_TEMPLATE_DETAILS[id] ?? MOCK_TEMPLATE_DETAILS[MOCK_TEMPLATES[0].id];
  const template = detail.template;
  const [exercises, setExercises] = useState<TemplateExerciseWithName[]>(detail.exercises);

  const [showPicker, setShowPicker] = useState(false);
  const [isDeload, setIsDeload] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function patchExercise(id: string, patch: Record<string, number | string | null>) {
    setExercises((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...patch } as TemplateExerciseWithName) : e)));
  }

  function toggleSuperset(index: number) {
    const a = exercises[index];
    const b = exercises[index + 1];
    if (!b) return;
    const grouped = a.superset_group !== null && a.superset_group === b.superset_group;
    if (grouped) {
      patchExercise(a.id, { superset_group: null });
      patchExercise(b.id, { superset_group: null });
    } else {
      const existing = exercises.map((e) => e.superset_group).filter((g): g is number => g !== null);
      const newGroup = existing.length ? Math.max(...existing) + 1 : 1;
      patchExercise(a.id, { superset_group: newGroup });
      patchExercise(b.id, { superset_group: newGroup });
    }
  }

  function handleStartSession() {
    router.push("/train/session");
  }

  const groups = groupForDisplay(exercises);

  return (
    <main className="space-y-4 p-4">
      <Link href="/train/templates" className="inline-block text-xs text-muted transition-colors hover:text-fg">
        ← Templates
      </Link>
      <h1 className="font-display text-xl font-bold tracking-tight text-fg">{template.name}</h1>

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
          disabled={exercises.length === 0}
          className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg transition-transform duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          Start Session
        </button>
      </div>

      <ul className="stagger space-y-3">
        {groups.map((g, gi) =>
          g.type === "single" ? (
            <ExerciseRow
              key={g.exercise.id}
              exercise={g.exercise}
              index={g.index}
              isLast={g.index === exercises.length - 1}
              groupedWithNext={
                g.exercise.superset_group !== null && g.exercise.superset_group === exercises[g.index + 1]?.superset_group
              }
              onMove={(dir) => move(g.index, dir)}
              onToggleSuperset={() => toggleSuperset(g.index)}
              onPatch={(patch) => patchExercise(g.exercise.id, patch)}
              onRemove={() => setExercises((prev) => prev.filter((e) => e.id !== g.exercise.id))}
            />
          ) : (
            <li key={`superset-${gi}`} className="rounded-2xl border border-accent/30 bg-accent/5 p-2">
              <div className="mb-2 px-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                ⚡ Superset
              </div>
              <ul className="space-y-2">
                {g.items.map(({ exercise, index }) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                    isLast={index === exercises.length - 1}
                    groupedWithNext={exercise.superset_group !== null && exercise.superset_group === exercises[index + 1]?.superset_group}
                    onMove={(dir) => move(index, dir)}
                    onToggleSuperset={() => toggleSuperset(index)}
                    onPatch={(patch) => patchExercise(exercise.id, patch)}
                    onRemove={() => setExercises((prev) => prev.filter((e) => e.id !== exercise.id))}
                    nested
                  />
                ))}
              </ul>
            </li>
          )
        )}
      </ul>

      {exercises.length === 0 && (
        <p className="text-sm text-muted">No exercises yet — add one below.</p>
      )}

      <div>
        {showPicker ? (
          <ExercisePicker
            onSelect={(exercise) => {
              const nextPosition = (exercises[exercises.length - 1]?.position ?? 0) + 10;
              setExercises((prev) => [
                ...prev,
                {
                  id: `te-preview-${prev.length}`,
                  template_id: template.id,
                  exercise_id: exercise.id,
                  position: nextPosition,
                  superset_group: null,
                  target_sets: 3,
                  target_reps_min: null,
                  target_reps_max: null,
                  target_weight_kg: null,
                  target_rpe: null,
                  rest_seconds: exercise.default_rest_seconds,
                  notes: null,
                  exercises: { name: exercise.name },
                },
              ]);
              setShowPicker(false);
            }}
          />
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            className="w-full rounded-2xl border border-dashed border-surface-raised py-3 text-sm text-muted transition-colors duration-150 hover:border-accent hover:text-accent active:scale-[0.98]"
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
  nested = false,
}: {
  exercise: TemplateExerciseWithName;
  index: number;
  isLast: boolean;
  groupedWithNext: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggleSuperset: () => void;
  onPatch: (patch: Record<string, number | string | null>) => void;
  onRemove: () => void;
  nested?: boolean;
}) {
  const displayWeight = displayWeightKg(exercise.target_weight_kg, WEIGHT_UNIT);

  const fieldClass =
    "rounded-lg border border-surface-raised bg-surface-raised px-2 py-1 font-mono tabular-nums text-fg focus:border-accent focus:outline-none";

  return (
    <li
      className={`rounded-2xl p-3 transition-colors duration-150 ${
        nested ? "bg-surface-raised" : "bg-surface hover:bg-surface-raised/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 text-sm tracking-widest text-muted">⋮⋮</span>
        <div className="flex flex-col">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-xs text-muted transition-transform duration-150 hover:text-fg active:scale-90 disabled:opacity-30" aria-label="Move up">▲</button>
          <button onClick={() => onMove(1)} disabled={isLast} className="text-xs text-muted transition-transform duration-150 hover:text-fg active:scale-90 disabled:opacity-30" aria-label="Move down">▼</button>
        </div>
        <span className="flex-1 text-sm font-bold text-fg">{exercise.exercises?.name ?? "Unknown exercise"}</span>
        <button onClick={onRemove} className="text-xs text-red-400 transition-transform duration-150 hover:brightness-110 active:scale-90">Remove</button>
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
        <button onClick={onToggleSuperset} className="mt-2 text-xs font-medium text-accent transition-transform duration-150 hover:brightness-110 active:scale-[0.98]">
          {groupedWithNext ? "Ungroup from next" : "Group with next (superset)"}
        </button>
      )}
    </li>
  );
}

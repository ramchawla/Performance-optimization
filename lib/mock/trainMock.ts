/**
 * Preview-only mock data for the Train tab (templates, active session, history).
 * There's no seed data locally, so the real Supabase-backed hooks in
 * lib/queries/templates.ts and lib/queries/sessions.ts render empty. This
 * mirrors lib/mock/dashboardMock.ts: static objects shaped exactly like the
 * query hooks' return types (see supabase/migrations/0001_init.sql +
 * lib/database.types.ts), imported directly by the pages instead of calling
 * the hooks.
 * ponytail: swap back to useTemplates/useTemplateDetail/useSessionHistory/
 * useSessionDetail + a real useActiveSessionStore-seeded session once
 * exercises/templates/sessions are seeded in the real DB.
 */
import type { Database } from "@/lib/database.types";
import type { Template, TemplateExerciseWithName } from "@/lib/queries/templates";
import type { SessionDetailExercise } from "@/lib/queries/sessions";
import type { ActiveSession, ActiveSessionExercise, ActiveSet } from "@/stores/activeSession";

type WorkoutSession = Database["public"]["Tables"]["workout_sessions"]["Row"];

// Fixed pool of exercises reused across templates/sessions/history so names
// stay consistent everywhere they're referenced.
const EX = {
  bench: { id: "ex-bench-press", name: "Barbell Bench Press" },
  incline: { id: "ex-incline-db-press", name: "Incline Dumbbell Press" },
  ohp: { id: "ex-ohp", name: "Overhead Press" },
  dip: { id: "ex-dip", name: "Weighted Dip" },
  squat: { id: "ex-back-squat", name: "Back Squat" },
  deadlift: { id: "ex-deadlift", name: "Conventional Deadlift" },
  legPress: { id: "ex-leg-press", name: "Leg Press" },
  legCurl: { id: "ex-leg-curl", name: "Seated Leg Curl" },
  row: { id: "ex-barbell-row", name: "Barbell Row" },
  pullup: { id: "ex-pullup", name: "Weighted Pull-up" },
  latPulldown: { id: "ex-lat-pulldown", name: "Lat Pulldown" },
  curl: { id: "ex-db-curl", name: "Dumbbell Curl" },
  tricepPush: { id: "ex-triceps-pushdown", name: "Triceps Pushdown" },
  facePull: { id: "ex-face-pull", name: "Face Pull" },
} as const;

export const MOCK_EXERCISE_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(EX).map((e) => [e.id, e.name])
);

const USER_ID = "00000000-0000-0000-0000-000000000001";

function tplExercise(
  templateId: string,
  position: number,
  exercise: { id: string; name: string },
  overrides: Partial<Database["public"]["Tables"]["template_exercises"]["Row"]> = {}
): TemplateExerciseWithName {
  return {
    id: `${templateId}-te-${position}`,
    template_id: templateId,
    exercise_id: exercise.id,
    position,
    superset_group: null,
    target_sets: 3,
    target_reps_min: 6,
    target_reps_max: 10,
    target_weight_kg: 60,
    target_rpe: 8,
    rest_seconds: 120,
    notes: null,
    ...overrides,
    exercises: { name: exercise.name },
  };
}

function template(id: string, position: number, name: string, description: string): Template {
  return {
    id,
    user_id: USER_ID,
    name,
    description,
    position,
    archived_at: null,
    created_at: "2026-05-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
  };
}

const PUSH_ID = "tpl-push-a";
const PULL_ID = "tpl-pull-a";
const LEGS_ID = "tpl-legs-a";
const UPPER_ID = "tpl-upper-b";
const DELOAD_ID = "tpl-full-body-deload";

export const MOCK_TEMPLATES: Template[] = [
  template(PUSH_ID, 10, "Push Day A", "Chest, shoulders, triceps — heavy bench focus"),
  template(PULL_ID, 20, "Pull Day A", "Back and biceps — vertical + horizontal pulling"),
  template(LEGS_ID, 30, "Legs Day A", "Squat-focused lower body"),
  template(UPPER_ID, 40, "Upper Body B", "Second upper session — volume accessories"),
  template(DELOAD_ID, 50, "Full Body Deload", "Light full-body session for deload weeks"),
];

export const MOCK_TEMPLATE_DETAILS: Record<string, { template: Template; exercises: TemplateExerciseWithName[] }> = {
  [PUSH_ID]: {
    template: MOCK_TEMPLATES[0],
    exercises: [
      tplExercise(PUSH_ID, 10, EX.bench, { target_sets: 4, target_reps_min: 5, target_reps_max: 5, target_weight_kg: 100 }),
      tplExercise(PUSH_ID, 20, EX.ohp, { target_sets: 3, target_reps_min: 6, target_reps_max: 8, target_weight_kg: 55 }),
      tplExercise(PUSH_ID, 30, EX.incline, { target_sets: 3, target_reps_min: 8, target_reps_max: 10, target_weight_kg: 32, superset_group: 1 }),
      tplExercise(PUSH_ID, 40, EX.facePull, { target_sets: 3, target_reps_min: 12, target_reps_max: 15, target_weight_kg: 20, superset_group: 1, rest_seconds: 60 }),
      tplExercise(PUSH_ID, 50, EX.tricepPush, { target_sets: 3, target_reps_min: 10, target_reps_max: 12, target_weight_kg: 27.5, rest_seconds: 90 }),
    ],
  },
  [PULL_ID]: {
    template: MOCK_TEMPLATES[1],
    exercises: [
      tplExercise(PULL_ID, 10, EX.deadlift, { target_sets: 3, target_reps_min: 3, target_reps_max: 5, target_weight_kg: 150 }),
      tplExercise(PULL_ID, 20, EX.row, { target_sets: 4, target_reps_min: 6, target_reps_max: 8, target_weight_kg: 80 }),
      tplExercise(PULL_ID, 30, EX.pullup, { target_sets: 3, target_reps_min: 6, target_reps_max: 10, target_weight_kg: 10 }),
      tplExercise(PULL_ID, 40, EX.curl, { target_sets: 3, target_reps_min: 10, target_reps_max: 12, target_weight_kg: 14, rest_seconds: 60 }),
    ],
  },
  [LEGS_ID]: {
    template: MOCK_TEMPLATES[2],
    exercises: [
      tplExercise(LEGS_ID, 10, EX.squat, { target_sets: 4, target_reps_min: 4, target_reps_max: 6, target_weight_kg: 135 }),
      tplExercise(LEGS_ID, 20, EX.legPress, { target_sets: 3, target_reps_min: 8, target_reps_max: 12, target_weight_kg: 180 }),
      tplExercise(LEGS_ID, 30, EX.legCurl, { target_sets: 3, target_reps_min: 10, target_reps_max: 12, target_weight_kg: 45, rest_seconds: 75 }),
    ],
  },
  [UPPER_ID]: {
    template: MOCK_TEMPLATES[3],
    exercises: [
      tplExercise(UPPER_ID, 10, EX.dip, { target_sets: 3, target_reps_min: 8, target_reps_max: 10, target_weight_kg: 15 }),
      tplExercise(UPPER_ID, 20, EX.latPulldown, { target_sets: 3, target_reps_min: 10, target_reps_max: 12, target_weight_kg: 60, superset_group: 1 }),
      tplExercise(UPPER_ID, 30, EX.curl, { target_sets: 3, target_reps_min: 10, target_reps_max: 12, target_weight_kg: 14, superset_group: 1, rest_seconds: 60 }),
    ],
  },
  [DELOAD_ID]: {
    template: MOCK_TEMPLATES[4],
    exercises: [
      tplExercise(DELOAD_ID, 10, EX.squat, { target_sets: 2, target_reps_min: 8, target_reps_max: 10, target_weight_kg: 80, notes: "~50% of working weight" }),
      tplExercise(DELOAD_ID, 20, EX.bench, { target_sets: 2, target_reps_min: 8, target_reps_max: 10, target_weight_kg: 60 }),
      tplExercise(DELOAD_ID, 30, EX.row, { target_sets: 2, target_reps_min: 8, target_reps_max: 10, target_weight_kg: 45 }),
    ],
  },
};

// ---------------------------------------------------------------------------
// Active session — a Push Day A session in progress: first two exercises
// fully logged, third partially logged, fourth/fifth not started.
// ---------------------------------------------------------------------------

function loggedSet(setNumber: number, reps: number, weightKg: number, rpe: number | null): ActiveSet {
  return {
    clientId: `set-${setNumber}-${weightKg}`,
    setNumber,
    isWarmup: false,
    actualReps: reps,
    actualWeightKg: weightKg,
    actualRpe: rpe,
    completedAt: "2026-08-08T15:00:00.000Z",
  };
}

function pendingSet(setNumber: number): ActiveSet {
  return {
    clientId: `set-pending-${setNumber}-${Math.random()}`,
    setNumber,
    isWarmup: false,
    actualReps: null,
    actualWeightKg: null,
    actualRpe: null,
    completedAt: null,
  };
}

function activeExercise(
  clientId: string,
  exercise: { id: string; name: string },
  position: number,
  loggedSets: Array<[reps: number, weightKg: number, rpe: number | null]>,
  pendingCount: number,
  overrides: Partial<ActiveSessionExercise> = {}
): ActiveSessionExercise {
  const sets: ActiveSet[] = [
    ...loggedSets.map(([reps, weightKg, rpe], i) => loggedSet(i + 1, reps, weightKg, rpe)),
    ...Array.from({ length: pendingCount }, (_, i) => pendingSet(loggedSets.length + i + 1)),
  ];
  return {
    clientId,
    exerciseId: exercise.id,
    position,
    supersetGroup: null,
    targetSets: sets.length,
    targetRepsMin: 6,
    targetRepsMax: 10,
    targetWeightKg: loggedSets[0]?.[1] ?? 60,
    targetRpe: 8,
    restSeconds: 120,
    sets,
    ...overrides,
  };
}

export const MOCK_ACTIVE_SESSION: ActiveSession = {
  clientId: "session-active-preview",
  templateId: PUSH_ID,
  templateNameSnapshot: "Push Day A",
  startedAt: "2026-08-08T14:32:00.000Z",
  isDeload: false,
  bodyweightKg: 84.1,
  exercises: [
    activeExercise("ase-bench", EX.bench, 10, [
      [5, 100, 8],
      [5, 100, 8.5],
      [5, 102.5, 9],
      [4, 102.5, 9.5],
    ], 0, { targetRepsMin: 5, targetRepsMax: 5 }),
    activeExercise("ase-ohp", EX.ohp, 20, [
      [7, 55, 7.5],
      [6, 55, 8],
    ], 1, { targetSets: 3 }),
    activeExercise(
      "ase-incline",
      EX.incline,
      30,
      [[9, 32, 7]],
      2,
      { supersetGroup: 1, targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, targetWeightKg: 32 }
    ),
    activeExercise("ase-facepull", EX.facePull, 40, [], 3, {
      supersetGroup: 1,
      targetSets: 3,
      targetRepsMin: 12,
      targetRepsMax: 15,
      targetWeightKg: 20,
      restSeconds: 60,
    }),
    activeExercise("ase-tricep", EX.tricepPush, 50, [], 3, {
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 12,
      targetWeightKg: 27.5,
      restSeconds: 90,
    }),
  ],
};

// ---------------------------------------------------------------------------
// History — ~14 completed sessions over the last 5 weeks, 2 marked deload.
// Extra volumeKg/durationMin fields are carried for realism even though the
// current history list UI doesn't render them yet.
// ---------------------------------------------------------------------------

export type MockHistorySession = WorkoutSession & { volumeKg: number; durationMin: number };

interface HistoryPlan {
  id: string;
  daysAgo: number;
  templateId: string;
  templateName: string;
  isDeload: boolean;
  bodyweightKg: number;
  exercises: Array<{ ex: { id: string; name: string }; sets: Array<[reps: number, weightKg: number, rpe: number]> }>;
}

const HISTORY_PLANS: HistoryPlan[] = [
  { id: "hist-1", daysAgo: 1, templateId: PULL_ID, templateName: "Pull Day A", isDeload: false, bodyweightKg: 84.2, exercises: [
    { ex: EX.deadlift, sets: [[5, 145, 8], [5, 147.5, 8.5], [4, 150, 9]] },
    { ex: EX.row, sets: [[8, 77.5, 7], [8, 80, 7.5], [7, 80, 8]] },
    { ex: EX.pullup, sets: [[9, 10, 8], [8, 10, 8.5], [7, 10, 9]] },
  ] },
  { id: "hist-2", daysAgo: 3, templateId: LEGS_ID, templateName: "Legs Day A", isDeload: false, bodyweightKg: 84.0, exercises: [
    { ex: EX.squat, sets: [[6, 130, 7.5], [5, 135, 8], [5, 135, 8.5], [4, 137.5, 9]] },
    { ex: EX.legPress, sets: [[12, 175, 7], [11, 180, 8], [10, 180, 8.5]] },
    { ex: EX.legCurl, sets: [[12, 42.5, 7], [11, 45, 8], [10, 45, 8]] },
  ] },
  { id: "hist-3", daysAgo: 4, templateId: PUSH_ID, templateName: "Push Day A", isDeload: false, bodyweightKg: 83.9, exercises: [
    { ex: EX.bench, sets: [[5, 97.5, 8], [5, 100, 8.5], [5, 100, 9], [4, 100, 9.5]] },
    { ex: EX.ohp, sets: [[7, 52.5, 7.5], [6, 55, 8], [6, 55, 8]] },
    { ex: EX.incline, sets: [[10, 30, 7], [9, 32, 7.5], [8, 32, 8]] },
  ] },
  { id: "hist-4", daysAgo: 8, templateId: PULL_ID, templateName: "Pull Day A", isDeload: false, bodyweightKg: 84.4, exercises: [
    { ex: EX.deadlift, sets: [[5, 142.5, 8], [5, 145, 8.5], [4, 147.5, 9]] },
    { ex: EX.row, sets: [[8, 75, 7], [8, 77.5, 7.5], [7, 77.5, 8]] },
  ] },
  { id: "hist-5", daysAgo: 10, templateId: LEGS_ID, templateName: "Legs Day A", isDeload: false, bodyweightKg: 84.3, exercises: [
    { ex: EX.squat, sets: [[6, 127.5, 7.5], [5, 132.5, 8], [5, 132.5, 8.5]] },
    { ex: EX.legPress, sets: [[12, 170, 7], [11, 175, 7.5], [10, 175, 8]] },
  ] },
  { id: "hist-6", daysAgo: 11, templateId: PUSH_ID, templateName: "Push Day A", isDeload: false, bodyweightKg: 84.1, exercises: [
    { ex: EX.bench, sets: [[5, 95, 7.5], [5, 97.5, 8], [5, 97.5, 8.5], [5, 97.5, 9]] },
    { ex: EX.ohp, sets: [[7, 50, 7], [7, 52.5, 7.5], [6, 52.5, 8]] },
  ] },
  { id: "hist-7", daysAgo: 15, templateId: PULL_ID, templateName: "Pull Day A", isDeload: false, bodyweightKg: 84.6, exercises: [
    { ex: EX.deadlift, sets: [[5, 140, 8], [5, 142.5, 8.5], [4, 145, 9]] },
    { ex: EX.pullup, sets: [[8, 7.5, 8], [7, 7.5, 8.5], [6, 7.5, 9]] },
  ] },
  { id: "hist-8", daysAgo: 17, templateId: DELOAD_ID, templateName: "Full Body Deload", isDeload: true, bodyweightKg: 84.5, exercises: [
    { ex: EX.squat, sets: [[10, 75, 5], [10, 80, 5]] },
    { ex: EX.bench, sets: [[10, 55, 5], [10, 60, 5]] },
    { ex: EX.row, sets: [[10, 40, 5], [10, 45, 5]] },
  ] },
  { id: "hist-9", daysAgo: 18, templateId: UPPER_ID, templateName: "Upper Body B", isDeload: false, bodyweightKg: 84.7, exercises: [
    { ex: EX.dip, sets: [[9, 12.5, 7], [8, 15, 7.5], [7, 15, 8]] },
    { ex: EX.latPulldown, sets: [[11, 57.5, 7], [10, 60, 7.5], [10, 60, 8]] },
  ] },
  { id: "hist-10", daysAgo: 22, templateId: LEGS_ID, templateName: "Legs Day A", isDeload: false, bodyweightKg: 85.0, exercises: [
    { ex: EX.squat, sets: [[6, 125, 7.5], [5, 130, 8], [5, 130, 8.5]] },
    { ex: EX.legCurl, sets: [[12, 40, 7], [11, 42.5, 7.5], [10, 42.5, 8]] },
  ] },
  { id: "hist-11", daysAgo: 24, templateId: PUSH_ID, templateName: "Push Day A", isDeload: false, bodyweightKg: 85.1, exercises: [
    { ex: EX.bench, sets: [[5, 92.5, 7.5], [5, 95, 8], [5, 95, 8.5], [5, 95, 9]] },
    { ex: EX.tricepPush, sets: [[11, 25, 7], [10, 27.5, 7.5], [10, 27.5, 8]] },
  ] },
  { id: "hist-12", daysAgo: 29, templateId: PULL_ID, templateName: "Pull Day A", isDeload: false, bodyweightKg: 85.3, exercises: [
    { ex: EX.deadlift, sets: [[5, 137.5, 8], [5, 140, 8.5], [4, 142.5, 9]] },
    { ex: EX.row, sets: [[8, 72.5, 7], [8, 75, 7.5], [7, 75, 8]] },
  ] },
  { id: "hist-13", daysAgo: 31, templateId: DELOAD_ID, templateName: "Full Body Deload", isDeload: true, bodyweightKg: 85.4, exercises: [
    { ex: EX.squat, sets: [[10, 70, 5], [10, 75, 5]] },
    { ex: EX.bench, sets: [[10, 52.5, 5], [10, 55, 5]] },
  ] },
  { id: "hist-14", daysAgo: 33, templateId: LEGS_ID, templateName: "Legs Day A", isDeload: false, bodyweightKg: 85.5, exercises: [
    { ex: EX.squat, sets: [[6, 122.5, 7.5], [5, 127.5, 8], [5, 127.5, 8.5]] },
    { ex: EX.legPress, sets: [[12, 165, 7], [11, 170, 7.5]] },
  ] },
];

function isoDaysAgo(daysAgo: number, hour: number): string {
  const d = new Date(Date.UTC(2026, 7, 8, hour, 0, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function buildHistoryEntry(plan: HistoryPlan): { session: MockHistorySession; exercises: SessionDetailExercise[] } {
  const durationMin = 40 + plan.exercises.length * 8;
  const startedAt = isoDaysAgo(plan.daysAgo, 17);
  const completedAt = isoDaysAgo(plan.daysAgo, 17 + Math.floor(durationMin / 60));
  const volumeKg = plan.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, [reps, weightKg]) => s + reps * weightKg, 0),
    0
  );

  const exercises: SessionDetailExercise[] = plan.exercises.map((e, i) => ({
    id: `${plan.id}-se-${i}`,
    exerciseName: e.ex.name,
    targetSets: e.sets.length,
    targetRepsMin: Math.min(...e.sets.map(([reps]) => reps)),
    targetRepsMax: Math.max(...e.sets.map(([reps]) => reps)),
    targetWeightKg: e.sets[0][1],
    targetRpe: 8,
    sets: e.sets.map(([reps, weightKg, rpe], setNumber) => ({
      setNumber: setNumber + 1,
      isWarmup: false,
      actualReps: reps,
      actualWeightKg: weightKg,
      actualRpe: rpe,
    })),
  }));

  const session: MockHistorySession = {
    id: plan.id,
    client_id: plan.id,
    user_id: USER_ID,
    template_id: plan.templateId,
    template_name_snapshot: plan.templateName,
    started_at: startedAt,
    completed_at: completedAt,
    is_deload: plan.isDeload,
    bodyweight_kg: plan.bodyweightKg,
    notes: null,
    updated_at: completedAt,
    volumeKg: Math.round(volumeKg),
    durationMin,
  };

  return { session, exercises };
}

const HISTORY_ENTRIES = HISTORY_PLANS.map(buildHistoryEntry);

export const MOCK_HISTORY: MockHistorySession[] = HISTORY_ENTRIES.map((e) => e.session);

export const MOCK_HISTORY_DETAILS: Record<string, { session: MockHistorySession; exercises: SessionDetailExercise[] }> =
  Object.fromEntries(HISTORY_ENTRIES.map((e) => [e.session.id, e]));

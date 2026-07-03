/**
 * System exercise library seed data (user_id = null rows in `exercises`).
 * Covers the standard Push/Pull/Legs pool plus common variants. Run via
 * scripts/seed-exercises.ts once Supabase env vars are configured.
 *
 * muscle_groups uses a flat tag vocabulary — keep it consistent so
 * lib/calc and any future muscle-group filtering can rely on exact matches.
 */

export interface SeedExercise {
  name: string;
  muscleGroups: string[];
  equipment: "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight";
  isUnilateral?: boolean;
  defaultRestSeconds?: number;
}

export const SEED_EXERCISES: SeedExercise[] = [
  // ---- Push: chest ----
  { name: "Barbell Bench Press", muscleGroups: ["chest", "triceps", "front_delts"], equipment: "barbell", defaultRestSeconds: 180 },
  { name: "Incline Barbell Bench Press", muscleGroups: ["chest", "front_delts", "triceps"], equipment: "barbell", defaultRestSeconds: 180 },
  { name: "Flat Dumbbell Press", muscleGroups: ["chest", "triceps", "front_delts"], equipment: "dumbbell", defaultRestSeconds: 150 },
  { name: "Incline Dumbbell Press", muscleGroups: ["chest", "front_delts", "triceps"], equipment: "dumbbell", defaultRestSeconds: 150 },
  { name: "Cable Chest Fly", muscleGroups: ["chest"], equipment: "cable", defaultRestSeconds: 90 },
  { name: "Pec Deck Machine", muscleGroups: ["chest"], equipment: "machine", defaultRestSeconds: 90 },
  { name: "Dips (Chest-Focused)", muscleGroups: ["chest", "triceps"], equipment: "bodyweight", defaultRestSeconds: 150 },
  { name: "Push-Up", muscleGroups: ["chest", "triceps", "front_delts"], equipment: "bodyweight", defaultRestSeconds: 90 },

  // ---- Push: shoulders ----
  { name: "Overhead Barbell Press", muscleGroups: ["shoulders", "triceps"], equipment: "barbell", defaultRestSeconds: 180 },
  { name: "Seated Dumbbell Shoulder Press", muscleGroups: ["shoulders", "triceps"], equipment: "dumbbell", defaultRestSeconds: 150 },
  { name: "Dumbbell Lateral Raise", muscleGroups: ["side_delts"], equipment: "dumbbell", defaultRestSeconds: 60 },
  { name: "Cable Lateral Raise", muscleGroups: ["side_delts"], equipment: "cable", isUnilateral: true, defaultRestSeconds: 60 },
  { name: "Rear Delt Cable Fly", muscleGroups: ["rear_delts"], equipment: "cable", defaultRestSeconds: 60 },
  { name: "Face Pull", muscleGroups: ["rear_delts", "traps"], equipment: "cable", defaultRestSeconds: 60 },

  // ---- Push: triceps ----
  { name: "Cable Triceps Pushdown", muscleGroups: ["triceps"], equipment: "cable", defaultRestSeconds: 90 },
  { name: "Overhead Cable Triceps Extension", muscleGroups: ["triceps"], equipment: "cable", defaultRestSeconds: 90 },
  { name: "Skull Crushers", muscleGroups: ["triceps"], equipment: "barbell", defaultRestSeconds: 90 },
  { name: "Close-Grip Bench Press", muscleGroups: ["triceps", "chest"], equipment: "barbell", defaultRestSeconds: 150 },

  // ---- Pull: back ----
  { name: "Barbell Deadlift", muscleGroups: ["back", "hamstrings", "glutes"], equipment: "barbell", defaultRestSeconds: 240 },
  { name: "Pull-Up", muscleGroups: ["back", "biceps"], equipment: "bodyweight", defaultRestSeconds: 150 },
  { name: "Lat Pulldown", muscleGroups: ["back", "biceps"], equipment: "cable", defaultRestSeconds: 120 },
  { name: "Barbell Bent-Over Row", muscleGroups: ["back", "biceps"], equipment: "barbell", defaultRestSeconds: 150 },
  { name: "Single-Arm Dumbbell Row", muscleGroups: ["back", "biceps"], equipment: "dumbbell", isUnilateral: true, defaultRestSeconds: 120 },
  { name: "Seated Cable Row", muscleGroups: ["back", "biceps"], equipment: "cable", defaultRestSeconds: 120 },
  { name: "T-Bar Row", muscleGroups: ["back", "biceps"], equipment: "barbell", defaultRestSeconds: 150 },
  { name: "Chest-Supported Row", muscleGroups: ["back", "biceps"], equipment: "machine", defaultRestSeconds: 120 },
  { name: "Straight-Arm Cable Pulldown", muscleGroups: ["back"], equipment: "cable", defaultRestSeconds: 90 },

  // ---- Pull: biceps ----
  { name: "Barbell Curl", muscleGroups: ["biceps"], equipment: "barbell", defaultRestSeconds: 90 },
  { name: "Dumbbell Hammer Curl", muscleGroups: ["biceps", "forearms"], equipment: "dumbbell", defaultRestSeconds: 90 },
  { name: "Incline Dumbbell Curl", muscleGroups: ["biceps"], equipment: "dumbbell", defaultRestSeconds: 90 },
  { name: "Cable Curl", muscleGroups: ["biceps"], equipment: "cable", defaultRestSeconds: 90 },
  { name: "Preacher Curl", muscleGroups: ["biceps"], equipment: "barbell", defaultRestSeconds: 90 },

  // ---- Legs: quads/glutes ----
  { name: "Barbell Back Squat", muscleGroups: ["quads", "glutes"], equipment: "barbell", defaultRestSeconds: 240 },
  { name: "Barbell Front Squat", muscleGroups: ["quads", "glutes"], equipment: "barbell", defaultRestSeconds: 210 },
  { name: "Leg Press", muscleGroups: ["quads", "glutes"], equipment: "machine", defaultRestSeconds: 180 },
  { name: "Walking Lunge", muscleGroups: ["quads", "glutes"], equipment: "dumbbell", isUnilateral: true, defaultRestSeconds: 120 },
  { name: "Bulgarian Split Squat", muscleGroups: ["quads", "glutes"], equipment: "dumbbell", isUnilateral: true, defaultRestSeconds: 120 },
  { name: "Leg Extension", muscleGroups: ["quads"], equipment: "machine", defaultRestSeconds: 90 },
  { name: "Hip Thrust", muscleGroups: ["glutes"], equipment: "barbell", defaultRestSeconds: 150 },
  { name: "Cable Glute Kickback", muscleGroups: ["glutes"], equipment: "cable", isUnilateral: true, defaultRestSeconds: 90 },

  // ---- Legs: hamstrings/calves ----
  { name: "Romanian Deadlift", muscleGroups: ["hamstrings", "glutes"], equipment: "barbell", defaultRestSeconds: 180 },
  { name: "Seated Leg Curl", muscleGroups: ["hamstrings"], equipment: "machine", defaultRestSeconds: 90 },
  { name: "Lying Leg Curl", muscleGroups: ["hamstrings"], equipment: "machine", defaultRestSeconds: 90 },
  { name: "Standing Calf Raise", muscleGroups: ["calves"], equipment: "machine", defaultRestSeconds: 60 },
  { name: "Seated Calf Raise", muscleGroups: ["calves"], equipment: "machine", defaultRestSeconds: 60 },

  // ---- Core ----
  { name: "Hanging Leg Raise", muscleGroups: ["core"], equipment: "bodyweight", defaultRestSeconds: 90 },
  { name: "Cable Crunch", muscleGroups: ["core"], equipment: "cable", defaultRestSeconds: 90 },
  { name: "Plank", muscleGroups: ["core"], equipment: "bodyweight", defaultRestSeconds: 60 },
  { name: "Ab Wheel Rollout", muscleGroups: ["core"], equipment: "bodyweight", defaultRestSeconds: 90 },
];

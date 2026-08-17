/**
 * Mobility preset library.
 *
 * Authored content, not user data — hence a static file rather than a table.
 * There is deliberately no in-app editor: adding a routine is a code change,
 * which is the right cost for something edited a few times a year.
 *
 * `minutes` is the nominal slot the routine fills; the exercise seconds sum to
 * roughly that, allowing for transitions.
 */

export type BodyPart =
  | "hips"
  | "low_back"
  | "shoulders"
  | "t_spine"
  | "knees"
  | "ankles"
  | "hamstrings"
  | "neck"
  | "chest";

/**
 * Only gear that genuinely gates a routine. A mat, a wall, a chair and a floor
 * are assumed — listing them would make every filter a formality.
 */
export type Equipment = "none" | "band" | "foam_roller";

export type Condition =
  | "jumpers_knee"
  | "rounded_shoulders"
  | "anterior_pelvic_tilt"
  | "tight_hip_flexors"
  | "ankle_stiffness";

export type Duration = 5 | 10 | 15 | 20 | 30;

export interface PresetExercise {
  name: string;
  seconds: number;
  /** Run the block once per side — the player doubles the time and prompts the switch. */
  perSide?: boolean;
  cue?: string;
}

export interface Preset {
  id: string;
  name: string;
  minutes: Duration;
  /** Everything this routine requires. `["none"]` means bodyweight only. */
  equipment: Equipment[];
  bodyParts: BodyPart[];
  condition?: Condition;
  summary: string;
  exercises: PresetExercise[];
}

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  hips: "Hips",
  low_back: "Low back",
  shoulders: "Shoulders",
  t_spine: "Upper back",
  knees: "Knees",
  ankles: "Ankles",
  hamstrings: "Hamstrings",
  neck: "Neck",
  chest: "Chest",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: "Nothing",
  band: "Band",
  foam_roller: "Foam roller",
};

/** What the picker offers — "none" is implicit, never a choice. */
export const SELECTABLE_EQUIPMENT: Equipment[] = ["band", "foam_roller"];

export const CONDITION_LABELS: Record<Condition, string> = {
  jumpers_knee: "Jumper's knee",
  rounded_shoulders: "Rounded shoulders",
  anterior_pelvic_tilt: "Anterior pelvic tilt",
  tight_hip_flexors: "Tight hip flexors",
  ankle_stiffness: "Stiff ankles",
};

export const DURATIONS: Duration[] = [5, 10, 15, 20, 30];

export const PRESETS: Preset[] = [
  // ---- Quick, no-equipment fillers -----------------------------------------
  {
    id: "hips-5",
    name: "Hip reset",
    minutes: 5,
    equipment: ["none"],
    bodyParts: ["hips", "low_back"],
    summary: "Fast unlock when you've been sitting all day.",
    exercises: [
      { name: "90/90 hip switch", seconds: 60, cue: "Slow, no hands if you can" },
      { name: "Couch stretch", seconds: 45, perSide: true, cue: "Squeeze the glute of the back leg" },
      { name: "Glute bridge hold", seconds: 45, cue: "Ribs down, don't arch" },
      { name: "Figure-4 stretch", seconds: 40, perSide: true },
    ],
  },
  {
    id: "spine-5",
    name: "Desk decompress",
    minutes: 5,
    equipment: ["none"],
    bodyParts: ["t_spine", "neck", "shoulders"],
    summary: "Undo a long screen session without a mat.",
    exercises: [
      { name: "Cat-cow", seconds: 60, cue: "Move one vertebra at a time" },
      { name: "Thread the needle", seconds: 45, perSide: true },
      { name: "Chin tuck", seconds: 30, cue: "Make a double chin, hold, release" },
      { name: "Shoulder CARs", seconds: 45, perSide: true, cue: "Biggest circle you can control" },
    ],
  },
  {
    id: "ankles-5",
    name: "Ankle prep",
    minutes: 5,
    equipment: ["none"],
    bodyParts: ["ankles", "knees"],
    condition: "ankle_stiffness",
    summary: "Before squats, running, or anything with depth.",
    exercises: [
      { name: "Knee-to-wall ankle rock", seconds: 60, perSide: true, cue: "Heel stays down" },
      { name: "Calf raise, slow lower", seconds: 45, cue: "3 seconds down" },
      { name: "Ankle circles", seconds: 30, perSide: true },
      { name: "Deep squat hold", seconds: 45, cue: "Heels down, chest up" },
    ],
  },

  // ---- Standard 10s ---------------------------------------------------------
  {
    id: "full-10",
    name: "Full-body flow",
    minutes: 10,
    equipment: ["none"],
    bodyParts: ["hips", "t_spine", "hamstrings", "shoulders"],
    summary: "The default when nothing specific hurts.",
    exercises: [
      { name: "Cat-cow", seconds: 60 },
      { name: "World's greatest stretch", seconds: 60, perSide: true },
      { name: "90/90 hip switch", seconds: 75 },
      { name: "Downward dog to cobra", seconds: 60 },
      { name: "Thread the needle", seconds: 45, perSide: true },
      { name: "Seated hamstring fold", seconds: 60 },
    ],
  },
  {
    id: "hips-10",
    name: "Deep hip opener",
    minutes: 10,
    equipment: ["none"],
    bodyParts: ["hips", "low_back"],
    condition: "tight_hip_flexors",
    summary: "Longer holds — for after training, not before.",
    exercises: [
      { name: "Couch stretch", seconds: 90, perSide: true, cue: "Posterior tilt first, then lean" },
      { name: "90/90 hold", seconds: 60, perSide: true },
      { name: "Pigeon", seconds: 75, perSide: true, cue: "Breathe into the hip, don't force" },
      { name: "Frog stretch", seconds: 60, cue: "Rock back slowly" },
    ],
  },
  {
    id: "posture-10",
    name: "Posture reset",
    minutes: 10,
    equipment: ["none"],
    bodyParts: ["shoulders", "chest", "t_spine"],
    condition: "rounded_shoulders",
    summary: "Open the front, wake up what holds you upright. No gear needed.",
    exercises: [
      { name: "Doorway pec stretch", seconds: 60, perSide: true, cue: "Elbow at shoulder height" },
      { name: "Wall slide", seconds: 60, cue: "Low back flat against the wall the whole time" },
      { name: "Prone Y-raise", seconds: 45, cue: "Thumbs up, lift from the mid-back" },
      { name: "Prone T-raise", seconds: 45, cue: "Squeeze the shoulder blades, slow return" },
      { name: "Prone W-raise", seconds: 45, cue: "Elbows tight to the ribs" },
      { name: "Thread the needle", seconds: 45, perSide: true },
      { name: "Chin tuck hold", seconds: 45 },
    ],
  },
  {
    id: "knees-10",
    name: "Jumper's knee protocol",
    minutes: 10,
    equipment: ["none"],
    bodyParts: ["knees", "hamstrings"],
    condition: "jumpers_knee",
    summary: "Isometrics and slow eccentrics — the load the tendon actually wants.",
    exercises: [
      { name: "Wall-sit hold", seconds: 45, cue: "Hold, don't bounce. Pain under 3/10." },
      { name: "Wall-sit hold", seconds: 45 },
      { name: "Slow single-leg squat", seconds: 60, perSide: true, cue: "Off a step or chair. 4 seconds down, up with both." },
      { name: "Quad stretch", seconds: 45, perSide: true },
      { name: "Standing hamstring stretch", seconds: 45, perSide: true },
      { name: "Calf raise, slow lower", seconds: 60 },
    ],
  },
  {
    id: "apt-10",
    name: "Anterior pelvic tilt",
    minutes: 10,
    equipment: ["none"],
    bodyParts: ["hips", "low_back"],
    condition: "anterior_pelvic_tilt",
    summary: "Lengthen the front, switch on the back — in that order.",
    exercises: [
      { name: "90/90 breathing", seconds: 90, cue: "Feet on a wall, exhale fully, ribs down" },
      { name: "Couch stretch", seconds: 75, perSide: true, cue: "Tuck the pelvis before you lean" },
      { name: "Dead bug", seconds: 60, cue: "Low back glued to the floor" },
      { name: "Glute bridge", seconds: 60, cue: "Drive through heels, don't arch at the top" },
      { name: "Hamstring curl / bridge march", seconds: 60 },
    ],
  },

  // ---- 15s ------------------------------------------------------------------
  {
    id: "lower-15",
    name: "Lower body full",
    minutes: 15,
    equipment: ["foam_roller"],
    bodyParts: ["hips", "hamstrings", "knees", "ankles"],
    summary: "Everything below the waist, roller included.",
    exercises: [
      { name: "Foam roll quads", seconds: 60, perSide: true },
      { name: "Foam roll IT band / lateral quad", seconds: 45, perSide: true },
      { name: "Couch stretch", seconds: 75, perSide: true },
      { name: "90/90 hip switch", seconds: 75 },
      { name: "Pigeon", seconds: 60, perSide: true },
      { name: "Seated hamstring fold", seconds: 75 },
      { name: "Knee-to-wall ankle rock", seconds: 45, perSide: true },
    ],
  },
  {
    id: "back-15",
    name: "Low back relief",
    minutes: 15,
    equipment: ["none"],
    bodyParts: ["low_back", "hips", "hamstrings"],
    summary: "For the days it's tight rather than sharp.",
    exercises: [
      { name: "Cat-cow", seconds: 75 },
      { name: "Child's pose", seconds: 75, cue: "Walk the hands to each side too" },
      { name: "Supine twist", seconds: 60, perSide: true },
      { name: "Knees to chest", seconds: 60 },
      { name: "Figure-4 stretch", seconds: 60, perSide: true },
      { name: "Dead bug", seconds: 60 },
      { name: "Bird dog", seconds: 60, perSide: true, cue: "Slow, no hip rotation" },
    ],
  },
  {
    id: "upper-15",
    name: "Upper body opener",
    minutes: 15,
    equipment: ["band", "foam_roller"],
    bodyParts: ["shoulders", "chest", "t_spine", "neck"],
    condition: "rounded_shoulders",
    summary: "Roller on the t-spine, band for everything else.",
    exercises: [
      { name: "Foam roll t-spine extension", seconds: 90, cue: "Roller under the mid-back, extend over it" },
      { name: "Doorway / wall pec stretch", seconds: 60, perSide: true },
      { name: "Thread the needle", seconds: 60, perSide: true },
      { name: "Band pull-apart", seconds: 60 },
      { name: "Band face-pull", seconds: 60 },
      { name: "Wall slide", seconds: 60 },
      { name: "Shoulder CARs", seconds: 60, perSide: true },
      { name: "Chin tuck hold", seconds: 45 },
    ],
  },

  // ---- Long sessions --------------------------------------------------------
  {
    id: "full-20",
    name: "Full body, unhurried",
    minutes: 20,
    equipment: ["none"],
    bodyParts: ["hips", "low_back", "shoulders", "t_spine", "hamstrings", "ankles"],
    summary: "Head-to-toe. Rest day material.",
    exercises: [
      { name: "Deep squat hold", seconds: 60 },
      { name: "Downward dog to cobra", seconds: 90 },
      { name: "Cat-cow", seconds: 75 },
      { name: "World's greatest stretch", seconds: 75, perSide: true },
      { name: "Couch stretch", seconds: 75, perSide: true },
      { name: "90/90 hip switch", seconds: 90 },
      { name: "Pigeon", seconds: 75, perSide: true },
      { name: "Seated hamstring fold", seconds: 75 },
      { name: "Supine twist", seconds: 60, perSide: true },
      { name: "Knee-to-wall ankle rock", seconds: 45, perSide: true },
      { name: "Child's pose", seconds: 60 },
    ],
  },
  {
    id: "desk-recovery-20",
    name: "Sitting-all-week recovery",
    minutes: 20,
    equipment: ["band"],
    bodyParts: ["hips", "chest", "shoulders", "t_spine", "low_back"],
    condition: "anterior_pelvic_tilt",
    summary: "The two things desks do to you: closed hips, closed chest.",
    exercises: [
      { name: "90/90 breathing", seconds: 90 },
      { name: "Couch stretch", seconds: 90, perSide: true },
      { name: "Doorway / wall pec stretch", seconds: 75, perSide: true },
      { name: "Foam roll / wall t-spine extension", seconds: 75 },
      { name: "Thread the needle", seconds: 60, perSide: true },
      { name: "Band pull-apart", seconds: 60 },
      { name: "Wall slide", seconds: 60 },
      { name: "Dead bug", seconds: 60 },
      { name: "Glute bridge", seconds: 60 },
      { name: "Bird dog", seconds: 60, perSide: true },
    ],
  },
  {
    id: "full-30",
    name: "Long reset",
    minutes: 30,
    equipment: ["none"],
    bodyParts: ["hips", "low_back", "shoulders", "t_spine", "hamstrings", "knees", "ankles", "chest"],
    summary: "Everything, long holds. Once a week is plenty.",
    exercises: [
      { name: "Deep squat hold", seconds: 75 },
      { name: "Downward dog to cobra", seconds: 90 },
      { name: "Wall slide", seconds: 60 },
      { name: "Cat-cow", seconds: 90 },
      { name: "World's greatest stretch", seconds: 90, perSide: true },
      { name: "Couch stretch", seconds: 90, perSide: true },
      { name: "90/90 hip switch", seconds: 90 },
      { name: "Pigeon", seconds: 90, perSide: true },
      { name: "Frog stretch", seconds: 75 },
      { name: "Seated hamstring fold", seconds: 90 },
      { name: "Supine twist", seconds: 75, perSide: true },
      { name: "Doorway pec stretch", seconds: 60, perSide: true },
      { name: "Prone Y-raise", seconds: 60 },
      { name: "Knee-to-wall ankle rock", seconds: 60, perSide: true },
      { name: "Child's pose", seconds: 90 },
    ],
  },
];

/** Total prescribed time, counting per-side blocks twice. */
export function presetSeconds(preset: Preset): number {
  return preset.exercises.reduce((sum, ex) => sum + ex.seconds * (ex.perSide ? 2 : 1), 0);
}

export interface PresetFilter {
  minutes?: Duration | null;
  /** What you have available. A preset matches only if it needs nothing more. */
  equipment?: Equipment[];
  bodyPart?: BodyPart | null;
  condition?: Condition | null;
}

/**
 * Equipment must be fully satisfied, not merely overlapping: having a band
 * doesn't help with a routine that also needs a roller. "none" is free.
 */
export function filterPresets(filter: PresetFilter, presets: Preset[] = PRESETS): Preset[] {
  const owned = new Set<Equipment>([...(filter.equipment ?? []), "none"]);
  return presets.filter((preset) => {
    if (filter.minutes && preset.minutes !== filter.minutes) return false;
    if (filter.bodyPart && !preset.bodyParts.includes(filter.bodyPart)) return false;
    if (filter.condition && preset.condition !== filter.condition) return false;
    return preset.equipment.every((e) => owned.has(e));
  });
}

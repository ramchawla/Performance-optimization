/**
 * Parsers for per-activity Garmin payloads (garmin_payloads kinds
 * activity_hr_zones / activity_splits / activity_sets). Pure, tolerant of
 * missing or renamed fields (CLAUDE.md rule 6).
 *
 * UNVERIFIED shapes: taken from community libraries (python-garminconnect)
 * because no watch activity had synced when this was written. When the first
 * one lands, compare against its stored payloads and adjust.
 */

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface HrZone {
  zone: number;
  seconds: number;
  lowBpm: number | null;
  pct: number;
}

/** `/hrTimeInZones` → zones 1..5 with share of total time (whole %). */
export function hrZones(payload: unknown): HrZone[] {
  if (!Array.isArray(payload)) return [];
  const zones = payload
    .map((z) => obj(z))
    .filter((z): z is Obj => !!z && typeof z.zoneNumber === "number")
    .map((z) => ({ zone: z.zoneNumber as number, seconds: num(z.secsInZone) ?? 0, lowBpm: num(z.zoneLowBoundary) }))
    .sort((a, b) => a.zone - b.zone);
  const total = zones.reduce((a, z) => a + z.seconds, 0);
  return zones.map((z) => ({ ...z, pct: total > 0 ? Math.round((z.seconds / total) * 100) : 0 }));
}

export interface Lap {
  index: number;
  distanceM: number | null;
  durationS: number | null;
  avgHr: number | null;
  /** m/s — pace is formatted at the display layer (lib/units, CLAUDE.md rule 1). */
  avgSpeed: number | null;
}

/** `/splits` → laps in order. */
export function laps(payload: unknown): Lap[] {
  const list = obj(payload)?.lapDTOs;
  if (!Array.isArray(list)) return [];
  return list
    .map((l) => obj(l))
    .filter((l): l is Obj => !!l)
    .map((l, i) => ({
      index: i + 1,
      distanceM: num(l.distance),
      durationS: num(l.duration),
      avgHr: num(l.averageHR),
      avgSpeed: num(l.averageSpeed),
    }));
}

export interface StrengthGroup {
  name: string;
  sets: Array<{ reps: number | null; weightKg: number | null }>;
}

/** "BARBELL_BENCH_PRESS" → "Barbell bench press". */
function exerciseName(e: Obj | undefined): string {
  const raw = (typeof e?.name === "string" && e.name) || (typeof e?.category === "string" && e.category) || "Unknown exercise";
  const t = raw.toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * `/exerciseSets` → active sets grouped by exercise, in order of first
 * appearance. Garmin records weight in grams; converted to kg (the DB unit).
 */
export function strengthSets(payload: unknown): StrengthGroup[] {
  const list = obj(payload)?.exerciseSets;
  if (!Array.isArray(list)) return [];
  const groups = new Map<string, StrengthGroup>();
  for (const raw of list) {
    const set = obj(raw);
    if (!set || set.setType !== "ACTIVE") continue;
    const first = Array.isArray(set.exercises) ? obj(set.exercises[0]) : undefined;
    const name = exerciseName(first);
    const grams = num(set.weight);
    const group = groups.get(name) ?? { name, sets: [] };
    group.sets.push({ reps: num(set.repetitionCount), weightKg: grams !== null ? Math.round(grams / 100) / 10 : null });
    groups.set(name, group);
  }
  return [...groups.values()];
}

/**
 * Pure sleep calculations for the Sleep section — no I/O (CLAUDE.md rule 6).
 * Inputs are the scalar metrics from health_metrics and the per-night Garmin
 * payload stored in health_metrics.raw. See
 * docs/superpowers/specs/2026-09-24-sleep-section-design.md.
 */

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

const MIN_BASELINE_NIGHTS = 7;

/** Mean + sample SD of the given nights; null under 7 — a baseline from 3 nights is noise. */
export function baseline(values: number[]): Baseline | null {
  const xs = values.filter(Number.isFinite);
  if (xs.length < MIN_BASELINE_NIGHTS) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1);
  return { mean, sd: Math.sqrt(variance), n: xs.length };
}

export type Tone = "good" | "bad" | "neutral";

/**
 * How far tonight sits from normal, direction-aware: a higher HRV is good, a
 * higher resting HR is bad. Within half an SD reads as "normal" — night-to-night
 * wobble shouldn't light up red and green.
 */
export function deltaVsBaseline(value: number, base: Baseline, higherIsBetter: boolean) {
  const delta = value - base.mean;
  // ponytail: zero spread (7 identical nights) → treat as normal rather than ±Infinity z.
  const z = base.sd > 0 ? delta / base.sd : 0;
  let tone: Tone = "neutral";
  if (Math.abs(z) >= 0.5) tone = z > 0 === higherIsBetter ? "good" : "bad";
  return { delta, z, tone };
}

/** Metric → whether a higher value is the better night. */
export const HIGHER_IS_BETTER: Record<string, boolean> = {
  hrv_ms: true,
  sleep_score: true,
  body_battery_gain: true,
  sleep_duration_s: true,
  resting_hr_bpm: false,
  sleep_stress_avg: false,
  sleep_awake_s: false,
  sleep_resp_avg: false,
};

export type Stage = "deep" | "light" | "rem" | "awake";

// Verified against a live Fenix 7 night: per-code totals matched
// deep/light/rem/awakeSleepSeconds to the second.
const STAGE_BY_CODE: Record<number, Stage> = { 0: "deep", 1: "light", 2: "rem", 3: "awake" };

export interface Segment {
  stage: Stage;
  startMin: number; // minutes from the first segment's start
  endMin: number;
}

/** Garmin GMT strings come without a zone ("2026-09-23T05:22:47.0") — they are UTC. */
function parseGmt(v: unknown): number {
  return typeof v === "string" ? Date.parse(v.endsWith("Z") ? v : `${v}Z`) : NaN;
}

/** Garmin `sleepLevels` → ordered stage blocks for the hypnogram. Tolerates junk. */
export function hypnogramSegments(levels: unknown): Segment[] {
  if (!Array.isArray(levels)) return [];
  const parsed = levels
    .map((l) => {
      const rec = (l ?? {}) as Record<string, unknown>;
      return {
        stage: STAGE_BY_CODE[rec.activityLevel as number],
        start: parseGmt(rec.startGMT),
        end: parseGmt(rec.endGMT),
      };
    })
    .filter((s) => s.stage && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  if (parsed.length === 0) return [];
  const origin = parsed[0].start;
  return parsed.map((s) => ({
    stage: s.stage,
    startMin: (s.start - origin) / 60_000,
    endMin: (s.end - origin) / 60_000,
  }));
}

/** Stage seconds → whole percentages that sum to exactly 100 (largest remainder). */
export function stageMix(secs: Record<Stage, number>): Record<Stage, number> {
  const stages: Stage[] = ["deep", "light", "rem", "awake"];
  const total = stages.reduce((a, s) => a + Math.max(0, secs[s] || 0), 0);
  const out = { deep: 0, light: 0, rem: 0, awake: 0 };
  if (total <= 0) return out;
  const exact = stages.map((s) => ({ s, x: (Math.max(0, secs[s] || 0) / total) * 100 }));
  for (const { s, x } of exact) out[s] = Math.floor(x);
  let left = 100 - stages.reduce((a, s) => a + out[s], 0);
  for (const { s } of [...exact].sort((a, b) => (b.x % 1) - (a.x % 1))) {
    if (left-- <= 0) break;
    out[s] += 1;
  }
  return out;
}

/**
 * Sample SD of bed or wake times, in minutes. Takes offsets from local
 * midnight (negative = previous evening), so 23:30 and 00:30 are an hour
 * apart, not 23.
 */
export function timingConsistency(offsetsS: number[]): number | null {
  const xs = offsetsS.filter(Number.isFinite);
  if (xs.length < 3) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance) / 60;
}

/** Offset from local midnight → "HH:MM" wall clock. */
export function formatClock(offsetS: number): string {
  const s = ((Math.round(offsetS) % 86_400) + 86_400) % 86_400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Overnight arrays (sleepHeartRate, hrvData, respiration epochs) → sorted
 * {t, v} points. Garmin marks gaps with null values; those are dropped.
 */
export function timeSeries(points: unknown, timeKey: string, valueKey: string): Array<{ t: number; v: number }> {
  if (!Array.isArray(points)) return [];
  return points
    .map((p) => {
      const rec = (p ?? {}) as Record<string, unknown>;
      return { t: rec[timeKey], v: rec[valueKey] };
    })
    .filter((p): p is { t: number; v: number } => typeof p.t === "number" && typeof p.v === "number" && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);
}

/** "7h 25m" — the shape a duration should be read in, never raw seconds. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

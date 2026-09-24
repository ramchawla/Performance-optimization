import type { Baseline } from "./sleep";

/**
 * The app's own recovery score — separate from Garmin's Training Readiness so
 * it is transparent and works from day 7 of wearing the watch, before Garmin's
 * HRV baseline exists. Each input is scored against the user's own 28-night
 * baseline (z-score, flipped so "better" is always positive), weighted, and
 * mapped to 0–100 where 50 is a normal day and each SD moves it 15 points.
 */

export interface RecoveryInputs {
  hrv: number | undefined;
  rhr: number | undefined;
  sleepScore: number | undefined;
}

export interface RecoveryBaselines {
  hrv: Baseline | null;
  rhr: Baseline | null;
  sleepScore: Baseline | null;
}

// HRV carries half the weight: it's the most direct autonomic recovery signal;
// RHR and sleep quality corroborate it.
const WEIGHTS = { hrv: 0.5, rhr: 0.25, sleepScore: 0.25 } as const;
const HIGHER_IS_BETTER = { hrv: true, rhr: false, sleepScore: true } as const;
const POINTS_PER_SD = 15;

export type RecoveryBand = "low" | "normal" | "high";

export interface RecoveryResult {
  score: number;
  band: RecoveryBand;
  components: Array<{ key: keyof RecoveryInputs; z: number; weight: number }>;
}

export function recoveryScore(inputs: RecoveryInputs, baselines: RecoveryBaselines): RecoveryResult | null {
  if (inputs.hrv === undefined || !baselines.hrv) return null;

  const components: RecoveryResult["components"] = [];
  for (const key of ["hrv", "rhr", "sleepScore"] as const) {
    const value = inputs[key];
    const base = baselines[key];
    if (value === undefined || !base || base.sd <= 0) continue;
    const raw = (value - base.mean) / base.sd;
    components.push({ key, z: HIGHER_IS_BETTER[key] ? raw : -raw, weight: WEIGHTS[key] });
  }
  if (!components.some((c) => c.key === "hrv")) return null;

  const totalWeight = components.reduce((a, c) => a + c.weight, 0);
  const z = components.reduce((a, c) => a + c.z * c.weight, 0) / totalWeight;
  const score = Math.round(Math.min(100, Math.max(0, 50 + z * POINTS_PER_SD)));
  const band: RecoveryBand = score >= 65 ? "high" : score <= 35 ? "low" : "normal";
  return { score, band, components };
}

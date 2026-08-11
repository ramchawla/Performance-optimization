/**
 * Preview-only mock data for the Body tab (weight trend, measurements,
 * progress photos). Shapes mirror the real schema — body_metrics.extras
 * jsonb for chest/arms/thigh, progress_photos.pose enum — so swapping in
 * live queries later is a straight substitution, not a reshape.
 * ponytail: swap for real body_metrics/progress_photos queries once
 * lib/queries/body.ts exists.
 */

export interface WeightTrendPoint {
  date: string;
  weightKg: number;
}

export interface MeasurementTrendPoint {
  date: string;
  valueCm: number;
}

export interface Measurement {
  key: "waist" | "chest" | "armL" | "armR" | "thigh";
  label: string;
  currentCm: number;
  deltaCm: number;
  deltaDays: number;
  trend?: MeasurementTrendPoint[];
}

export type PhotoPose = "front" | "side" | "back";

export interface ProgressPhotoSession {
  date: string; // taken_at, ISO date
  label: string; // "Aug 1"
  weightKgAtTime: number;
  poses: PhotoPose[];
}

function buildWeightTrend90d(): WeightTrendPoint[] {
  const points: WeightTrendPoint[] = [];
  let ema = 84.5;
  for (let i = 90; i >= 0; i -= 5) {
    const date = new Date(Date.UTC(2026, 7, 1));
    date.setUTCDate(date.getUTCDate() - i);
    const noise = Math.sin(i / 7) * 0.35;
    const drift = -0.026 * (90 - i);
    const raw = 84.5 + drift + noise;
    ema = ema + 0.3 * (raw - ema);
    points.push({ date: date.toISOString().slice(0, 10), weightKg: Math.round(ema * 100) / 100 });
  }
  points[points.length - 1] = { date: "2026-08-01", weightKg: 82.1 };
  return points;
}

function buildThighTrend60d(): MeasurementTrendPoint[] {
  const values = [58.6, 58.4, 58.5, 58.2, 58.1, 58.0];
  return values.map((valueCm, i) => {
    const date = new Date(Date.UTC(2026, 7, 1));
    date.setUTCDate(date.getUTCDate() - (60 - i * 12));
    return { date: date.toISOString().slice(0, 10), valueCm };
  });
}

export const MOCK_BODY = {
  current: {
    weightKg: 82.1,
    startWeightKg: 84.5,
    deltaKg: -2.4,
    windowDays: 90,
    asOf: "2026-08-01",
  },
  streakWeeks: 12,
  weightTrend90d: buildWeightTrend90d(),
  measurements: [
    { key: "waist", label: "Waist", currentCm: 84.2, deltaCm: -1.8, deltaDays: 60 },
    { key: "chest", label: "Chest", currentCm: 102, deltaCm: 0.5, deltaDays: 60 },
    { key: "armL", label: "L. Arm", currentCm: 36.5, deltaCm: 0, deltaDays: 60 },
    { key: "armR", label: "R. Arm", currentCm: 36.8, deltaCm: 0, deltaDays: 60 },
    { key: "thigh", label: "Thigh", currentCm: 58.0, deltaCm: -0.6, deltaDays: 60, trend: buildThighTrend60d() },
  ] satisfies Measurement[],
  photoSessions: [
    { date: "2026-08-01", label: "Aug 1", weightKgAtTime: 82.1, poses: ["front", "side", "back"] },
    { date: "2026-07-01", label: "Jul 1", weightKgAtTime: 82.9, poses: ["front", "side", "back"] },
    { date: "2026-06-01", label: "Jun 1", weightKgAtTime: 83.6, poses: ["front", "side", "back"] },
    { date: "2026-05-01", label: "May 1", weightKgAtTime: 84.5, poses: ["front", "side", "back"] },
  ] satisfies ProgressPhotoSession[],
};

/**
 * Preview-only mock data for the dashboard visual redesign. Lets the full
 * layout (vitals, meals, lift trends, runs — most of which have no real
 * query wiring yet) render without a signed-in account or logged history.
 * ponytail: swap for useDashboard() + real integration queries once
 * health-metric ingestion (sleep/HR/cardio) and per-lift trend queries exist.
 */

export interface MockLift {
  name: string;
  e1rmKg: number;
  trend: "up" | "down" | "flat";
  favorable: boolean;
  sparkline: number[];
}

export interface MockMeal {
  name: string;
  time: string;
  kcal: number;
  proteinG: number;
}

export interface MockRun {
  label: string;
  distanceKm: number;
  durationMin: number;
  paceMinPerKm: number;
  kcal: number;
  daysAgo: number;
}

export interface WeightTrendPoint {
  date: string;
  rawKg: number | null;
  emaKg: number;
}

export interface VolumeWeek {
  weekLabel: string;
  volumeKg: number;
}

export interface SleepNight {
  date: string;
  bedtimeDeviationMin: number; // minutes from the person's average bedtime
}

export interface MockCorrelation {
  title: string;
  xLabel: string;
  yLabel: string;
  r: number;
  n: number;
  strength: "weak" | "moderate" | "strong";
}

function buildWeightTrend90d(): WeightTrendPoint[] {
  const points: WeightTrendPoint[] = [];
  let ema = 84.5;
  for (let i = 90; i >= 0; i--) {
    const date = new Date(Date.UTC(2026, 7, 6));
    date.setUTCDate(date.getUTCDate() - i);
    const noise = Math.sin(i / 6) * 0.4 + (Math.random() - 0.5) * 0.3;
    const drift = -0.012 * (90 - i);
    const raw = 84.5 + drift + noise;
    ema = ema + 0.15 * (raw - ema);
    points.push({ date: date.toISOString().slice(0, 10), rawKg: Math.round(raw * 10) / 10, emaKg: Math.round(ema * 100) / 100 });
  }
  return points;
}

function buildWeeklyVolume(): VolumeWeek[] {
  const base = [9200, 9600, 9100, 9800, 10200, 10050, 10600, 11100];
  return base.map((volumeKg, i) => ({ weekLabel: `W${i + 1}`, volumeKg }));
}

function buildSleepConsistency(): SleepNight[] {
  const deviations = [12, -8, 45, -15, 5, 90, -22, 8, -5, 30, 14, -18, 6, 10];
  return deviations.map((bedtimeDeviationMin, i) => {
    const date = new Date(Date.UTC(2026, 7, 6));
    date.setUTCDate(date.getUTCDate() - (13 - i));
    return { date: date.toISOString().slice(0, 10), bedtimeDeviationMin };
  });
}

export const MOCK_DASHBOARD = {
  recomp: {
    weightSlopeKgPerWeek: -0.18,
    strengthSlopeKgPerWeek: 1.4,
    waistSlopeCmPerWeek: -0.12,
  },
  vitals: {
    restingHrBpm: 54,
    restingHrTrend: "down" as const,
    sleepHours: 7.4,
    sleepTrend: "up" as const,
    avgCaloriesBurned: 2680,
    caloriesBurnedTrend: "flat" as const,
  },
  weightSparkline: [83.4, 83.1, 83.2, 82.9, 82.7, 82.8, 82.5, 82.3, 82.4, 82.1],
  sleepSparkline: [6.8, 7.1, 6.5, 7.9, 7.2, 7.6, 7.4],
  hrSparkline: [58, 57, 56, 57, 55, 54, 54],
  nutritionToday: {
    proteinG: 148,
    proteinTargetG: 180,
    calories: 1820,
    caloriesTargetKcal: 2400,
  },
  meals: [
    { name: "Greek yogurt + berries + granola", time: "7:40 AM", kcal: 410, proteinG: 32 },
    { name: "Chicken burrito bowl", time: "12:30 PM", kcal: 720, proteinG: 58 },
    { name: "Protein shake + banana", time: "3:15 PM", kcal: 290, proteinG: 38 },
    { name: "Salmon, rice, broccoli", time: "7:00 PM", kcal: 400, proteinG: 20 },
  ] satisfies MockMeal[],
  week: [
    { date: "2026-07-31", trained: true },
    { date: "2026-08-01", trained: false },
    { date: "2026-08-02", trained: true },
    { date: "2026-08-03", trained: false },
    { date: "2026-08-04", trained: true },
    { date: "2026-08-05", trained: false },
    { date: "2026-08-06", trained: true },
  ],
  lifts: [
    { name: "Bench", e1rmKg: 102.5, trend: "up", favorable: true, sparkline: [95, 96, 97, 98, 99, 101, 102.5] },
    { name: "Squat", e1rmKg: 148, trend: "up", favorable: true, sparkline: [138, 140, 141, 143, 145, 146, 148] },
    { name: "Deadlift", e1rmKg: 175, trend: "flat", favorable: false, sparkline: [176, 175, 177, 174, 175, 176, 175] },
    { name: "OHP", e1rmKg: 61, trend: "down", favorable: false, sparkline: [64, 63, 63, 62, 61.5, 61, 61] },
  ] satisfies MockLift[],
  runs: [
    { label: "Easy morning run", distanceKm: 5.2, durationMin: 28, paceMinPerKm: 5.4, kcal: 340, daysAgo: 1 },
    { label: "Tempo intervals", distanceKm: 7.0, durationMin: 34, paceMinPerKm: 4.9, kcal: 480, daysAgo: 3 },
    { label: "Long run", distanceKm: 12.4, durationMin: 68, paceMinPerKm: 5.5, kcal: 810, daysAgo: 5 },
  ] satisfies MockRun[],
  weightTrend90d: buildWeightTrend90d(),
  weeklyVolume: buildWeeklyVolume(),
  sleepConsistency: buildSleepConsistency(),
  streakDays: 4,
  correlations: [
    { title: "Protein vs. next-day strength", xLabel: "protein (g)", yLabel: "e1RM (kg)", r: 0.42, n: 34, strength: "moderate" },
    { title: "Sleep vs. resting heart rate", xLabel: "sleep (hr)", yLabel: "resting HR (bpm)", r: -0.58, n: 41, strength: "strong" },
  ] satisfies MockCorrelation[],
};

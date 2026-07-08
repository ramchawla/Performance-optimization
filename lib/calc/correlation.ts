/**
 * Correlation views, per TECHNICAL-DESIGN.md §6.
 * Pearson r over paired daily observations, min n=20 before displaying
 * anything, plain-language strength bands, always caption with n. Do not
 * turn this into an open-ended matrix — only the 4 hard-coded pairs there.
 */

export interface PairedPoint {
  x: number;
  y: number;
}

export type CorrelationStrength = "weak" | "moderate" | "strong";

export interface CorrelationResult {
  r: number;
  n: number;
  strength: CorrelationStrength;
}

export const MIN_PAIRED_OBSERVATIONS = 20;

/** Pearson r. Returns null if fewer than 2 points or either series has zero variance. */
export function pearsonR(points: PairedPoint[]): number | null {
  const n = points.length;
  if (n < 2) return null;

  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  if (sumSqX === 0 || sumSqY === 0) return null;
  return numerator / Math.sqrt(sumSqX * sumSqY);
}

function strengthBand(absR: number): CorrelationStrength {
  if (absR >= 0.5) return "strong";
  if (absR >= 0.3) return "moderate";
  return "weak";
}

/**
 * Full result for display, or null if n < MIN_PAIRED_OBSERVATIONS (caller
 * should render "collecting data (n/20)" in that case) or if r itself is
 * undefined (degenerate series).
 */
export function computeCorrelation(points: PairedPoint[]): CorrelationResult | null {
  const n = points.length;
  if (n < MIN_PAIRED_OBSERVATIONS) return null;

  const r = pearsonR(points);
  if (r === null) return null;

  return { r, n, strength: strengthBand(Math.abs(r)) };
}

export interface DailyMetric {
  day: string; // ISO date, YYYY-MM-DD
  value: number | null;
}

/**
 * Pairs two same-cadence daily series by date, optionally lagging `a` by
 * `lagDays` relative to `b` (e.g. lagDays=1 pairs a[day] with b[day+1], for
 * "last night's sleep vs. today's session quality"). Drops any day where
 * either side is null/missing.
 */
export function pairDailySeries(
  a: DailyMetric[],
  b: DailyMetric[],
  lagDays = 0
): PairedPoint[] {
  const bByDate = new Map(b.map((m) => [m.day, m.value]));
  const points: PairedPoint[] = [];

  for (const metric of a) {
    if (metric.value === null) continue;
    const targetDate = new Date(metric.day + "T00:00:00Z");
    targetDate.setUTCDate(targetDate.getUTCDate() + lagDays);
    const targetIso = targetDate.toISOString().slice(0, 10);

    const bValue = bByDate.get(targetIso);
    if (bValue === undefined || bValue === null) continue;

    points.push({ x: metric.value, y: bValue });
  }

  return points;
}

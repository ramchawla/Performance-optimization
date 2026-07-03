/**
 * Weight trend: 7-day EMA over daily weigh-ins, per TECHNICAL-DESIGN.md §6.
 * Raw scale weight is noisy (water/glycogen/sodium); the EMA is the number
 * that should ever be presented as "the trend." Do not chart raw weight as
 * the headline metric — see TECHNICAL-DESIGN §6 for why.
 */

export interface WeighIn {
  date: string; // ISO date, YYYY-MM-DD
  weightKg: number;
}

export interface TrendPoint {
  date: string;
  rawKg: number | null; // null on days with no weigh-in (nothing to plot as a dot)
  emaKg: number;
}

const ALPHA = 0.25;

/**
 * Averages multiple same-day entries first, then walks every calendar day
 * from the first to the last weigh-in, updating the EMA only on days with
 * data and carrying the previous EMA forward (unchanged) on days without —
 * per the explicit "missing day carry-forward" rule in TECHNICAL-DESIGN §6.
 */
export function computeWeightEMA(weighIns: WeighIn[]): TrendPoint[] {
  if (weighIns.length === 0) return [];

  // Average same-day entries.
  const byDate = new Map<string, number[]>();
  for (const w of weighIns) {
    const arr = byDate.get(w.date) ?? [];
    arr.push(w.weightKg);
    byDate.set(w.date, arr);
  }
  const dailyAvg = new Map<string, number>();
  for (const [date, values] of byDate) {
    dailyAvg.set(date, values.reduce((a, b) => a + b, 0) / values.length);
  }

  const sortedDates = Array.from(dailyAvg.keys()).sort();
  const start = new Date(sortedDates[0] + "T00:00:00Z");
  const end = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00Z");

  const points: TrendPoint[] = [];
  let ema: number | null = null;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const raw = dailyAvg.get(iso) ?? null;

    if (raw !== null) {
      ema = ema === null ? raw : ALPHA * raw + (1 - ALPHA) * ema;
    }
    // If ema is still null here, there's no seed yet — skip emitting a point
    // until the first real weigh-in seeds the series.
    if (ema !== null) {
      points.push({ date: iso, rawKg: raw, emaKg: ema });
    }
  }

  return points;
}

/**
 * Slope of the EMA over the trailing N days, in kg/week. Positive = gaining,
 * negative = losing. Returns null if fewer than 2 points exist in the window.
 */
export function emaSlopeKgPerWeek(points: TrendPoint[], trailingDays = 14): number | null {
  if (points.length < 2) return null;
  const window = points.slice(-trailingDays);
  if (window.length < 2) return null;

  const first = window[0];
  const last = window[window.length - 1];
  const daysApart =
    (new Date(last.date + "T00:00:00Z").getTime() - new Date(first.date + "T00:00:00Z").getTime()) /
    (1000 * 60 * 60 * 24);
  if (daysApart <= 0) return null;

  const kgPerDay = (last.emaKg - first.emaKg) / daysApart;
  return kgPerDay * 7;
}

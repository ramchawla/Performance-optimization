export interface LoggedEntry {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  micros: Record<string, number>;
}

export interface DailyTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  micros: Record<string, number>;
}

export function sumDailyTotals(entries: LoggedEntry[]): DailyTotals {
  const totals: DailyTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, micros: {} };
  for (const e of entries) {
    totals.calories += e.calories;
    totals.proteinG += e.proteinG;
    totals.carbsG += e.carbsG;
    totals.fatG += e.fatG;
    totals.fiberG += e.fiberG ?? 0;
    for (const [key, value] of Object.entries(e.micros)) {
      totals.micros[key] = (totals.micros[key] ?? 0) + value;
    }
  }
  return totals;
}

export interface MacroTargets {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** Ratio of consumed/target per macro, null where no target is set. Not clamped — over-target shows >1. */
export function macroProgress(totals: DailyTotals, targets: MacroTargets) {
  const ratio = (consumed: number, target: number | null) => (target && target > 0 ? consumed / target : null);
  return {
    calories: ratio(totals.calories, targets.calories),
    proteinG: ratio(totals.proteinG, targets.proteinG),
    carbsG: ratio(totals.carbsG, targets.carbsG),
    fatG: ratio(totals.fatG, targets.fatG),
  };
}

/** Scales a food's per-serving macros/micros by a logged quantity (multiples of serving). */
export function scaleServing(
  perServing: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null; micros: Record<string, number> },
  quantity: number
): LoggedEntry {
  return {
    calories: perServing.calories * quantity,
    proteinG: perServing.proteinG * quantity,
    carbsG: perServing.carbsG * quantity,
    fatG: perServing.fatG * quantity,
    fiberG: perServing.fiberG !== null ? perServing.fiberG * quantity : null,
    micros: Object.fromEntries(Object.entries(perServing.micros).map(([k, v]) => [k, v * quantity])),
  };
}

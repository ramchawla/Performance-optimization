/**
 * Macro ↔ calorie consistency. A calorie target and a protein/carb/fat target
 * are not independent numbers — one is derived from the other. These helpers
 * keep the two in lockstep so the Settings editor can never save a split that
 * doesn't add up.
 *
 * Atwater factors: 4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat.
 */

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export function kcalFromMacros(m: Macros): number {
  return m.proteinG * KCAL_PER_G.protein + m.carbsG * KCAL_PER_G.carbs + m.fatG * KCAL_PER_G.fat;
}

/**
 * Rescale a macro split to hit `targetKcal`, preserving each macro's share of
 * the original total.
 *
 * Protein and fat are rounded to whole grams first, then carbs absorb whatever
 * calories are left over. Carbs are the shock absorber because they're the
 * macro least likely to be a hard floor (protein) or a hard budget (fat).
 *
 * Whole-gram carbs move in 4 kcal steps, so the result lands within ±2 kcal of
 * the target rather than exactly on it. That's a hard floor, not a rounding
 * bug: no integer gram split can hit an arbitrary calorie number.
 *
 * Returns null when the input has no calories to scale from — there's no
 * meaningful ratio to preserve, so the caller should ask for a split instead
 * of inventing one.
 */
export function scaleMacrosToKcal(current: Macros, targetKcal: number): Macros | null {
  const currentKcal = kcalFromMacros(current);
  if (currentKcal <= 0 || targetKcal <= 0) return null;

  const factor = targetKcal / currentKcal;
  const proteinG = Math.round(current.proteinG * factor);
  const fatG = Math.round(current.fatG * factor);

  const remainingKcal = targetKcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(0, Math.round(remainingKcal / KCAL_PER_G.carbs));

  return { proteinG, carbsG, fatG };
}

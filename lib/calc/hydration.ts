import type { Database } from "@/lib/database.types";

export type HydrationLog = Database["public"]["Tables"]["hydration_logs"]["Row"];

export interface HydrationTotals {
  volumeMl: number;
  waterEquivalentMl: number;
  caffeineMg: number;
  alcoholUnits: number;
  sodiumMg: number;
  lastCaffeineAt: string | null;
}

/**
 * Alcohol is excluded from the water-equivalent total — it's a net diuretic,
 * so counting a beer toward hydration would flatter the number. Caffeinated
 * drinks do count: at habitual doses the diuretic effect is small enough that
 * the fluid is still fluid.
 */
export function summarizeHydration(entries: HydrationLog[]): HydrationTotals {
  let volumeMl = 0;
  let waterEquivalentMl = 0;
  let caffeineMg = 0;
  let alcoholUnits = 0;
  let sodiumMg = 0;
  let lastCaffeineAt: string | null = null;

  for (const e of entries) {
    volumeMl += e.volume_ml;
    if (e.drink_type !== "alcohol") waterEquivalentMl += e.volume_ml;
    if (e.caffeine_mg) {
      caffeineMg += e.caffeine_mg;
      if (!lastCaffeineAt || e.consumed_at > lastCaffeineAt) lastCaffeineAt = e.consumed_at;
    }
    if (e.alcohol_units) alcoholUnits += Number(e.alcohol_units);
    if (e.sodium_mg) sodiumMg += e.sodium_mg;
  }

  return { volumeMl, waterEquivalentMl, caffeineMg, alcoholUnits, sodiumMg, lastCaffeineAt };
}

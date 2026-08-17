import { describe, expect, it } from "vitest";
import { summarizeHydration, type HydrationLog } from "./hydration";

function entry(partial: Partial<HydrationLog>): HydrationLog {
  return {
    id: crypto.randomUUID(),
    user_id: "u",
    log_date: "2026-08-17",
    consumed_at: "2026-08-17T09:00:00.000Z",
    volume_ml: 500,
    drink_type: "water",
    caffeine_mg: null,
    alcohol_units: null,
    sodium_mg: null,
    context: null,
    notes: null,
    updated_at: "2026-08-17T09:00:00.000Z",
    ...partial,
  };
}

describe("summarizeHydration", () => {
  it("is all zeroes for an empty day", () => {
    const t = summarizeHydration([]);
    expect(t.volumeMl).toBe(0);
    expect(t.lastCaffeineAt).toBeNull();
  });

  it("sums volume across drinks", () => {
    const t = summarizeHydration([entry({ volume_ml: 500 }), entry({ volume_ml: 250 })]);
    expect(t.volumeMl).toBe(750);
    expect(t.waterEquivalentMl).toBe(750);
  });

  it("excludes alcohol from the water-equivalent total but not from raw volume", () => {
    const t = summarizeHydration([
      entry({ volume_ml: 500 }),
      entry({ volume_ml: 330, drink_type: "alcohol", alcohol_units: 1.5 }),
    ]);
    expect(t.volumeMl).toBe(830);
    expect(t.waterEquivalentMl).toBe(500);
    expect(t.alcoholUnits).toBe(1.5);
  });

  it("counts caffeinated drinks as hydrating", () => {
    const t = summarizeHydration([entry({ volume_ml: 240, drink_type: "coffee", caffeine_mg: 95 })]);
    expect(t.waterEquivalentMl).toBe(240);
    expect(t.caffeineMg).toBe(95);
  });

  it("tracks the LAST caffeine of the day, not the first", () => {
    const t = summarizeHydration([
      entry({ drink_type: "coffee", caffeine_mg: 95, consumed_at: "2026-08-17T07:00:00.000Z" }),
      entry({ drink_type: "tea", caffeine_mg: 40, consumed_at: "2026-08-17T15:00:00.000Z" }),
      entry({ drink_type: "water", consumed_at: "2026-08-17T20:00:00.000Z" }),
    ]);
    expect(t.caffeineMg).toBe(135);
    expect(t.lastCaffeineAt).toBe("2026-08-17T15:00:00.000Z");
  });

  it("ignores order when finding the last caffeine", () => {
    const t = summarizeHydration([
      entry({ drink_type: "tea", caffeine_mg: 40, consumed_at: "2026-08-17T15:00:00.000Z" }),
      entry({ drink_type: "coffee", caffeine_mg: 95, consumed_at: "2026-08-17T07:00:00.000Z" }),
    ]);
    expect(t.lastCaffeineAt).toBe("2026-08-17T15:00:00.000Z");
  });
});

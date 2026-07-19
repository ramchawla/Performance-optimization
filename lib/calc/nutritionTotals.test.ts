import { describe, expect, it } from "vitest";
import { macroProgress, scaleServing, sumDailyTotals } from "./nutritionTotals";

describe("sumDailyTotals", () => {
  it("sums macros and micros across entries", () => {
    const totals = sumDailyTotals([
      { calories: 200, proteinG: 20, carbsG: 10, fatG: 5, fiberG: 2, micros: { b12_mcg: 1, iron_mg: 2 } },
      { calories: 300, proteinG: 30, carbsG: 20, fatG: 10, fiberG: null, micros: { b12_mcg: 0.5 } },
    ]);
    expect(totals).toEqual({
      calories: 500,
      proteinG: 50,
      carbsG: 30,
      fatG: 15,
      fiberG: 2,
      micros: { b12_mcg: 1.5, iron_mg: 2 },
    });
  });

  it("returns zeroed totals for no entries", () => {
    expect(sumDailyTotals([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, micros: {} });
  });
});

describe("macroProgress", () => {
  it("computes consumed/target ratios", () => {
    const totals = sumDailyTotals([{ calories: 1500, proteinG: 100, carbsG: 150, fatG: 50, fiberG: null, micros: {} }]);
    const progress = macroProgress(totals, { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60 });
    expect(progress.calories).toBeCloseTo(0.75);
    expect(progress.proteinG).toBeCloseTo(2 / 3);
  });

  it("returns null for unset targets", () => {
    const totals = sumDailyTotals([]);
    const progress = macroProgress(totals, { calories: null, proteinG: null, carbsG: null, fatG: null });
    expect(progress).toEqual({ calories: null, proteinG: null, carbsG: null, fatG: null });
  });
});

describe("scaleServing", () => {
  it("scales macros and micros by quantity", () => {
    const scaled = scaleServing(
      { calories: 100, proteinG: 10, carbsG: 5, fatG: 2, fiberG: 1, micros: { b12_mcg: 0.4 } },
      2.5
    );
    expect(scaled).toEqual({ calories: 250, proteinG: 25, carbsG: 12.5, fatG: 5, fiberG: 2.5, micros: { b12_mcg: 1 } });
  });

  it("keeps null fiber null after scaling", () => {
    const scaled = scaleServing({ calories: 100, proteinG: 10, carbsG: 5, fatG: 2, fiberG: null, micros: {} }, 3);
    expect(scaled.fiberG).toBeNull();
  });
});

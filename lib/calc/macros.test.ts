import { describe, expect, it } from "vitest";
import { kcalFromMacros, scaleMacrosToKcal } from "./macros";

describe("kcalFromMacros", () => {
  it("applies Atwater factors", () => {
    expect(kcalFromMacros({ proteinG: 100, carbsG: 100, fatG: 100 })).toBe(1700);
  });

  it("is zero for an empty split", () => {
    expect(kcalFromMacros({ proteinG: 0, carbsG: 0, fatG: 0 })).toBe(0);
  });
});

describe("scaleMacrosToKcal", () => {
  const base = { proteinG: 180, carbsG: 250, fatG: 70 }; // 2350 kcal

  it("is identity when the target already matches", () => {
    expect(scaleMacrosToKcal(base, kcalFromMacros(base))).toEqual(base);
  });

  it("lands within a whole gram of carbs of the target", () => {
    for (const target of [1500, 1800, 2201, 3000, 3333]) {
      const scaled = scaleMacrosToKcal(base, target)!;
      expect(Math.abs(kcalFromMacros(scaled) - target)).toBeLessThanOrEqual(2);
    }
  });

  it("preserves each macro's rough share of total calories", () => {
    const scaled = scaleMacrosToKcal(base, 4700)!; // exactly 2x
    expect(scaled.proteinG).toBe(360);
    expect(scaled.fatG).toBe(140);
    expect(scaled.carbsG).toBe(500);
  });

  it("scales down as well as up", () => {
    const scaled = scaleMacrosToKcal(base, 1800)!;
    expect(scaled.proteinG).toBeLessThan(base.proteinG);
    expect(scaled.carbsG).toBeLessThan(base.carbsG);
    expect(scaled.fatG).toBeLessThan(base.fatG);
  });

  it("never returns negative carbs when protein and fat alone overshoot", () => {
    const proteinHeavy = { proteinG: 300, carbsG: 1, fatG: 100 };
    const scaled = scaleMacrosToKcal(proteinHeavy, 500)!;
    expect(scaled.carbsG).toBeGreaterThanOrEqual(0);
  });

  it("returns null when there is no ratio to preserve", () => {
    expect(scaleMacrosToKcal({ proteinG: 0, carbsG: 0, fatG: 0 }, 2000)).toBeNull();
    expect(scaleMacrosToKcal(base, 0)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { computeWeightEMA, emaSlopeKgPerWeek, type WeighIn } from "./weightTrend";

describe("computeWeightEMA", () => {
  it("returns empty array for no input", () => {
    expect(computeWeightEMA([])).toEqual([]);
  });

  it("seeds the EMA with the first weigh-in", () => {
    const points = computeWeightEMA([{ date: "2026-06-01", weightKg: 70 }]);
    expect(points).toHaveLength(1);
    expect(points[0].emaKg).toBeCloseTo(70, 5);
    expect(points[0].rawKg).toBeCloseTo(70, 5);
  });

  it("averages multiple same-day entries before applying EMA", () => {
    const points = computeWeightEMA([
      { date: "2026-06-01", weightKg: 70 },
      { date: "2026-06-01", weightKg: 72 },
    ]);
    expect(points[0].rawKg).toBeCloseTo(71, 5);
    expect(points[0].emaKg).toBeCloseTo(71, 5);
  });

  it("carries the EMA forward unchanged on days with no weigh-in", () => {
    const points = computeWeightEMA([
      { date: "2026-06-01", weightKg: 70 },
      { date: "2026-06-04", weightKg: 70 },
    ]);
    // 2026-06-01, 02, 03, 04 should all be present
    expect(points).toHaveLength(4);
    const [d1, d2, d3, d4] = points;
    expect(d2.rawKg).toBeNull();
    expect(d3.rawKg).toBeNull();
    // EMA unchanged across the gap since raw stayed effectively flat
    expect(d2.emaKg).toBeCloseTo(d1.emaKg, 5);
    expect(d3.emaKg).toBeCloseTo(d1.emaKg, 5);
    expect(d4.rawKg).toBeCloseTo(70, 5);
  });

  it("EMA moves toward new weigh-ins at alpha=0.25", () => {
    const points = computeWeightEMA([
      { date: "2026-06-01", weightKg: 70 },
      { date: "2026-06-02", weightKg: 74 },
    ]);
    // ema = 0.25*74 + 0.75*70 = 71
    expect(points[1].emaKg).toBeCloseTo(71, 5);
  });

  it("output is sorted chronologically and fills every calendar day in range", () => {
    const input: WeighIn[] = [
      { date: "2026-06-05", weightKg: 71 },
      { date: "2026-06-01", weightKg: 70 },
    ];
    const points = computeWeightEMA(input);
    expect(points.map((p) => p.date)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });
});

describe("emaSlopeKgPerWeek", () => {
  it("returns null with fewer than 2 points", () => {
    expect(emaSlopeKgPerWeek([])).toBeNull();
    expect(emaSlopeKgPerWeek([{ date: "2026-06-01", rawKg: 70, emaKg: 70 }])).toBeNull();
  });

  it("computes positive slope for a gaining trend", () => {
    const points = computeWeightEMA([
      { date: "2026-06-01", weightKg: 70 },
      { date: "2026-06-08", weightKg: 74 },
    ]);
    const slope = emaSlopeKgPerWeek(points, 14);
    expect(slope).not.toBeNull();
    expect(slope!).toBeGreaterThan(0);
  });

  it("computes negative slope for a losing trend", () => {
    const points = computeWeightEMA([
      { date: "2026-06-01", weightKg: 74 },
      { date: "2026-06-08", weightKg: 70 },
    ]);
    const slope = emaSlopeKgPerWeek(points, 14);
    expect(slope!).toBeLessThan(0);
  });

  it("restricts to the trailing window when more history exists", () => {
    const points = computeWeightEMA([
      { date: "2026-05-01", weightKg: 90 }, // far past, should be excluded by window
      { date: "2026-06-01", weightKg: 70 },
      { date: "2026-06-08", weightKg: 71 },
    ]);
    const slope = emaSlopeKgPerWeek(points, 14);
    expect(slope).not.toBeNull();
    // sanity: slope shouldn't be wildly large from the stale 90kg point
    expect(Math.abs(slope!)).toBeLessThan(5);
  });
});

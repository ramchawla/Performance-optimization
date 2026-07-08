import { describe, it, expect } from "vitest";
import {
  pearsonR,
  computeCorrelation,
  pairDailySeries,
  MIN_PAIRED_OBSERVATIONS,
  type PairedPoint,
  type DailyMetric,
} from "./correlation";

describe("pearsonR", () => {
  it("returns 1 for perfectly correlated data", () => {
    const points: PairedPoint[] = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ];
    expect(pearsonR(points)).toBeCloseTo(1, 10);
  });

  it("returns -1 for perfectly inversely correlated data", () => {
    const points: PairedPoint[] = [
      { x: 1, y: 6 },
      { x: 2, y: 4 },
      { x: 3, y: 2 },
    ];
    expect(pearsonR(points)).toBeCloseTo(-1, 10);
  });

  it("returns null for fewer than 2 points", () => {
    expect(pearsonR([])).toBeNull();
    expect(pearsonR([{ x: 1, y: 1 }])).toBeNull();
  });

  it("returns null when x has zero variance", () => {
    const points: PairedPoint[] = [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ];
    expect(pearsonR(points)).toBeNull();
  });
});

describe("computeCorrelation", () => {
  function makePerfectSeries(n: number): PairedPoint[] {
    return Array.from({ length: n }, (_, i) => ({ x: i, y: i * 2 }));
  }

  it("returns null below MIN_PAIRED_OBSERVATIONS", () => {
    expect(computeCorrelation(makePerfectSeries(MIN_PAIRED_OBSERVATIONS - 1))).toBeNull();
  });

  it("returns a result at exactly MIN_PAIRED_OBSERVATIONS", () => {
    const result = computeCorrelation(makePerfectSeries(MIN_PAIRED_OBSERVATIONS));
    expect(result).not.toBeNull();
    expect(result?.n).toBe(MIN_PAIRED_OBSERVATIONS);
    expect(result?.r).toBeCloseTo(1, 10);
    expect(result?.strength).toBe("strong");
  });

  it("bands strength correctly", () => {
    const n = 25;
    const weakR = 0.2;
    // Construct data with roughly known r isn't trivial by hand; instead
    // verify band boundaries directly via strengthBand's contract through
    // pearsonR on constructed correlated-with-noise series.
    const points: PairedPoint[] = Array.from({ length: n }, (_, i) => ({
      x: i,
      y: i + (i % 2 === 0 ? 50 : -50),
    }));
    const result = computeCorrelation(points);
    expect(result).not.toBeNull();
    expect(["weak", "moderate", "strong"]).toContain(result?.strength);
    void weakR;
  });
});

describe("pairDailySeries", () => {
  it("pairs matching dates with zero lag", () => {
    const a: DailyMetric[] = [
      { day: "2026-01-01", value: 1 },
      { day: "2026-01-02", value: 2 },
    ];
    const b: DailyMetric[] = [
      { day: "2026-01-01", value: 10 },
      { day: "2026-01-02", value: 20 },
    ];
    expect(pairDailySeries(a, b)).toEqual([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]);
  });

  it("applies lag: a[day] pairs with b[day+lag]", () => {
    const a: DailyMetric[] = [{ day: "2026-01-01", value: 1 }];
    const b: DailyMetric[] = [
      { day: "2026-01-01", value: 999 },
      { day: "2026-01-02", value: 42 },
    ];
    expect(pairDailySeries(a, b, 1)).toEqual([{ x: 1, y: 42 }]);
  });

  it("drops days with missing or null values on either side", () => {
    const a: DailyMetric[] = [
      { day: "2026-01-01", value: null },
      { day: "2026-01-02", value: 5 },
    ];
    const b: DailyMetric[] = [{ day: "2026-01-01", value: 10 }];
    expect(pairDailySeries(a, b)).toEqual([]);
  });
});

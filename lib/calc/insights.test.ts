import { describe, expect, it } from "vitest";
import { buildInsights, type InsightNight } from "./insights";

/** n nights ending 2026-09-24, oldest first. */
function series(n: number, f: (i: number) => Omit<InsightNight, "date">): InsightNight[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 24 - (n - 1 - i)));
    return { date: d.toISOString().slice(0, 10), ...f(i) };
  });
}

describe("buildInsights — tag effects", () => {
  it("reports a tag that moves sleep score, with its sample sizes", () => {
    const nights = series(12, (i) =>
      i % 3 === 0
        ? { metrics: { sleep_score: 65, hrv_ms: 40 }, tags: ["alcohol"] }
        : { metrics: { sleep_score: 80, hrv_ms: 48 }, tags: [] }
    );
    const tag = buildInsights(nights, "2026-09-24").find((x) => x.id === "tag:alcohol");
    expect(tag).toBeDefined();
    expect(tag!.tone).toBe("warn");
    expect(tag!.detail).toContain("n=4");
    expect(tag!.title).toMatch(/15/);
  });

  it("stays quiet below 3 tagged nights", () => {
    const nights = series(12, (i) =>
      i < 2 ? { metrics: { sleep_score: 50 }, tags: ["alcohol"] } : { metrics: { sleep_score: 80 }, tags: [] }
    );
    expect(buildInsights(nights, "2026-09-24").some((x) => x.id === "tag:alcohol")).toBe(false);
  });

  it("stays quiet when the difference is small", () => {
    const nights = series(12, (i) =>
      i % 3 === 0 ? { metrics: { sleep_score: 78 }, tags: ["screens"] } : { metrics: { sleep_score: 80 }, tags: [] }
    );
    expect(buildInsights(nights, "2026-09-24").some((x) => x.id === "tag:screens")).toBe(false);
  });
});

describe("buildInsights — baseline alerts", () => {
  it("flags HRV well below normal today", () => {
    const nights = series(15, (i) => ({ metrics: { hrv_ms: i === 14 ? 30 : 44 + (i % 3) }, tags: [] }));
    const hrv = buildInsights(nights, "2026-09-24").find((x) => x.id === "baseline:hrv_ms");
    expect(hrv?.tone).toBe("warn");
  });

  it("needs 7 prior nights before judging", () => {
    const nights = series(5, (i) => ({ metrics: { hrv_ms: i === 4 ? 20 : 45 }, tags: [] }));
    expect(buildInsights(nights, "2026-09-24").some((x) => x.id.startsWith("baseline:"))).toBe(false);
  });
});

describe("buildInsights — sleep debt and timing", () => {
  it("flags a 7-day sleep debt over 3 hours", () => {
    const nights = series(7, () => ({ metrics: { sleep_duration_s: 6 * 3600, sleep_need_s: 8 * 3600 }, tags: [] }));
    const debt = buildInsights(nights, "2026-09-24").find((x) => x.id === "sleep_debt");
    expect(debt?.title).toContain("14h");
  });

  it("flags irregular bedtimes (SD over an hour)", () => {
    const nights = series(10, (i) => ({ metrics: { sleep_start_offset_s: i % 2 ? -2 * 3600 : 1.5 * 3600 }, tags: [] }));
    expect(buildInsights(nights, "2026-09-24").some((x) => x.id === "bedtime_consistency")).toBe(true);
  });

  it("returns nothing for no data", () => {
    expect(buildInsights([], "2026-09-24")).toEqual([]);
  });
});

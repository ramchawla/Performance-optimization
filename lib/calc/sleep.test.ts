import { describe, expect, it } from "vitest";
import {
  baseline,
  deltaVsBaseline,
  formatClock,
  formatDuration,
  hypnogramSegments,
  stageMix,
  timeSeries,
  timingConsistency,
} from "./sleep";

describe("baseline", () => {
  it("returns null below 7 nights — no fake baseline from a few samples", () => {
    expect(baseline([40, 42, 44, 46, 48, 50])).toBeNull();
  });

  it("computes mean and sample SD", () => {
    const b = baseline([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(b.n).toBe(8);
    expect(b.mean).toBe(5);
    expect(b.sd).toBeCloseTo(2.138, 3);
  });

  it("ignores non-finite values when counting", () => {
    expect(baseline([1, 2, 3, 4, 5, 6, NaN, Infinity])).toBeNull();
  });
});

describe("deltaVsBaseline", () => {
  const base = { mean: 50, sd: 5, n: 20 };

  it("marks a higher HRV as good", () => {
    const d = deltaVsBaseline(60, base, true);
    expect(d.delta).toBe(10);
    expect(d.z).toBe(2);
    expect(d.tone).toBe("good");
  });

  it("marks a higher resting HR as bad (lower is better)", () => {
    expect(deltaVsBaseline(60, base, false).tone).toBe("bad");
  });

  it("is neutral within half an SD", () => {
    expect(deltaVsBaseline(52, base, true).tone).toBe("neutral");
  });

  it("is neutral with zero spread instead of dividing by zero", () => {
    const d = deltaVsBaseline(55, { mean: 50, sd: 0, n: 7 }, true);
    expect(d.z).toBe(0);
    expect(d.tone).toBe("neutral");
  });
});

describe("hypnogramSegments", () => {
  // Shape copied from a real Fenix 7 night (sleepLevels in the getSleepData payload).
  const levels = [
    { startGMT: "2026-09-23T05:37:47.0", endGMT: "2026-09-23T06:07:47.0", activityLevel: 0 },
    { startGMT: "2026-09-23T05:22:47.0", endGMT: "2026-09-23T05:37:47.0", activityLevel: 1 },
    { startGMT: "2026-09-23T06:07:47.0", endGMT: "2026-09-23T06:27:47.0", activityLevel: 2 },
    { startGMT: "2026-09-23T06:27:47.0", endGMT: "2026-09-23T06:28:47.0", activityLevel: 3 },
  ];

  it("sorts and maps the verified codes (0 deep, 1 light, 2 REM, 3 awake)", () => {
    expect(hypnogramSegments(levels)).toEqual([
      { stage: "light", startMin: 0, endMin: 15 },
      { stage: "deep", startMin: 15, endMin: 45 },
      { stage: "rem", startMin: 45, endMin: 65 },
      { stage: "awake", startMin: 65, endMin: 66 },
    ]);
  });

  it("drops unknown codes, zero-length and malformed entries", () => {
    const segs = hypnogramSegments([
      ...levels,
      { startGMT: "2026-09-23T07:00:00.0", endGMT: "2026-09-23T07:10:00.0", activityLevel: 7 },
      { startGMT: "2026-09-23T07:10:00.0", endGMT: "2026-09-23T07:10:00.0", activityLevel: 1 },
      { startGMT: "garbage", endGMT: "2026-09-23T07:20:00.0", activityLevel: 1 },
    ]);
    expect(segs).toHaveLength(4);
  });

  it("returns [] for missing input", () => {
    expect(hypnogramSegments(undefined)).toEqual([]);
    expect(hypnogramSegments("nope")).toEqual([]);
  });
});

describe("stageMix", () => {
  it("rounds to percentages that sum to exactly 100", () => {
    const mix = stageMix({ deep: 4920, light: 14040, rem: 7080, awake: 60 });
    expect(mix.deep + mix.light + mix.rem + mix.awake).toBe(100);
    expect(mix).toEqual({ deep: 19, light: 54, rem: 27, awake: 0 });
  });

  it("splits thirds with largest-remainder rounding", () => {
    const mix = stageMix({ deep: 1, light: 1, rem: 1, awake: 0 });
    expect(mix.deep + mix.light + mix.rem + mix.awake).toBe(100);
  });

  it("is all zeros for an empty night", () => {
    expect(stageMix({ deep: 0, light: 0, rem: 0, awake: 0 })).toEqual({ deep: 0, light: 0, rem: 0, awake: 0 });
  });
});

describe("timingConsistency", () => {
  it("needs at least 3 nights", () => {
    expect(timingConsistency([0, 600])).toBeNull();
  });

  it("handles bedtimes either side of midnight (offsets, not clock times)", () => {
    // 23:30, 00:30, 00:00 → offsets -1800, 1800, 0 → sample SD 30 min
    expect(timingConsistency([-1800, 1800, 0])).toBeCloseTo(30, 5);
  });
});

describe("formatClock", () => {
  it("formats positive offsets", () => {
    expect(formatClock(3 * 3600 + 9 * 60 + 45)).toBe("03:09");
  });

  it("formats negative offsets as the previous evening", () => {
    expect(formatClock(-3600)).toBe("23:00");
    expect(formatClock(-90 * 60)).toBe("22:30");
  });
});

describe("timeSeries", () => {
  it("sorts by time, drops null/non-finite values, keeps order stable", () => {
    const points = [
      { startGMT: 3000, value: 60 },
      { startGMT: 1000, value: 65 },
      { startGMT: 2000, value: null },
      { startGMT: 4000, value: 58 },
    ];
    expect(timeSeries(points, "startGMT", "value")).toEqual([
      { t: 1000, v: 65 },
      { t: 3000, v: 60 },
      { t: 4000, v: 58 },
    ]);
  });

  it("returns [] for non-array input", () => {
    expect(timeSeries(null, "startGMT", "value")).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("renders hours and minutes", () => {
    expect(formatDuration(7 * 3600 + 25 * 60)).toBe("7h 25m");
  });

  it("drops the hour part under an hour", () => {
    expect(formatDuration(45 * 60)).toBe("45m");
  });

  it("clamps negatives to zero", () => {
    expect(formatDuration(-500)).toBe("0m");
  });
});

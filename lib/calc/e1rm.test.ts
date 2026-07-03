import { describe, it, expect } from "vitest";
import {
  epley1RM,
  bestSessionE1RM,
  buildProgressSeries,
  currentPR,
  readyToProgress,
  type SessionForProgress,
} from "./e1rm";

describe("epley1RM", () => {
  it("computes standard Epley estimate", () => {
    expect(epley1RM(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });

  it("returns null for reps > 12 (formula exclusion rule)", () => {
    expect(epley1RM(100, 13)).toBeNull();
  });

  it("returns null for zero or negative weight/reps", () => {
    expect(epley1RM(0, 5)).toBeNull();
    expect(epley1RM(100, 0)).toBeNull();
    expect(epley1RM(-10, 5)).toBeNull();
  });

  it("boundary: reps === 12 is valid", () => {
    expect(epley1RM(100, 12)).not.toBeNull();
  });
});

describe("bestSessionE1RM", () => {
  it("excludes warmup sets", () => {
    const sets = [
      { reps: 10, weightKg: 40, isWarmup: true }, // would be huge e1rm if counted
      { reps: 5, weightKg: 100, isWarmup: false },
    ];
    const result = bestSessionE1RM(sets);
    expect(result).toBeCloseTo(epley1RM(100, 5)!, 5);
  });

  it("returns null when all sets are warmups", () => {
    expect(bestSessionE1RM([{ reps: 10, weightKg: 40, isWarmup: true }])).toBeNull();
  });

  it("returns null when all sets exceed the 12-rep cutoff", () => {
    expect(bestSessionE1RM([{ reps: 20, weightKg: 40, isWarmup: false }])).toBeNull();
  });

  it("picks the highest e1RM among multiple working sets", () => {
    const sets = [
      { reps: 8, weightKg: 80, isWarmup: false },
      { reps: 3, weightKg: 110, isWarmup: false },
    ];
    const best = bestSessionE1RM(sets);
    expect(best).toBeCloseTo(Math.max(epley1RM(80, 8)!, epley1RM(110, 3)!), 5);
  });
});

describe("buildProgressSeries", () => {
  const sessions: SessionForProgress[] = [
    {
      sessionId: "s1",
      performedAt: "2026-06-01",
      isDeload: false,
      sets: [{ reps: 5, weightKg: 100, isWarmup: false }],
    },
    {
      sessionId: "s2-deload",
      performedAt: "2026-06-08",
      isDeload: true,
      sets: [{ reps: 5, weightKg: 60, isWarmup: false }],
    },
    {
      sessionId: "s3",
      performedAt: "2026-05-25",
      isDeload: false,
      sets: [{ reps: 5, weightKg: 95, isWarmup: false }],
    },
  ];

  it("excludes deload sessions entirely", () => {
    const series = buildProgressSeries(sessions);
    expect(series.find((p) => p.sessionId === "s2-deload")).toBeUndefined();
    expect(series).toHaveLength(2);
  });

  it("sorts ascending by date", () => {
    const series = buildProgressSeries(sessions);
    expect(series[0].sessionId).toBe("s3");
    expect(series[1].sessionId).toBe("s1");
  });
});

describe("currentPR", () => {
  it("returns the max e1RM point, deload-excluded", () => {
    const sessions: SessionForProgress[] = [
      { sessionId: "a", performedAt: "2026-06-01", isDeload: false, sets: [{ reps: 5, weightKg: 100, isWarmup: false }] },
      { sessionId: "b-deload-huge", performedAt: "2026-06-05", isDeload: true, sets: [{ reps: 1, weightKg: 999, isWarmup: false }] },
      { sessionId: "c", performedAt: "2026-06-10", isDeload: false, sets: [{ reps: 3, weightKg: 110, isWarmup: false }] },
    ];
    const pr = currentPR(sessions);
    expect(pr?.sessionId).toBe("c");
  });

  it("returns null with no eligible sessions", () => {
    expect(currentPR([])).toBeNull();
  });
});

describe("readyToProgress", () => {
  it("true when all working sets hit target reps at/under target RPE", () => {
    const sets = [
      { reps: 10, rpe: 7, isWarmup: false },
      { reps: 10, rpe: 7.5, isWarmup: false },
    ];
    expect(readyToProgress(sets, 10, 8)).toBe(true);
  });

  it("false when any working set misses target reps", () => {
    const sets = [
      { reps: 10, rpe: 7, isWarmup: false },
      { reps: 8, rpe: 7, isWarmup: false },
    ];
    expect(readyToProgress(sets, 10, 8)).toBe(false);
  });

  it("false when RPE exceeds target even if reps hit", () => {
    const sets = [{ reps: 10, rpe: 9.5, isWarmup: false }];
    expect(readyToProgress(sets, 10, 8)).toBe(false);
  });

  it("ignores warmup sets in the evaluation", () => {
    const sets = [
      { reps: 1, rpe: 10, isWarmup: true },
      { reps: 10, rpe: 7, isWarmup: false },
    ];
    expect(readyToProgress(sets, 10, 8)).toBe(true);
  });
});

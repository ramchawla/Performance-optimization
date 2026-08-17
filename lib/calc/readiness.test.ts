import { describe, expect, it } from "vitest";
import { deriveReadinessScore } from "./readiness";

describe("deriveReadinessScore", () => {
  it("returns null when nothing was rated — an empty check-in is unknown, not average", () => {
    expect(deriveReadinessScore({})).toBeNull();
    expect(deriveReadinessScore({ energy: null, mood: null })).toBeNull();
  });

  it("maps an all-5 day to the top of the scale", () => {
    expect(deriveReadinessScore({ energy: 5, mood: 5, motivation: 5 })).toBe(10);
  });

  it("maps an all-1 day to the bottom", () => {
    expect(deriveReadinessScore({ energy: 1, mood: 1, motivation: 1 })).toBe(1);
  });

  it("flips the negative fields so high stress lowers the score", () => {
    const calm = deriveReadinessScore({ stress: 1 });
    const frazzled = deriveReadinessScore({ stress: 5 });
    expect(calm).toBe(10);
    expect(frazzled).toBe(1);
  });

  it("treats soreness and joint stiffness as negatives too", () => {
    expect(deriveReadinessScore({ soreness: 5 })).toBe(1);
    expect(deriveReadinessScore({ joint_stiffness: 5 })).toBe(1);
  });

  it("scores only the fields that were answered", () => {
    // energy 5 alone should not be dragged down by the eight unanswered fields.
    expect(deriveReadinessScore({ energy: 5 })).toBe(10);
  });

  it("averages mixed positive and negative fields", () => {
    // energy 4, stress 2 (-> 4). Mean 4 -> 7.75 -> 8.
    expect(deriveReadinessScore({ energy: 4, stress: 2 })).toBe(8);
  });

  it("stays inside 1..10", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const score = deriveReadinessScore({ energy: n, mood: n, stress: 6 - n })!;
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    }
  });
});

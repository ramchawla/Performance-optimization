import { describe, expect, it } from "vitest";
import { recoveryScore } from "./recovery";

const base = (mean: number, sd: number) => ({ mean, sd, n: 20 });
const baselines = {
  hrv: base(45, 5),
  rhr: base(60, 3),
  sleepScore: base(75, 8),
};

describe("recoveryScore", () => {
  it("is 50 on a perfectly normal day", () => {
    const r = recoveryScore({ hrv: 45, rhr: 60, sleepScore: 75 }, baselines)!;
    expect(r.score).toBe(50);
    expect(r.band).toBe("normal");
  });

  it("rises when HRV is up and RHR is down", () => {
    const r = recoveryScore({ hrv: 55, rhr: 57, sleepScore: 83 }, baselines)!;
    expect(r.score).toBeGreaterThan(70);
    expect(r.band).toBe("high");
  });

  it("falls when HRV is down and RHR is up", () => {
    const r = recoveryScore({ hrv: 35, rhr: 66, sleepScore: 60 }, baselines)!;
    expect(r.score).toBeLessThan(30);
    expect(r.band).toBe("low");
  });

  it("clamps to 0–100", () => {
    const r = recoveryScore({ hrv: 5, rhr: 90, sleepScore: 10 }, baselines)!;
    expect(r.score).toBe(0);
  });

  it("needs HRV — the backbone of the score — and its baseline", () => {
    expect(recoveryScore({ hrv: undefined, rhr: 60, sleepScore: 75 }, baselines)).toBeNull();
    expect(recoveryScore({ hrv: 45, rhr: 60, sleepScore: 75 }, { ...baselines, hrv: null })).toBeNull();
  });

  it("reweights over what's present when RHR or sleep is missing", () => {
    const r = recoveryScore({ hrv: 50, rhr: undefined, sleepScore: undefined }, baselines)!;
    // HRV alone at +1 SD → 50 + 15
    expect(r.score).toBe(65);
    expect(r.components.map((c) => c.key)).toEqual(["hrv"]);
  });

  it("reports each component's contribution for the breakdown UI", () => {
    const r = recoveryScore({ hrv: 50, rhr: 63, sleepScore: 75 }, baselines)!;
    const rhr = r.components.find((c) => c.key === "rhr")!;
    expect(rhr.z).toBeCloseTo(-1, 5); // RHR up 1 SD is bad → z flipped negative
  });
});

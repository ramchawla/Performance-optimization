import { describe, expect, it } from "vitest";
import { hrZones, laps, strengthSets } from "./activity";

// Fixtures follow community-documented Garmin shapes (python-garminconnect).
// UNVERIFIED against this account until the first watch-recorded activity syncs —
// re-check these against garmin_payloads then.

describe("hrZones", () => {
  it("sorts zones and computes each zone's share of time", () => {
    const z = hrZones([
      { zoneNumber: 2, secsInZone: 600, zoneLowBoundary: 120 },
      { zoneNumber: 1, secsInZone: 300, zoneLowBoundary: 100 },
      { zoneNumber: 3, secsInZone: 300, zoneLowBoundary: 140 },
    ]);
    expect(z.map((x) => x.zone)).toEqual([1, 2, 3]);
    expect(z[1]).toEqual({ zone: 2, seconds: 600, lowBpm: 120, pct: 50 });
  });

  it("tolerates junk and empty input", () => {
    expect(hrZones(null)).toEqual([]);
    expect(hrZones([{ zoneNumber: "x" }, { zoneNumber: 1, secsInZone: 0 }])).toEqual([
      { zone: 1, seconds: 0, lowBpm: null, pct: 0 },
    ]);
  });
});

describe("laps", () => {
  it("reads lapDTOs with pace from speed", () => {
    const l = laps({
      lapDTOs: [
        { distance: 1000, duration: 300, averageHR: 150, averageSpeed: 3.333 },
        { distance: 500, duration: 160, averageHR: null, averageSpeed: 3.125 },
      ],
    });
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ index: 1, distanceM: 1000, durationS: 300, avgHr: 150 });
    expect(l[1].avgHr).toBeNull();
  });

  it("returns [] when there are no laps", () => {
    expect(laps({})).toEqual([]);
    expect(laps(undefined)).toEqual([]);
  });
});

describe("strengthSets", () => {
  const payload = {
    exerciseSets: [
      { setType: "ACTIVE", repetitionCount: 8, weight: 60000, duration: 40, exercises: [{ category: "BENCH_PRESS", name: "BARBELL_BENCH_PRESS" }] },
      { setType: "REST", duration: 90, exercises: [] },
      { setType: "ACTIVE", repetitionCount: 6, weight: 65000, duration: 38, exercises: [{ category: "BENCH_PRESS", name: "BARBELL_BENCH_PRESS" }] },
      { setType: "ACTIVE", repetitionCount: 10, weight: null, duration: 30, exercises: [{ category: "PULL_UP", name: null }] },
    ],
  };

  it("groups active sets by exercise, skips rest, converts grams to kg", () => {
    const groups = strengthSets(payload);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe("Barbell bench press");
    expect(groups[0].sets).toEqual([
      { reps: 8, weightKg: 60 },
      { reps: 6, weightKg: 65 },
    ]);
    expect(groups[1]).toEqual({ name: "Pull up", sets: [{ reps: 10, weightKg: null }] });
  });

  it("returns [] for non-strength payloads", () => {
    expect(strengthSets(null)).toEqual([]);
    expect(strengthSets({ exerciseSets: "nope" })).toEqual([]);
  });
});

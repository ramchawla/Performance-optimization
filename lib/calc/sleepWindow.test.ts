import { describe, expect, it } from "vitest";
import { formatDuration, resolveSleepWindow } from "./sleepWindow";

// Timestamps go to Postgres as UTC ISO strings, so assert on the local
// calendar date they represent rather than on the ISO text.
const localDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

describe("resolveSleepWindow", () => {
  it("rolls bedtime back a day for an overnight sleep", () => {
    const w = resolveSleepWindow("2026-08-15", "23:20", "06:45")!;
    expect(localDate(w.bedtimeAt)).toBe("2026-08-14");
    expect(localDate(w.waketimeAt)).toBe("2026-08-15");
    expect(w.durationS).toBe(7 * 3600 + 25 * 60);
  });

  it("keeps bedtime on the log date when it precedes wake time", () => {
    const w = resolveSleepWindow("2026-08-15", "02:00", "09:30")!;
    expect(localDate(w.bedtimeAt)).toBe("2026-08-15");
    expect(w.durationS).toBe(7 * 3600 + 30 * 60);
  });

  it("treats equal times as a full 24h roll-back rather than zero", () => {
    const w = resolveSleepWindow("2026-08-15", "23:00", "23:00")!;
    expect(w.durationS).toBe(24 * 3600);
  });

  it("crosses a month boundary", () => {
    const w = resolveSleepWindow("2026-09-01", "22:30", "06:00")!;
    expect(localDate(w.bedtimeAt)).toBe("2026-08-31");
    expect(w.durationS).toBe(7 * 3600 + 30 * 60);
  });

  it("returns null on malformed input", () => {
    expect(resolveSleepWindow("2026-08-15", "", "06:45")).toBeNull();
    expect(resolveSleepWindow("2026-08-15", "23:20", "6:45")).toBeNull();
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

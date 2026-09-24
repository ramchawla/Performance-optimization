import { describe, expect, it } from "vitest";
import { syncAgeLabel, weeklyIntensityMinutes } from "./garmin";

describe("syncAgeLabel", () => {
  const now = Date.UTC(2026, 8, 24, 21, 37); // 21:37 UTC
  const minutes = (ms: number) => Math.round(ms / 60_000);

  it("says 'just now' under 5 minutes", () => {
    expect(syncAgeLabel(minutes(now - 2 * 60_000), now)).toEqual({ label: "just now", stale: false });
  });

  it("reports minutes, then hours", () => {
    expect(syncAgeLabel(minutes(now - 40 * 60_000), now)!.label).toBe("40m ago");
    expect(syncAgeLabel(minutes(Date.UTC(2026, 8, 24, 19, 0)), now)!.label).toBe("2h ago");
  });

  it("flags stale after 2 hours — the lag that looked like a sync bug", () => {
    expect(syncAgeLabel(minutes(now - 90 * 60_000), now)!.stale).toBe(false);
    expect(syncAgeLabel(minutes(now - 150 * 60_000), now)!.stale).toBe(true);
  });

  it("reports days past 24h", () => {
    expect(syncAgeLabel(minutes(now - 50 * 3600_000), now)!.label).toBe("2d ago");
  });

  it("returns null without a timestamp", () => {
    expect(syncAgeLabel(undefined, now)).toBeNull();
  });
});

describe("weeklyIntensityMinutes", () => {
  it("counts vigorous minutes double, as Garmin's 150/week goal does", () => {
    expect(
      weeklyIntensityMinutes([
        { moderate: 20, vigorous: 10 },
        { moderate: 0, vigorous: 5 },
        { moderate: undefined, vigorous: undefined },
      ])
    ).toBe(20 + 20 + 10);
  });

  it("is 0 for no days", () => {
    expect(weeklyIntensityMinutes([])).toBe(0);
  });
});

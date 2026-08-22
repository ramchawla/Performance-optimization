import { describe, expect, it } from "vitest";
import { shiftDate } from "./datetime";

describe("shiftDate", () => {
  it("moves forward and back", () => {
    expect(shiftDate("2026-08-22", 1)).toBe("2026-08-23");
    expect(shiftDate("2026-08-22", -1)).toBe("2026-08-21");
    expect(shiftDate("2026-08-22", 0)).toBe("2026-08-22");
  });

  it("crosses month and year boundaries", () => {
    expect(shiftDate("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDate("2026-09-01", -1)).toBe("2026-08-31");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap days", () => {
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDate("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("does not lose a day across a DST transition", () => {
    // US DST starts 2026-03-08 and ends 2026-11-01. Anchoring at local
    // midnight instead of UTC midday is what makes date arithmetic silently
    // skip or repeat a day here.
    expect(shiftDate("2026-03-07", 1)).toBe("2026-03-08");
    expect(shiftDate("2026-03-08", 1)).toBe("2026-03-09");
    expect(shiftDate("2026-11-01", 1)).toBe("2026-11-02");
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("round-trips", () => {
    expect(shiftDate(shiftDate("2026-08-22", 7), -7)).toBe("2026-08-22");
  });
});

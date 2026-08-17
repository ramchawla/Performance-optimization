import { describe, expect, it } from "vitest";
import { formatDistance, formatPace } from "./pace";

describe("formatDistance", () => {
  it("converts metres to the display unit", () => {
    expect(formatDistance(5000, "km")).toBe("5 km");
    expect(formatDistance(1609.344, "mi")).toBe("1 mi");
  });

  it("renders an em dash when there's no distance", () => {
    expect(formatDistance(null, "km")).toBe("—");
  });
});

describe("formatPace", () => {
  it("gives min:sec per unit", () => {
    // 5 km in 25 min -> 5:00 /km
    expect(formatPace(5000, 25 * 60, "km")).toBe("5:00 /km");
  });

  it("pads the seconds", () => {
    // 5 km in 26 min -> 5:12 /km
    expect(formatPace(5000, 26 * 60, "km")).toBe("5:12 /km");
  });

  it("converts for miles", () => {
    expect(formatPace(1609.344, 8 * 60, "mi")).toBe("8:00 /mi");
  });

  it("needs both distance and duration", () => {
    expect(formatPace(null, 1500, "km")).toBe("—");
    expect(formatPace(5000, null, "km")).toBe("—");
    expect(formatPace(0, 1500, "km")).toBe("—");
  });
});

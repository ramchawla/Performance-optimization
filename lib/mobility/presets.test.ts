import { describe, expect, it } from "vitest";
import { filterPresets, PRESETS, presetSeconds, type Preset } from "./presets";

const bandOnly: Preset = {
  id: "t-band",
  name: "Band only",
  minutes: 10,
  equipment: ["band"],
  bodyParts: ["shoulders"],
  summary: "",
  exercises: [{ name: "Pull-apart", seconds: 60 }],
};
const bandAndRoller: Preset = { ...bandOnly, id: "t-both", equipment: ["band", "foam_roller"] };
const bodyweight: Preset = { ...bandOnly, id: "t-none", equipment: ["none"] };
const FIXTURES = [bandOnly, bandAndRoller, bodyweight];

describe("presetSeconds", () => {
  it("counts per-side blocks twice", () => {
    const preset: Preset = {
      ...bodyweight,
      exercises: [
        { name: "a", seconds: 60 },
        { name: "b", seconds: 45, perSide: true },
      ],
    };
    expect(presetSeconds(preset)).toBe(60 + 90);
  });
});

describe("filterPresets", () => {
  it("treats bodyweight routines as always available", () => {
    expect(filterPresets({ equipment: [] }, FIXTURES).map((p) => p.id)).toEqual(["t-none"]);
  });

  it("requires every listed item, not just one", () => {
    const ids = filterPresets({ equipment: ["band"] }, FIXTURES).map((p) => p.id);
    expect(ids).toContain("t-band");
    expect(ids).not.toContain("t-both");
  });

  it("unlocks multi-item routines once everything is owned", () => {
    const ids = filterPresets({ equipment: ["band", "foam_roller"] }, FIXTURES).map((p) => p.id);
    expect(ids).toEqual(["t-band", "t-both", "t-none"]);
  });

  it("narrows by duration, body part and condition", () => {
    expect(filterPresets({ minutes: 5 }).every((p) => p.minutes === 5)).toBe(true);
    expect(filterPresets({ bodyPart: "knees" }).every((p) => p.bodyParts.includes("knees"))).toBe(true);
    expect(filterPresets({ condition: "jumpers_knee" }).map((p) => p.id)).toEqual(["knees-10"]);
  });
});

describe("the shipped library", () => {
  it("has unique ids", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });

  it("keeps every routine within a few minutes of its advertised length", () => {
    for (const preset of PRESETS) {
      const minutes = presetSeconds(preset) / 60;
      expect(Math.abs(minutes - preset.minutes)).toBeLessThanOrEqual(preset.minutes * 0.35);
    }
  });

  it("offers something for every duration with no equipment at all", () => {
    for (const minutes of [5, 10, 15, 20, 30] as const) {
      expect(filterPresets({ minutes, equipment: [] }).length).toBeGreaterThan(0);
    }
  });

  it("covers each named condition", () => {
    for (const condition of [
      "jumpers_knee",
      "rounded_shoulders",
      "anterior_pelvic_tilt",
      "tight_hip_flexors",
      "ankle_stiffness",
    ] as const) {
      expect(filterPresets({ condition }).length).toBeGreaterThan(0);
    }
  });
});

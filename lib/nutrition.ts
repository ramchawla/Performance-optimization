/**
 * Micro vocabulary — TECHNICAL-DESIGN §5: don't chase full micronutrient
 * coverage in v1, B12 + iron + vitamin D is the useful subset (calcium/zinc/
 * folate ride along since they're equally cheap to store). Keys match the
 * jsonb shape stored on foods.micros / nutrition_logs.micros.
 */
export const MICRO_VOCAB = {
  b12_mcg: "Vitamin B12",
  iron_mg: "Iron",
  calcium_mg: "Calcium",
  vit_d_mcg: "Vitamin D",
  zinc_mg: "Zinc",
  folate_mcg: "Folate",
} as const;

export type MicroKey = keyof typeof MICRO_VOCAB;

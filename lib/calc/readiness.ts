/**
 * The check-in fields, in the order they're asked. `invert` marks the ones
 * where a high number is bad — needed so an overall score doesn't treat
 * "very stressed" as a good day.
 */
export const READINESS_FIELDS = [
  { key: "energy", label: "Energy", low: "Drained", high: "Wired" },
  { key: "mood", label: "Mood", low: "Low", high: "Great" },
  { key: "motivation", label: "Motivation to train", low: "None", high: "Raring" },
  { key: "stress", label: "Stress", low: "Calm", high: "Frazzled", invert: true },
  { key: "soreness", label: "Soreness", low: "None", high: "Wrecked", invert: true },
  { key: "mental_clarity", label: "Mental clarity", low: "Foggy", high: "Sharp" },
  { key: "appetite", label: "Appetite", low: "None", high: "Ravenous" },
  { key: "joint_stiffness", label: "Joint stiffness", low: "Loose", high: "Stiff", invert: true },
  { key: "libido", label: "Libido", low: "Low", high: "High" },
] as const;

export type ReadinessField = (typeof READINESS_FIELDS)[number]["key"];

export const ILLNESS_OPTIONS = ["none", "mild", "moderate", "severe"] as const;

/**
 * A 1–10 composite from whichever ratings were filled in, with the negative
 * ones flipped. Returns null when nothing was rated — an empty check-in
 * should read as "unknown", not as a middling score.
 */
export function deriveReadinessScore(ratings: Partial<Record<ReadinessField, number | null>>): number | null {
  const values: number[] = [];
  for (const field of READINESS_FIELDS) {
    const raw = ratings[field.key];
    if (raw === null || raw === undefined) continue;
    values.push("invert" in field && field.invert ? 6 - raw : raw);
  }
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // 1–5 mean onto a 1–10 scale.
  return Math.max(1, Math.min(10, Math.round(((mean - 1) / 4) * 9 + 1)));
}

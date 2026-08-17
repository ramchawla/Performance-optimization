/** "5.2 km" / "—". Distance is stored in metres (CLAUDE.md rule 1). */
export function formatDistance(distanceM: number | null, unit: "km" | "mi"): string {
  if (distanceM === null) return "—";
  const value = unit === "mi" ? distanceM / 1609.344 : distanceM / 1000;
  return `${Math.round(value * 100) / 100} ${unit}`;
}

/** Pace per km/mi, the number that actually means something for a run. */
export function formatPace(distanceM: number | null, durationS: number | null, unit: "km" | "mi"): string {
  if (!distanceM || !durationS) return "—";
  const units = unit === "mi" ? distanceM / 1609.344 : distanceM / 1000;
  if (units <= 0) return "—";
  const secPerUnit = durationS / units;
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")} /${unit}`;
}

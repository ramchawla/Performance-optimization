/**
 * Display-layer unit conversion only — DB always stores kg (CLAUDE.md rule 1).
 * Never persist a converted value; convert at render/input time.
 */

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function displayWeightKg(kg: number | null, unit: "kg" | "lb"): number | null {
  if (kg === null) return null;
  return unit === "lb" ? kgToLb(kg) : kg;
}

export function inputToKg(value: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? lbToKg(value) : value;
}

export function formatWeightKg(kg: number | null, unit: "kg" | "lb"): string {
  const value = displayWeightKg(kg, unit);
  if (value === null) return "—";
  return `${Math.round(value * 10) / 10} ${unit}`;
}

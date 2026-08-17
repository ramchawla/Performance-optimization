import { useProfile } from "@/lib/queries/settings";

export type WeightUnit = "kg" | "lb";
export type DistanceUnit = "km" | "mi";

/**
 * The user's display units. DB always stores kg/metres (CLAUDE.md rule 1) —
 * this only ever affects rendering and input parsing.
 *
 * Defaults to imperial while the profile loads so the first paint matches
 * what the value settles on, rather than flashing kg and swapping.
 */
export function useUnits(): { weight: WeightUnit; distance: DistanceUnit } {
  const { data: profile } = useProfile();
  return {
    weight: profile?.unit_weight === "kg" ? "kg" : "lb",
    distance: profile?.unit_distance === "km" ? "km" : "mi",
  };
}

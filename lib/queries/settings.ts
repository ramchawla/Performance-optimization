import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { setProfileTimezone } from "@/lib/datetime";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "display_name"
    | "unit_weight"
    | "unit_distance"
    | "height_cm"
    | "birth_date"
    | "sex"
    | "goal_weight_kg"
    | "goal_body_fat_pct"
    | "timezone"
    | "target_calories"
    | "target_protein_g"
    | "target_carbs_g"
    | "target_fat_g"
    | "target_calories_training_day"
    | "target_protein_training_day_g"
    | "target_carbs_training_day_g"
    | "target_fat_training_day_g"
  >
>;

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userData.user.id).single();
      if (error) throw error;
      // The one place the profile is ever loaded, so the one place worth
      // teaching lib/datetime which timezone dates belong to. Until this runs,
      // date helpers fall back to the device's zone — same as before.
      setProfileTimezone(data.timezone);
      return data;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { error } = await supabase.from("profiles").update(patch).eq("user_id", userData.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile", "nutrition-targets"] });
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type CoachNote = Database["public"]["Tables"]["ai_insights"]["Row"];

/** Latest note written by the Mac coach job (scripts/coach/). Null until it has run once. */
export function useLatestCoachNote() {
  return useQuery({
    queryKey: ["dashboard", "coach-note"],
    queryFn: async (): Promise<CoachNote | null> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

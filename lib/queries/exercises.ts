import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

/** Searches the shared + user's custom exercise library by name. Empty query returns the first 50 alphabetically. */
export function useExerciseSearch(query: string) {
  return useQuery({
    queryKey: ["exercises", "search", query],
    queryFn: async (): Promise<Exercise[]> => {
      const supabase = createClient();
      let q = supabase.from("exercises").select("*").order("name").limit(50);
      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/** Maps exercise id -> name, for rendering names in the active-session screen. */
export function useExercisesByIds(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["exercises", "byIds", key],
    queryFn: async (): Promise<Record<string, string>> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("exercises").select("id, name").in("id", key);
      if (error) throw error;
      return Object.fromEntries(data.map((e) => [e.id, e.name]));
    },
    enabled: key.length > 0,
  });
}

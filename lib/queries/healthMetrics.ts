import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Manual sleep entry — health_metrics has no client_id/outbox wiring (not
 * offline-writable per CLAUDE.md rule 3's table list), so this writes
 * directly, matching ingest-health's own upsert conflict target. */
export function useLogManualSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (hours: number) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      const { error: upsertErr } = await supabase.from("health_metrics").upsert(
        {
          user_id: userData.user.id,
          metric_type: "sleep_duration_s",
          metric_date: todayLocal(),
          value: hours * 3600,
          unit: "s",
          source: "manual",
        },
        { onConflict: "user_id,metric_type,metric_date,source" }
      );
      if (upsertErr) throw upsertErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}

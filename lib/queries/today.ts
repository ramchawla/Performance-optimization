import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { shiftDate, todayLocal } from "@/lib/datetime";
import { weeklyIntensityMinutes } from "@/lib/calc/garmin";

const TODAY_METRICS = [
  "steps",
  "calories_active_kcal",
  "calories_total_kcal",
  "intensity_min_moderate",
  "intensity_min_vigorous",
  "floors_up",
  "stress_avg",
  "body_battery_high",
  "body_battery_low",
  "spo2_avg",
  "resp_waking_avg",
  "resting_hr_bpm",
  "watch_last_sync_epoch_min",
  "training_readiness",
  "recovery_time_h",
] as const;

type TodayMetric = (typeof TODAY_METRICS)[number];

export interface GarminToday {
  today: Partial<Record<TodayMetric, number>>;
  /** Moderate + 2× vigorous over the last 7 days (Garmin's 150/week goal). */
  intensityWeek: number;
}

/**
 * Today's Garmin daily-summary numbers (garmin-sync → health_metrics), plus the
 * 7-day intensity total. Garmin-only on purpose: these metrics have no other source.
 */
export function useGarminToday() {
  return useQuery({
    queryKey: ["dashboard", "garmin-today"],
    queryFn: async (): Promise<GarminToday> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const today = todayLocal();
      const { data, error } = await supabase
        .from("health_metrics")
        .select("metric_date, metric_type, value")
        .eq("user_id", userData.user.id)
        .eq("source", "garmin")
        .gte("metric_date", shiftDate(today, -6))
        .in("metric_type", TODAY_METRICS);
      if (error) throw error;

      const todayValues: GarminToday["today"] = {};
      const byDate = new Map<string, { moderate?: number; vigorous?: number }>();
      for (const r of data) {
        const value = Number(r.value);
        if (r.metric_date === today) todayValues[r.metric_type as TodayMetric] = value;
        if (r.metric_type === "intensity_min_moderate" || r.metric_type === "intensity_min_vigorous") {
          const day = byDate.get(r.metric_date) ?? {};
          day[r.metric_type === "intensity_min_moderate" ? "moderate" : "vigorous"] = value;
          byDate.set(r.metric_date, day);
        }
      }
      return {
        today: todayValues,
        intensityWeek: weeklyIntensityMinutes([...byDate.values()].map((d) => ({ moderate: d.moderate, vigorous: d.vigorous }))),
      };
    },
  });
}

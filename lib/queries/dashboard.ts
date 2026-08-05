import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { computeWeightEMA, emaSlopeKgPerWeek } from "@/lib/calc/weightTrend";
import { buildProgressSeries, e1rmSlopePerWeek } from "@/lib/calc/e1rm";
import type { Database } from "@/lib/database.types";

export interface DashboardData {
  today: {
    day: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    trained: boolean;
  } | null;
  targets: {
    calories: number | null;
    proteinG: number | null;
  };
  weightSlopeKgPerWeek: number | null;
  strengthSlopeKgPerWeek: number | null;
  waistSlopeCmPerWeek: number | null;
  week: Array<{ date: string; trained: boolean }>;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Row shape returned by the nested workout_sessions -> session_exercises ->
// session_sets select below. The generated Supabase types don't model
// nested-select shapes, so we type the response manually (same pattern as
// lib/queries/sessions.ts's useSessionDetail) rather than fight the query
// builder's generic inference.
type SessionSetRow = Pick<
  Database["public"]["Tables"]["session_sets"]["Row"],
  "set_number" | "is_warmup" | "actual_reps" | "actual_weight_kg"
>;
type SessionExerciseRow = Pick<Database["public"]["Tables"]["session_exercises"]["Row"], "exercise_id"> & {
  session_sets: SessionSetRow[];
};
type WorkoutSessionRow = Pick<
  Database["public"]["Tables"]["workout_sessions"]["Row"],
  "id" | "started_at" | "is_deload"
> & {
  session_exercises: SessionExerciseRow[];
};

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const userId = userData.user.id;

      const todayIso = isoDate(new Date());
      const windowStart = isoDate(new Date(Date.now() - 35 * 86400000));

      const [rollupRes, profileRes, bodyRes, sessionsRes] = await Promise.all([
        supabase
          .from("daily_rollup")
          .select("day, calories, protein_g, carbs_g, fat_g, trained")
          .eq("user_id", userId)
          .gte("day", windowStart)
          .order("day"),
        supabase
          .from("profiles")
          .select("target_calories, target_protein_g")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("body_metrics")
          .select("measured_at, weight_kg, waist_cm")
          .eq("user_id", userId)
          .gte("measured_at", windowStart)
          .order("measured_at"),
        supabase
          .from("workout_sessions")
          .select(
            "id, started_at, is_deload, session_exercises(exercise_id, session_sets(set_number, is_warmup, actual_reps, actual_weight_kg))"
          )
          .eq("user_id", userId)
          .gte("started_at", windowStart)
          .not("completed_at", "is", null)
          .order("started_at"),
      ]);

      if (rollupRes.error) throw rollupRes.error;
      if (profileRes.error) throw profileRes.error;
      if (bodyRes.error) throw bodyRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      const rollupRows = rollupRes.data ?? [];
      const todayRow = rollupRows.find((r) => r.day === todayIso) ?? null;

      const weighIns = (bodyRes.data ?? [])
        .filter((b) => b.weight_kg !== null)
        .map((b) => ({ date: b.measured_at.slice(0, 10), weightKg: b.weight_kg as number }));
      const weightSlopeKgPerWeek = emaSlopeKgPerWeek(computeWeightEMA(weighIns), 14);

      const waistIns = (bodyRes.data ?? [])
        .filter((b) => b.waist_cm !== null)
        .map((b) => ({ date: b.measured_at.slice(0, 10), weightKg: b.waist_cm as number }));
      const waistSlopeCmPerWeek = waistIns.length > 0 ? emaSlopeKgPerWeek(computeWeightEMA(waistIns), 14) : null;

      // Strength trend: mean 28-day e1RM slope across every exercise with
      // enough data. TECHNICAL-DESIGN calls for "the big 4-6 lifts" but the
      // exercises table has no such flag — averaging across everything
      // trained is the honest v1 substitute.
      // ponytail: exercise-category flag would let us restrict to compounds; add if this reads noisy in practice.
      const sessionRows = (sessionsRes.data ?? []) as unknown as WorkoutSessionRow[];
      const byExercise = new Map<
        string,
        Array<{ sessionId: string; performedAt: string; isDeload: boolean; sets: { reps: number; weightKg: number; isWarmup: boolean }[] }>
      >();
      for (const session of sessionRows) {
        const performedAt = session.started_at.slice(0, 10);
        for (const se of session.session_exercises ?? []) {
          const list = byExercise.get(se.exercise_id) ?? [];
          list.push({
            sessionId: session.id,
            performedAt,
            isDeload: session.is_deload,
            sets: (se.session_sets ?? [])
              .filter((s) => s.actual_reps !== null && s.actual_weight_kg !== null)
              .map((s) => ({ reps: s.actual_reps as number, weightKg: s.actual_weight_kg as number, isWarmup: s.is_warmup })),
          });
          byExercise.set(se.exercise_id, list);
        }
      }
      const slopes: number[] = [];
      for (const sessions of byExercise.values()) {
        const series = buildProgressSeries(sessions);
        const slope = e1rmSlopePerWeek(series, 28);
        if (slope !== null) slopes.push(slope);
      }
      const strengthSlopeKgPerWeek = slopes.length > 0 ? slopes.reduce((a, b) => a + b, 0) / slopes.length : null;

      const week: DashboardData["week"] = [];
      for (let i = 6; i >= 0; i--) {
        const date = isoDate(new Date(Date.now() - i * 86400000));
        const row = rollupRows.find((r) => r.day === date);
        week.push({ date, trained: row?.trained ?? false });
      }

      return {
        today: todayRow
          ? {
              day: todayRow.day as string,
              calories: todayRow.calories,
              proteinG: todayRow.protein_g,
              carbsG: todayRow.carbs_g,
              fatG: todayRow.fat_g,
              trained: todayRow.trained ?? false,
            }
          : null,
        targets: {
          calories: profileRes.data?.target_calories ?? null,
          proteinG: profileRes.data?.target_protein_g ?? null,
        },
        weightSlopeKgPerWeek,
        strengthSlopeKgPerWeek,
        waistSlopeCmPerWeek,
        week,
      };
    },
  });
}

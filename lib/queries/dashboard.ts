import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { computeWeightEMA, emaSlopeKgPerWeek, type TrendPoint } from "@/lib/calc/weightTrend";
import { buildProgressSeries, e1rmSlopePerWeek, type ProgressPoint } from "@/lib/calc/e1rm";
import { computeCorrelation, pairDailySeries, type DailyMetric } from "@/lib/calc/correlation";
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
  lifts: Array<{ exerciseId: string; name: string; e1rmKg: number; trend: "up" | "down" | "flat"; favorable: boolean; sparkline: number[] }>;
  weightSparkline: number[];
  weightTrend90d: TrendPoint[];
  weeklyVolume: Array<{ weekLabel: string; volumeKg: number }>;
  vitals: { restingHrBpm: number | null; sleepHours: number | null; steps: number | null };
  meals: Array<{ id: string; time: string; description: string; kcal: number; proteinG: number }>;
  runs: Array<{ id: string; label: string; daysAgo: number; distanceKm: number | null; durationMin: number | null; avgHrBpm: number | null }>;
  correlations: Array<{ title: string; xLabel: string; yLabel: string; r: number; n: number; strength: "weak" | "moderate" | "strong" }>;
}

function isoWeekLabel(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7);
  return `W${week}`;
}

// UTC — fine only for relative-offset cutoffs like windowStart, never for "today".
const isoDateUtc = (d: Date) => d.toISOString().slice(0, 10);
// Local-timezone date, matching app/(main)/food/log/page.tsx's convention. Must be
// used for todayIso/week lookups since daily_rollup.day is a client-set log_date.
const isoDateLocal = (d: Date) => d.toLocaleDateString("en-CA");

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

      const todayIso = isoDateLocal(new Date());
      const windowStart = isoDateUtc(new Date(Date.now() - 95 * 86400000));

      const [rollupRes, profileRes, bodyRes, sessionsRes, exercisesRes, nutritionRes, cardioRes] = await Promise.all([
        supabase
          .from("daily_rollup")
          .select("day, calories, protein_g, carbs_g, fat_g, trained, sleep_s, resting_hr, steps")
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
        supabase.from("exercises").select("id, name"),
        supabase
          .from("nutrition_logs")
          .select("id, logged_at, description, calories, protein_g")
          .eq("user_id", userId)
          .eq("log_date", todayIso)
          .order("logged_at"),
        supabase
          .from("cardio_sessions")
          .select("id, started_at, activity, distance_m, duration_s, avg_hr_bpm")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(5),
      ]);

      if (rollupRes.error) throw rollupRes.error;
      if (profileRes.error) throw profileRes.error;
      if (bodyRes.error) throw bodyRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (exercisesRes.error) throw exercisesRes.error;
      if (nutritionRes.error) throw nutritionRes.error;
      if (cardioRes.error) throw cardioRes.error;

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
        const date = isoDateLocal(new Date(Date.now() - i * 86400000));
        const row = rollupRows.find((r) => r.day === date);
        week.push({ date, trained: row?.trained ?? false });
      }

      // Lift trend tiles: top 4 exercises by session count, e1RM sparkline + slope.
      const nameById = new Map((exercisesRes.data ?? []).map((e) => [e.id, e.name]));
      const lifts: DashboardData["lifts"] = Array.from(byExercise.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 4)
        .map(([exerciseId, sessions]) => {
          const series: ProgressPoint[] = buildProgressSeries(sessions);
          const last = series[series.length - 1];
          const slope = e1rmSlopePerWeek(series, 28);
          const trend: "up" | "down" | "flat" = slope === null || Math.abs(slope) < 0.5 ? "flat" : slope > 0 ? "up" : "down";
          return {
            exerciseId,
            name: nameById.get(exerciseId) ?? "Exercise",
            e1rmKg: last ? Math.round(last.e1rm * 10) / 10 : 0,
            trend,
            favorable: trend !== "down",
            sparkline: series.slice(-8).map((p) => p.e1rm),
          };
        })
        .filter((l) => l.e1rmKg > 0);

      const weightTrend90d = computeWeightEMA(weighIns);
      const weightSparkline = weightTrend90d.slice(-8).map((p) => p.emaKg);

      // Weekly training volume: sum of non-warmup weight*reps per ISO week.
      const volumeByWeek = new Map<string, number>();
      for (const session of sessionRows) {
        if (session.is_deload) continue;
        const label = isoWeekLabel(session.started_at.slice(0, 10));
        let sessionVolume = 0;
        for (const se of session.session_exercises ?? []) {
          for (const s of se.session_sets ?? []) {
            if (s.is_warmup || s.actual_reps === null || s.actual_weight_kg === null) continue;
            sessionVolume += s.actual_reps * s.actual_weight_kg;
          }
        }
        volumeByWeek.set(label, (volumeByWeek.get(label) ?? 0) + sessionVolume);
      }
      const weeklyVolume = Array.from(volumeByWeek.entries()).map(([weekLabel, volumeKg]) => ({
        weekLabel,
        volumeKg: Math.round(volumeKg),
      }));

      const vitals: DashboardData["vitals"] = {
        restingHrBpm: (todayRow?.resting_hr as number | null) ?? null,
        sleepHours: todayRow?.sleep_s ? Math.round(((todayRow.sleep_s as number) / 3600) * 10) / 10 : null,
        steps: (todayRow?.steps as number | null) ?? null,
      };

      const meals: DashboardData["meals"] = (nutritionRes.data ?? []).map((n) => ({
        id: n.id,
        time: new Date(n.logged_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        description: n.description,
        kcal: n.calories,
        proteinG: n.protein_g,
      }));

      const runs: DashboardData["runs"] = (cardioRes.data ?? []).map((c) => ({
        id: c.id,
        label: `${c.activity.charAt(0).toUpperCase()}${c.activity.slice(1)}`,
        daysAgo: Math.round((Date.now() - new Date(c.started_at).getTime()) / 86400000),
        distanceKm: c.distance_m !== null ? Math.round((c.distance_m / 1000) * 10) / 10 : null,
        durationMin: c.duration_s !== null ? Math.round(c.duration_s / 60) : null,
        avgHrBpm: c.avg_hr_bpm,
      }));

      // Correlations: two same-day pairs available directly off daily_rollup.
      // TECHNICAL-DESIGN §6's canonical pair set needs more metric history than
      // exists yet to pick meaningfully — these two are real, gated at n>=20.
      const sleepSeries: DailyMetric[] = rollupRows.map((r) => ({ day: r.day as string, value: r.sleep_s }));
      const rhrSeries: DailyMetric[] = rollupRows.map((r) => ({ day: r.day as string, value: r.resting_hr }));
      const stepsSeries: DailyMetric[] = rollupRows.map((r) => ({ day: r.day as string, value: r.steps }));

      const correlations: DashboardData["correlations"] = [];
      const sleepVsRhr = computeCorrelation(pairDailySeries(sleepSeries, rhrSeries));
      if (sleepVsRhr) correlations.push({ title: "Sleep vs. resting heart rate", xLabel: "Sleep", yLabel: "RHR", ...sleepVsRhr });
      const sleepVsSteps = computeCorrelation(pairDailySeries(sleepSeries, stepsSeries));
      if (sleepVsSteps) correlations.push({ title: "Sleep vs. daily steps", xLabel: "Sleep", yLabel: "Steps", ...sleepVsSteps });

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
        lifts,
        weightSparkline,
        weightTrend90d,
        weeklyVolume,
        vitals,
        meals,
        runs,
        correlations,
      };
    },
  });
}

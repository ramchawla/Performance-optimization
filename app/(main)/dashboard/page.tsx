"use client";

import { RecompTile } from "@/components/ui/RecompTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { WeekStrip } from "@/components/ui/WeekStrip";
import { SleepConsistencyStrip } from "@/components/ui/SleepConsistencyStrip";
import { CorrelationCard } from "@/components/ui/CorrelationCard";
import { WeightTrendChart } from "@/components/charts/WeightTrendChart";
import { VolumeBarChart } from "@/components/charts/VolumeBarChart";
import { MOCK_DASHBOARD } from "@/lib/mock/dashboardMock";

function trendFor(slope: number | null): "up" | "down" | "flat" {
  if (slope === null || Math.abs(slope) < 0.05) return "flat";
  return slope > 0 ? "up" : "down";
}

// ponytail: rendering MOCK_DASHBOARD directly instead of useDashboard() — this
// is a visual preview of the full comprehensive layout (vitals/meals/lifts/runs
// have no real query wiring yet). Swap back to useDashboard() + expand it once
// health-metric ingestion and per-lift trend queries exist.
export default function Page() {
  const data = MOCK_DASHBOARD;
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <main className="space-y-6 p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs text-muted">{todayLabel}</p>
        <p className="font-mono text-[10px] text-muted">preview data</p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recomp</h2>
        <div className="grid grid-cols-3 gap-2">
          <RecompTile
            label="Weight"
            value={`${data.recomp.weightSlopeKgPerWeek.toFixed(2)} kg/wk`}
            trend={trendFor(data.recomp.weightSlopeKgPerWeek)}
            favorable={false}
            sparkline={data.weightSparkline}
          />
          <RecompTile
            label="Strength"
            value={`${data.recomp.strengthSlopeKgPerWeek.toFixed(1)} kg/wk`}
            trend={trendFor(data.recomp.strengthSlopeKgPerWeek)}
            favorable={data.recomp.strengthSlopeKgPerWeek > 0}
            sparkline={data.lifts[0].sparkline}
          />
          <RecompTile
            label="Waist"
            value={`${data.recomp.waistSlopeCmPerWeek.toFixed(2)} cm/wk`}
            trend={trendFor(data.recomp.waistSlopeCmPerWeek)}
            favorable={data.recomp.waistSlopeCmPerWeek < 0}
            sparkline={[]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Body composition · 90d</h2>
        <div className="rounded-2xl bg-surface p-4">
          <WeightTrendChart data={data.weightTrend90d} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Vitals</h2>
        <div className="grid grid-cols-3 gap-2">
          <RecompTile
            label="Resting HR"
            value={`${data.vitals.restingHrBpm} bpm`}
            trend={data.vitals.restingHrTrend}
            favorable={data.vitals.restingHrTrend === "down"}
            sparkline={data.hrSparkline}
          />
          <RecompTile
            label="Sleep"
            value={`${data.vitals.sleepHours.toFixed(1)} hr`}
            trend={data.vitals.sleepTrend}
            favorable={data.vitals.sleepTrend === "up"}
            sparkline={data.sleepSparkline}
          />
          <RecompTile
            label="Avg burn"
            value={`${data.vitals.avgCaloriesBurned.toLocaleString()} kcal`}
            trend={data.vitals.caloriesBurnedTrend}
            favorable={false}
            sparkline={[]}
          />
        </div>
        <div className="mt-2 rounded-2xl bg-surface p-4">
          <p className="mb-3 text-xs text-muted">Sleep consistency · last 14 nights</p>
          <SleepConsistencyStrip nights={data.sleepConsistency} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Nutrition today</h2>
        <div className="space-y-3 rounded-2xl bg-surface p-4">
          <ProgressBar label="Protein" current={data.nutritionToday.proteinG} target={data.nutritionToday.proteinTargetG} unit="g" />
          <ProgressBar label="Calories" current={data.nutritionToday.calories} target={data.nutritionToday.caloriesTargetKcal} unit="kcal" />
        </div>
        <ul className="mt-2 divide-y divide-surface-raised rounded-2xl bg-surface px-4">
          {data.meals.map((meal) => (
            <li key={meal.time} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-fg">{meal.name}</p>
                <p className="font-mono text-[10px] text-muted">{meal.time}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-fg">{meal.kcal} kcal</p>
                <p className="font-mono text-[10px] text-muted">{meal.proteinG}g protein</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">This week</h2>
        <div className="rounded-2xl bg-surface p-4">
          <WeekStrip days={data.week} />
        </div>
        <div className="mt-2">
          <RecompTile
            label="Streak"
            value={`${data.streakDays} day${data.streakDays === 1 ? "" : "s"}`}
            trend="up"
            favorable={data.streakDays > 0}
            sparkline={[]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Lift trends</h2>
        <div className="grid grid-cols-2 gap-2">
          {data.lifts.map((lift) => (
            <RecompTile
              key={lift.name}
              label={lift.name}
              value={`${lift.e1rmKg} kg e1RM`}
              trend={lift.trend}
              favorable={lift.favorable}
              sparkline={lift.sparkline}
            />
          ))}
        </div>
        <div className="mt-2 rounded-2xl bg-surface p-4">
          <p className="mb-1 text-xs text-muted">Weekly training volume</p>
          <VolumeBarChart data={data.weeklyVolume} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recent runs</h2>
        <ul className="space-y-2">
          {data.runs.map((run) => (
            <li key={run.label} className="rounded-2xl bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-fg">{run.label}</p>
                <p className="font-mono text-[10px] text-muted">
                  {run.daysAgo === 1 ? "yesterday" : `${run.daysAgo}d ago`}
                </p>
              </div>
              <div className="mt-2 flex gap-4 font-mono text-xs text-muted">
                <span>{run.distanceKm.toFixed(1)} km</span>
                <span>{run.durationMin} min</span>
                <span>{run.paceMinPerKm.toFixed(1)} /km</span>
                <span>{run.kcal} kcal</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Insights</h2>
        <div className="space-y-2">
          {data.correlations.map((c) => (
            <CorrelationCard key={c.title} {...c} />
          ))}
        </div>
      </section>
    </main>
  );
}

"use client";

import { RecompTile } from "@/components/ui/RecompTile";
import { RadialProgress } from "@/components/ui/RadialProgress";
import { VitalCard } from "@/components/ui/VitalCard";
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

const HeartIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-full w-full">
    <path d="M20.8 8.6c0 4.4-8.8 10.4-8.8 10.4S3.2 13 3.2 8.6a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8Z" />
  </svg>
);
const MoonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-full w-full">
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
  </svg>
);
const BoltIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className="h-full w-full">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);

// ponytail: rendering MOCK_DASHBOARD directly instead of useDashboard() — this
// is a visual preview of the full comprehensive layout (vitals/meals/lifts/runs
// have no real query wiring yet). Swap back to useDashboard() + expand it once
// health-metric ingestion and per-lift trend queries exist.
export default function Page() {
  const data = MOCK_DASHBOARD;
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const trainedThisWeek = data.week.filter((d) => d.trained).length;
  const recompFavorableCount = [
    data.recomp.strengthSlopeKgPerWeek > 0,
    data.recomp.weightSlopeKgPerWeek < 0,
    data.recomp.waistSlopeCmPerWeek < 0,
  ].filter(Boolean).length;
  const heroSubtext = `${trainedThisWeek} session${trainedThisWeek === 1 ? "" : "s"} in the last 7 days. ${
    recompFavorableCount >= 2 ? "Recomp trending the right way across the board." : "Recomp mixed this week — worth a look."
  }`;

  const proteinPct = data.nutritionToday.proteinTargetG > 0 ? data.nutritionToday.proteinG / data.nutritionToday.proteinTargetG : 0;

  const weightFirst = data.weightTrend90d[0].emaKg;
  const weightLast = data.weightTrend90d[data.weightTrend90d.length - 1].emaKg;
  const volumeFirst = data.weeklyVolume[0].volumeKg;
  const volumeLast = data.weeklyVolume[data.weeklyVolume.length - 1].volumeKg;

  return (
    <main className="relative space-y-6 overflow-hidden p-4 pb-10">
      {/* Aurora backdrop — remapped from the mockup's violet/cyan/pink blobs to the app's single accent hue. */}
      <div
        aria-hidden
        className="animate-drift pointer-events-none absolute -left-16 -top-10 -z-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl motion-reduce:opacity-10"
      />
      <div
        aria-hidden
        className="animate-drift pointer-events-none absolute -right-16 top-72 -z-10 h-48 w-48 rounded-full bg-accent-dim/25 blur-3xl motion-reduce:opacity-10"
        style={{ animationDirection: "alternate-reverse", animationDuration: "22s" }}
      />

      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Dashboard</p>
        <p className="font-mono text-[10px] text-muted">
          {todayLabel} · preview data
        </p>
      </div>

      {/* Hero: streak ring */}
      <section className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <RadialProgress value={trainedThisWeek / 7} size={72} strokeWidth={6}>
            <span className="font-display text-xl font-bold text-fg">{data.streakDays}</span>
          </RadialProgress>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-fg">{data.streakDays}-day streak</p>
            <p className="mt-0.5 text-xs leading-snug text-muted">{heroSubtext}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recomp</h2>
        <div className="stagger grid grid-cols-2 gap-2">
          <RecompTile
            wide
            label="Strength, e1RM"
            value={`${data.recomp.strengthSlopeKgPerWeek.toFixed(1)} kg/wk`}
            trend={trendFor(data.recomp.strengthSlopeKgPerWeek)}
            favorable={data.recomp.strengthSlopeKgPerWeek > 0}
            sparkline={data.lifts[0].sparkline}
          />
          <RecompTile
            label="Body weight"
            value={`${data.recomp.weightSlopeKgPerWeek.toFixed(2)} kg/wk`}
            trend={trendFor(data.recomp.weightSlopeKgPerWeek)}
            favorable={false}
            sparkline={data.weightSparkline}
          />
          <RecompTile
            label="Waist"
            value={`${data.recomp.waistSlopeCmPerWeek.toFixed(2)} cm/wk`}
            trend={trendFor(data.recomp.waistSlopeCmPerWeek)}
            favorable={false}
            sparkline={[]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Vitals</h2>
        <div className="stagger grid grid-cols-3 gap-2">
          <VitalCard icon={HeartIcon} value={`${data.vitals.restingHrBpm}`} label="RHR" trendLabel="↓ down" favorable />
          <VitalCard icon={MoonIcon} value={`${data.vitals.sleepHours.toFixed(1)}h`} label="Sleep" trendLabel="↑ up" favorable />
          <VitalCard icon={BoltIcon} value={data.vitals.avgCaloriesBurned.toLocaleString()} label="Kcal" trendLabel="→ flat" favorable={false} />
        </div>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="mb-3 text-xs text-muted">Sleep consistency · last 14 nights</p>
          <SleepConsistencyStrip nights={data.sleepConsistency} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Nutrition today</h2>
        <div className="animate-enter flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <RadialProgress value={proteinPct} size={80} strokeWidth={7}>
            <span className="font-display text-base font-bold text-fg">{Math.round(proteinPct * 100)}%</span>
            <span className="text-[9px] text-muted">protein</span>
          </RadialProgress>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-muted">
              <span className="font-mono font-bold text-fg">{data.nutritionToday.proteinG}</span> / {data.nutritionToday.proteinTargetG}g protein
            </p>
            <ProgressBar
              label="Calories"
              current={data.nutritionToday.calories}
              target={data.nutritionToday.caloriesTargetKcal}
              unit="kcal"
            />
          </div>
        </div>
        <ul className="stagger mt-2 space-y-2">
          {data.meals.map((meal) => (
            <li
              key={meal.time}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.98]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{meal.name}</p>
                <p className="font-mono text-[10px] text-muted">{meal.time}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-fg">{meal.kcal}</p>
                <p className="font-mono text-[10px] tabular-nums text-muted">{meal.proteinG}g protein</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">This week</h2>
        <WeekStrip days={data.week} />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Lift trends</h2>
        <div className="stagger grid grid-cols-2 gap-2">
          {data.lifts.map((lift) => (
            <RecompTile
              key={lift.name}
              label={lift.name}
              value={`${lift.e1rmKg} kg e1RM`}
              trend={lift.trend}
              favorable={lift.favorable}
              watch={!lift.favorable && lift.trend === "down"}
              sparkline={lift.sparkline}
            />
          ))}
        </div>
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Weekly volume</p>
            <p className="font-mono text-xs tabular-nums text-muted">
              {(volumeFirst / 1000).toFixed(1)}K → <span className="font-bold text-fg">{(volumeLast / 1000).toFixed(1)}K kg</span>
            </p>
          </div>
          <VolumeBarChart data={data.weeklyVolume} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent runs</h2>
        <div className="stagger flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] snap-x snap-mandatory [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {data.runs.map((run) => (
            <div
              key={run.label}
              className="min-w-[148px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl"
            >
              <p className="text-sm font-bold text-fg">{run.label}</p>
              <p className="mb-2.5 mt-0.5 font-mono text-[10px] text-muted">{run.daysAgo === 1 ? "yesterday" : `${run.daysAgo}d ago`}</p>
              <div className="space-y-1 font-mono text-[11px] text-muted">
                <div className="flex justify-between">
                  <span>Dist</span>
                  <span className="text-fg">{run.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span>Time</span>
                  <span className="text-fg">{run.durationMin} min</span>
                </div>
                <div className="flex justify-between">
                  <span>Kcal</span>
                  <span className="text-fg">{run.kcal}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Body composition · 90d</h2>
        <div className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Weight, 90 days</p>
            <p className="font-mono text-xs tabular-nums text-muted">
              {weightFirst.toFixed(1)} → <span className="font-bold text-accent">{weightLast.toFixed(1)} kg</span>
            </p>
          </div>
          <WeightTrendChart data={data.weightTrend90d} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Insights</h2>
        <div className="stagger space-y-2">
          {data.correlations.map((c) => (
            <CorrelationCard key={c.title} {...c} />
          ))}
        </div>
      </section>
    </main>
  );
}

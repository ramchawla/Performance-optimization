"use client";

import { useState } from "react";
import Link from "next/link";
import { RecompTile } from "@/components/ui/RecompTile";
import { RadialProgress } from "@/components/ui/RadialProgress";
import { VitalCard } from "@/components/ui/VitalCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { WeekStrip } from "@/components/ui/WeekStrip";
import { CorrelationCard } from "@/components/ui/CorrelationCard";
import { WeightTrendChart } from "@/components/charts/WeightTrendChart";
import { VolumeBarChart } from "@/components/charts/VolumeBarChart";
import { useDashboard } from "@/lib/queries/dashboard";
import { useUpsertSleepLog } from "@/lib/queries/sleep";
import { useReadinessLog } from "@/lib/queries/readiness";
import { useHydrationLog } from "@/lib/queries/hydration";
import { summarizeHydration } from "@/lib/calc/hydration";
import { todayLocal } from "@/lib/datetime";

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

/**
 * Hours-only fast path for the common morning. Anything richer — bed/wake
 * times, stages, Apple's score breakdown — lives on /sleep.
 */
function SleepQuickAdd() {
  const upsert = useUpsertSleepLog();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("7.5");

  if (!open) {
    return (
      <div className="mt-1 flex items-center justify-center gap-2">
        <button onClick={() => setOpen(true)} className="text-[10px] text-accent">
          + Log hours
        </button>
        <Link href="/sleep" className="text-[10px] text-muted hover:text-accent">
          Full entry
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        upsert.mutate(
          {
            logDate: new Date().toLocaleDateString("en-CA"),
            bedtimeAt: null,
            waketimeAt: null,
            durationS: Math.round(Number(hours) * 3600),
            remS: null,
            deepS: null,
            coreS: null,
            scoreDisruptions: null,
            scoreConsistency: null,
            scoreDuration: null,
            quality: null,
            notes: null,
          },
          { onSuccess: () => setOpen(false) }
        );
      }}
      className="mt-1 flex items-center justify-center gap-1.5"
    >
      <input
        type="number"
        step="0.25"
        min="0"
        aria-label="Hours slept"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="w-14 rounded-md border border-surface-raised bg-bg px-1.5 py-1 text-center font-mono text-xs text-fg"
      />
      <button type="submit" disabled={upsert.isPending} className="text-[10px] font-semibold text-accent">
        Save
      </button>
      <Link href="/sleep" className="text-[10px] text-muted hover:text-accent">
        More
      </Link>
    </form>
  );
}

/**
 * The three things that need a prompt rather than a chart: today's check-in,
 * water so far, and supplements. Each states its own status so a missing
 * entry is visible rather than silently absent.
 */
function TodayStrip() {
  const today = todayLocal();
  const { data: readiness } = useReadinessLog(today);
  const { data: drinks } = useHydrationLog(today);
  const totals = summarizeHydration(drinks ?? []);

  const items = [
    {
      href: "/readiness",
      label: "Check-in",
      value: readiness?.readiness_score != null ? `${readiness.readiness_score}/10` : "—",
      done: !!readiness,
    },
    {
      href: "/food/water",
      label: "Water",
      value: totals.waterEquivalentMl > 0 ? `${(totals.waterEquivalentMl / 1000).toFixed(1)}L` : "—",
      done: totals.waterEquivalentMl > 0,
    },
    {
      href: "/food/supplements",
      label: "Supps",
      value: "→",
      done: false,
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Today</h2>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-2xl border bg-surface p-3 text-center transition-colors duration-200 hover:border-accent/40 ${
              item.done ? "border-accent/40" : "border-surface-raised"
            }`}
          >
            <div className={`font-display text-lg font-bold ${item.done ? "text-accent" : "text-fg"}`}>
              {item.value}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">{item.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Page() {
  const { data, isLoading } = useDashboard();
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  if (isLoading || !data) {
    return (
      <main className="space-y-4 p-4">
        <div className="h-8 w-32 animate-pulse rounded bg-surface-raised" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface-raised" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface-raised" />
      </main>
    );
  }

  const trainedThisWeek = data.week.filter((d) => d.trained).length;
  const recompFavorableCount = [
    data.strengthSlopeKgPerWeek !== null && data.strengthSlopeKgPerWeek > 0,
    data.weightSlopeKgPerWeek !== null && data.weightSlopeKgPerWeek < 0,
    data.waistSlopeCmPerWeek !== null && data.waistSlopeCmPerWeek < 0,
  ].filter(Boolean).length;
  const heroSubtext = `${trainedThisWeek} session${trainedThisWeek === 1 ? "" : "s"} in the last 7 days. ${
    recompFavorableCount >= 2 ? "Recomp trending the right way across the board." : "Recomp mixed this week — worth a look."
  }`;

  const proteinPct = data.targets.proteinG && data.today?.proteinG ? data.today.proteinG / data.targets.proteinG : 0;

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
        <p className="font-mono text-[10px] text-muted">{todayLabel}</p>
      </div>

      {/* Hero: streak ring */}
      <section className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <RadialProgress value={trainedThisWeek / 7} size={72} strokeWidth={6}>
            <span className="font-display text-xl font-bold text-fg">{trainedThisWeek}</span>
          </RadialProgress>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-fg">{trainedThisWeek}/7 days trained</p>
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
            value={data.strengthSlopeKgPerWeek !== null ? `${data.strengthSlopeKgPerWeek.toFixed(1)} kg/wk` : "—"}
            trend={trendFor(data.strengthSlopeKgPerWeek)}
            favorable={(data.strengthSlopeKgPerWeek ?? 0) > 0}
            sparkline={data.lifts[0]?.sparkline ?? []}
          />
          <RecompTile
            label="Body weight"
            value={data.weightSlopeKgPerWeek !== null ? `${data.weightSlopeKgPerWeek.toFixed(2)} kg/wk` : "—"}
            trend={trendFor(data.weightSlopeKgPerWeek)}
            favorable={false}
            sparkline={data.weightSparkline}
          />
          <RecompTile
            label="Waist"
            value={data.waistSlopeCmPerWeek !== null ? `${data.waistSlopeCmPerWeek.toFixed(2)} cm/wk` : "—"}
            trend={trendFor(data.waistSlopeCmPerWeek)}
            favorable={false}
            sparkline={[]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Vitals</h2>
        <div className="stagger grid grid-cols-3 gap-2">
          <VitalCard icon={HeartIcon} value={data.vitals.restingHrBpm ? `${data.vitals.restingHrBpm}` : "—"} label="RHR" trendLabel="today" favorable />
          <div>
            <VitalCard icon={MoonIcon} value={data.vitals.sleepHours ? `${data.vitals.sleepHours}h` : "—"} label="Sleep" trendLabel="today" favorable />
            <SleepQuickAdd />
          </div>
          <VitalCard icon={BoltIcon} value={data.vitals.steps ? data.vitals.steps.toLocaleString() : "—"} label="Steps" trendLabel="today" favorable={false} />
        </div>
      </section>

      <TodayStrip />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Nutrition today</h2>
        <div className="animate-enter flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <RadialProgress value={proteinPct} size={80} strokeWidth={7}>
            <span className="font-display text-base font-bold text-fg">{Math.round(proteinPct * 100)}%</span>
            <span className="text-[9px] text-muted">protein</span>
          </RadialProgress>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-muted">
              <span className="font-mono font-bold text-fg">{data.today?.proteinG ?? 0}</span> / {data.targets.proteinG ?? "—"}g protein
            </p>
            <ProgressBar label="Calories" current={data.today?.calories ?? 0} target={data.targets.calories ?? 0} unit="kcal" />
          </div>
        </div>
        <ul className="stagger mt-2 space-y-2">
          {data.meals.map((meal) => (
            <li
              key={meal.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.98]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{meal.description}</p>
                <p className="font-mono text-[10px] text-muted">{meal.time}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-fg">{meal.kcal}</p>
                <p className="font-mono text-[10px] tabular-nums text-muted">{meal.proteinG}g protein</p>
              </div>
            </li>
          ))}
          {data.meals.length === 0 && <p className="text-xs text-muted">Nothing logged today yet.</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">This week</h2>
        <WeekStrip days={data.week} />
      </section>

      {data.lifts.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Lift trends</h2>
          <div className="stagger grid grid-cols-2 gap-2">
            {data.lifts.map((lift) => (
              <RecompTile
                key={lift.exerciseId}
                label={lift.name}
                value={`${lift.e1rmKg} kg e1RM`}
                trend={lift.trend}
                favorable={lift.favorable}
                watch={!lift.favorable && lift.trend === "down"}
                sparkline={lift.sparkline}
              />
            ))}
          </div>
          {data.weeklyVolume.length > 0 && (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Weekly volume</p>
                <p className="font-mono text-xs tabular-nums text-muted">
                  <span className="font-bold text-fg">{(data.weeklyVolume[data.weeklyVolume.length - 1].volumeKg / 1000).toFixed(1)}K kg</span> this week
                </p>
              </div>
              <VolumeBarChart data={data.weeklyVolume} />
            </div>
          )}
        </section>
      )}

      {data.runs.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent runs</h2>
          <div className="stagger flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] snap-x snap-mandatory [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {data.runs.map((run) => (
              <div
                key={run.id}
                className="min-w-[148px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl"
              >
                <p className="text-sm font-bold text-fg">{run.label}</p>
                <p className="mb-2.5 mt-0.5 font-mono text-[10px] text-muted">{run.daysAgo === 1 ? "yesterday" : `${run.daysAgo}d ago`}</p>
                <div className="space-y-1 font-mono text-[11px] text-muted">
                  <div className="flex justify-between">
                    <span>Dist</span>
                    <span className="text-fg">{run.distanceKm !== null ? `${run.distanceKm.toFixed(1)} km` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time</span>
                    <span className="text-fg">{run.durationMin !== null ? `${run.durationMin} min` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg HR</span>
                    <span className="text-fg">{run.avgHrBpm !== null ? `${run.avgHrBpm} bpm` : "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.weightTrend90d.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Body composition · 90d</h2>
          <div className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Weight, 90 days</p>
              <p className="font-mono text-xs tabular-nums text-muted">
                {data.weightTrend90d[0].emaKg.toFixed(1)} →{" "}
                <span className="font-bold text-accent">{data.weightTrend90d[data.weightTrend90d.length - 1].emaKg.toFixed(1)} kg</span>
              </p>
            </div>
            <WeightTrendChart data={data.weightTrend90d} />
          </div>
        </section>
      )}

      {data.correlations.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Insights</h2>
          <div className="stagger space-y-2">
            {data.correlations.map((c) => (
              <CorrelationCard key={c.title} {...c} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

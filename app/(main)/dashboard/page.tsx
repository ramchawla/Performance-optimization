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
import { useGarminToday } from "@/lib/queries/today";
import { syncAgeLabel } from "@/lib/calc/garmin";

function trendFor(slope: number | null): "up" | "down" | "flat" {
  if (slope === null || Math.abs(slope) < 0.05) return "flat";
  return slope > 0 ? "up" : "down";
}

const HeartIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    className="h-full w-full"
  >
    <path d="M20.8 8.6c0 4.4-8.8 10.4-8.8 10.4S3.2 13 3.2 8.6a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8Z" />
  </svg>
);
const MoonIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    className="h-full w-full"
  >
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
  </svg>
);
const BoltIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinejoin="round"
    className="h-full w-full"
  >
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);

/**
 * Every dashboard card is an entry point into its section. The press feedback
 * lives here, on the link, so a card only looks tappable when it goes somewhere.
 */
function DashLink({
  href,
  label,
  className = "",
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`block rounded-2xl transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      {children}
    </Link>
  );
}

const BatteryIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-full w-full">
    <rect x="3" y="7" width="16" height="10" rx="2" />
    <path d="M21 11v2M6 10v4M9 10v4" />
  </svg>
);
const FlameIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className="h-full w-full">
    <path d="M12 3s5 4.5 5 9.5a5 5 0 0 1-10 0C7 10 9 8.5 9 8.5S9.5 11 11 11c0-3 1-8 1-8Z" />
  </svg>
);
const TimerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-full w-full">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2M9 2h6" />
  </svg>
);

/**
 * Vitals: rollup values (sleep, RHR) plus Garmin's daily summary. The watch
 * only reaches Garmin's cloud when the phone app uploads, so the header says
 * how fresh that upload is — the honest answer to "why is my step count behind".
 */
function VitalsSection({
  restingHr,
  sleepHours,
  rollupSteps,
}: {
  restingHr: number | null;
  sleepHours: number | null;
  rollupSteps: number | null;
}) {
  const { data: garmin } = useGarminToday();
  const t = garmin?.today ?? {};
  // Captured once per mount — render must stay pure (react-hooks/purity).
  const [now] = useState(Date.now);
  const age = syncAgeLabel(t.watch_last_sync_epoch_min, now);
  const steps = t.steps ?? rollupSteps;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Vitals</h2>
        {age && (
          <p className={`font-mono text-[10px] ${age.stale ? "text-amber-300" : "text-muted"}`}>
            watch synced {age.label}
            {age.stale && " · open Garmin Connect to update"}
          </p>
        )}
      </div>
      <div className="stagger grid grid-cols-3 gap-2">
        <DashLink href="/sleep" label="Resting heart rate — open recovery">
          <VitalCard icon={HeartIcon} value={restingHr ? `${restingHr}` : "—"} label="RHR" trendLabel="today" favorable />
        </DashLink>
        <DashLink href="/sleep" label="Sleep — open sleep details">
          <VitalCard icon={MoonIcon} value={sleepHours ? `${sleepHours}h` : "—"} label="Sleep" trendLabel="last night" favorable />
        </DashLink>
        {/* ponytail: steps/kcal/intensity have no page of their own yet — static cards. */}
        <VitalCard icon={BoltIcon} value={steps ? steps.toLocaleString() : "—"} label="Steps" trendLabel="today" favorable={false} />
        <DashLink href="/readiness" label="Body battery — open readiness">
          <VitalCard
            icon={BatteryIcon}
            value={t.body_battery_high !== undefined ? `${t.body_battery_high}` : "—"}
            label="Body battery"
            trendLabel={t.body_battery_low !== undefined ? `low ${t.body_battery_low}` : "today"}
            favorable
          />
        </DashLink>
        <VitalCard
          icon={FlameIcon}
          value={t.calories_active_kcal !== undefined ? Math.round(t.calories_active_kcal).toLocaleString() : "—"}
          label="Active kcal"
          trendLabel={t.calories_total_kcal !== undefined ? `${Math.round(t.calories_total_kcal).toLocaleString()} total` : "today"}
          favorable={false}
        />
        <VitalCard
          icon={TimerIcon}
          value={garmin ? `${garmin.intensityWeek}` : "—"}
          label="Intensity min"
          trendLabel="7d · goal 150"
          favorable={(garmin?.intensityWeek ?? 0) >= 150}
        />
      </div>
      {(t.stress_avg !== undefined || t.spo2_avg !== undefined || t.floors_up !== undefined) && (
        <p className="mt-2 font-mono text-[10px] text-muted">
          {t.stress_avg !== undefined && <>Stress {Math.round(t.stress_avg)} · </>}
          {t.spo2_avg !== undefined && <>SpO₂ {Math.round(t.spo2_avg)}% · </>}
          {t.resp_waking_avg !== undefined && <>Breathing {Math.round(t.resp_waking_avg)} brpm · </>}
          {t.floors_up !== undefined && <>{Math.round(t.floors_up)} floors</>}
        </p>
      )}
    </section>
  );
}

const GearIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    className="h-5 w-5"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

/**
 * The three things that need a prompt rather than a chart: today's check-in,
 * water so far, and supplements. Each states its own status so a missing
 * entry is visible rather than silently absent.
 */
function TodayStrip() {
  // Reads the rollup the page already fetched rather than firing its own
  // readiness and hydration queries — same TanStack cache key, so this is free.
  // water_equivalent_ml excludes alcohol exactly as lib/calc/hydration.ts does
  // (migration 0008), so the number here matches the Water screen's.
  const { data } = useDashboard();
  const waterMl = data?.today?.waterEquivalentMl ?? 0;
  const readinessScore = data?.today?.readinessScore ?? null;

  const items = [
    {
      href: "/readiness",
      label: "Check-in",
      value: readinessScore != null ? `${readinessScore}/10` : "—",
      done: readinessScore != null,
    },
    {
      href: "/food/water",
      label: "Water",
      value: waterMl > 0 ? `${(waterMl / 1000).toFixed(1)}L` : "—",
      done: waterMl > 0,
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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Today
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-2xl border bg-surface p-3 text-center transition-colors duration-200 hover:border-accent/40 ${
              item.done ? "border-accent/40" : "border-surface-raised"
            }`}
          >
            <div
              className={`font-display text-lg font-bold ${item.done ? "text-accent" : "text-fg"}`}
            >
              {item.value}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
              {item.label}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Page() {
  const { data, isLoading } = useDashboard();
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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
    recompFavorableCount >= 2
      ? "Recomp trending the right way across the board."
      : "Recomp mixed this week — worth a look."
  }`;

  const proteinPct =
    data.targets.proteinG && data.today?.proteinG
      ? data.today.proteinG / data.targets.proteinG
      : 0;

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
        style={{
          animationDirection: "alternate-reverse",
          animationDuration: "22s",
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Dashboard
          </p>
          <p className="font-mono text-[10px] text-muted">{todayLabel}</p>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:text-fg active:bg-surface-raised"
        >
          {GearIcon}
        </Link>
      </div>

      {/* Hero: streak ring */}
      <DashLink href="/train/history" label="Training history">
        <section className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <RadialProgress
              value={trainedThisWeek / 7}
              size={72}
              strokeWidth={6}
            >
              <span className="font-display text-xl font-bold text-fg">
                {trainedThisWeek}
              </span>
            </RadialProgress>
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-fg">
                {trainedThisWeek}/7 days trained
              </p>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                {heroSubtext}
              </p>
            </div>
          </div>
        </section>
      </DashLink>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Recomp
        </h2>
        <div className="stagger grid grid-cols-2 gap-2">
          <DashLink
            href="/train/history"
            label="Strength trend"
            className="col-span-2"
          >
            <RecompTile
              label="Strength, e1RM"
              value={
                data.strengthSlopeKgPerWeek !== null
                  ? `${data.strengthSlopeKgPerWeek.toFixed(1)} kg/wk`
                  : "—"
              }
              trend={trendFor(data.strengthSlopeKgPerWeek)}
              favorable={(data.strengthSlopeKgPerWeek ?? 0) > 0}
              sparkline={data.lifts[0]?.sparkline ?? []}
              wide
            />
          </DashLink>
          <DashLink href="/body/photos" label="Body weight">
            <RecompTile
              label="Body weight"
              value={
                data.weightSlopeKgPerWeek !== null
                  ? `${data.weightSlopeKgPerWeek.toFixed(2)} kg/wk`
                  : "—"
              }
              trend={trendFor(data.weightSlopeKgPerWeek)}
              favorable={false}
              sparkline={data.weightSparkline}
            />
          </DashLink>
          <DashLink href="/body/photos" label="Waist">
            <RecompTile
              label="Waist"
              value={
                data.waistSlopeCmPerWeek !== null
                  ? `${data.waistSlopeCmPerWeek.toFixed(2)} cm/wk`
                  : "—"
              }
              trend={trendFor(data.waistSlopeCmPerWeek)}
              favorable={false}
              sparkline={[]}
            />
          </DashLink>
        </div>
      </section>

      <VitalsSection
        restingHr={data.vitals.restingHrBpm}
        sleepHours={data.vitals.sleepHours}
        rollupSteps={data.vitals.steps}
      />

      <TodayStrip />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Nutrition today
        </h2>
        <DashLink href="/food/log" label="Food log">
          <div className="animate-enter flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <RadialProgress value={proteinPct} size={80} strokeWidth={7}>
              <span className="font-display text-base font-bold text-fg">
                {Math.round(proteinPct * 100)}%
              </span>
              <span className="text-[9px] text-muted">protein</span>
            </RadialProgress>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-muted">
                <span className="font-mono font-bold text-fg">
                  {data.today?.proteinG ?? 0}
                </span>{" "}
                / {data.targets.proteinG ?? "—"}g protein
              </p>
              <ProgressBar
                label="Calories"
                current={data.today?.calories ?? 0}
                target={data.targets.calories ?? 0}
                unit="kcal"
              />
            </div>
          </div>
        </DashLink>
        <ul className="stagger mt-2 space-y-2">
          {data.meals.map((meal) => (
            <li key={meal.id}>
              <DashLink
                href="/food/log"
                label={`${meal.description} — open food log`}
              >
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">
                      {meal.description}
                    </p>
                    <p className="font-mono text-[10px] text-muted">
                      {meal.time}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold tabular-nums text-fg">
                      {meal.kcal}
                    </p>
                    <p className="font-mono text-[10px] tabular-nums text-muted">
                      {meal.proteinG}g protein
                    </p>
                  </div>
                </div>
              </DashLink>
            </li>
          ))}
          {data.meals.length === 0 && (
            <p className="text-xs text-muted">Nothing logged today yet.</p>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          This week
        </h2>
        <DashLink href="/train/history" label="This week's training">
          <WeekStrip days={data.week} />
        </DashLink>
      </section>

      {data.lifts.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Lift trends
          </h2>
          <div className="stagger grid grid-cols-2 gap-2">
            {data.lifts.map((lift) => (
              <DashLink
                key={lift.exerciseId}
                href="/train/history"
                label={`${lift.name} trend`}
              >
                <RecompTile
                  label={lift.name}
                  value={`${lift.e1rmKg} kg e1RM`}
                  trend={lift.trend}
                  favorable={lift.favorable}
                  watch={!lift.favorable && lift.trend === "down"}
                  sparkline={lift.sparkline}
                />
              </DashLink>
            ))}
          </div>
          {data.weeklyVolume.length > 0 && (
            <DashLink
              href="/train/history"
              label="Weekly volume"
              className="mt-2"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Weekly volume
                  </p>
                  <p className="font-mono text-xs tabular-nums text-muted">
                    <span className="font-bold text-fg">
                      {(
                        data.weeklyVolume[data.weeklyVolume.length - 1]
                          .volumeKg / 1000
                      ).toFixed(1)}
                      K kg
                    </span>{" "}
                    this week
                  </p>
                </div>
                <VolumeBarChart data={data.weeklyVolume} />
              </div>
            </DashLink>
          )}
        </section>
      )}

      {data.runs.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Recent runs
          </h2>
          <div className="stagger flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] snap-x snap-mandatory [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {data.runs.map((run) => (
              <DashLink
                key={run.id}
                href="/train/cardio"
                label={`${run.label} — open cardio`}
                className="min-w-[148px] shrink-0 snap-start"
              >
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl">
                  <p className="text-sm font-bold text-fg">{run.label}</p>
                  <p className="mb-2.5 mt-0.5 font-mono text-[10px] text-muted">
                    {run.daysAgo === 1 ? "yesterday" : `${run.daysAgo}d ago`}
                  </p>
                  <div className="space-y-1 font-mono text-[11px] text-muted">
                    <div className="flex justify-between">
                      <span>Dist</span>
                      <span className="text-fg">
                        {run.distanceKm !== null
                          ? `${run.distanceKm.toFixed(1)} km`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time</span>
                      <span className="text-fg">
                        {run.durationMin !== null
                          ? `${run.durationMin} min`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg HR</span>
                      <span className="text-fg">
                        {run.avgHrBpm !== null ? `${run.avgHrBpm} bpm` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </DashLink>
            ))}
          </div>
        </section>
      )}

      {data.weightTrend90d.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Body composition · 90d
          </h2>
          <DashLink href="/body/photos" label="Weight trend">
            <div className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <div className="mb-1 flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Weight, 90 days
                </p>
                <p className="font-mono text-xs tabular-nums text-muted">
                  {data.weightTrend90d[0].emaKg.toFixed(1)} →{" "}
                  <span className="font-bold text-accent">
                    {data.weightTrend90d[
                      data.weightTrend90d.length - 1
                    ].emaKg.toFixed(1)}{" "}
                    kg
                  </span>
                </p>
              </div>
              <WeightTrendChart data={data.weightTrend90d} />
            </div>
          </DashLink>
        </section>
      )}

      {data.correlations.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Insights
          </h2>
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

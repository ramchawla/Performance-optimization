"use client";

import { useDashboard } from "@/lib/queries/dashboard";
import { RecompTile } from "@/components/ui/RecompTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { WeekStrip } from "@/components/ui/WeekStrip";

function trendFor(slope: number | null): "up" | "down" | "flat" {
  if (slope === null || Math.abs(slope) < 0.05) return "flat";
  return slope > 0 ? "up" : "down";
}

export default function Page() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <main className="p-4">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="p-4">
        <p className="text-sm text-muted">Couldn&apos;t load dashboard. Pull to refresh.</p>
      </main>
    );
  }

  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <main className="space-y-6 p-4">
      <p className="font-mono text-xs text-muted">{todayLabel}</p>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recomp</h2>
        <div className="grid grid-cols-3 gap-2">
          <RecompTile
            label="Weight"
            value={data.weightSlopeKgPerWeek !== null ? `${data.weightSlopeKgPerWeek.toFixed(2)} kg/wk` : "—"}
            trend={trendFor(data.weightSlopeKgPerWeek)}
            favorable={data.weightSlopeKgPerWeek !== null && data.weightSlopeKgPerWeek < 0}
            sparkline={[]}
          />
          <RecompTile
            label="Strength"
            value={data.strengthSlopeKgPerWeek !== null ? `${data.strengthSlopeKgPerWeek.toFixed(1)} kg/wk` : "—"}
            trend={trendFor(data.strengthSlopeKgPerWeek)}
            favorable={data.strengthSlopeKgPerWeek !== null && data.strengthSlopeKgPerWeek > 0}
            sparkline={[]}
          />
          <RecompTile
            label="Waist"
            value={data.waistSlopeCmPerWeek !== null ? `${data.waistSlopeCmPerWeek.toFixed(2)} cm/wk` : "—"}
            trend={trendFor(data.waistSlopeCmPerWeek)}
            favorable={data.waistSlopeCmPerWeek !== null && data.waistSlopeCmPerWeek < 0}
            sparkline={[]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Nutrition today</h2>
        <div className="space-y-3 rounded-2xl bg-surface p-4">
          <ProgressBar label="Protein" current={data.today?.proteinG ?? 0} target={data.targets.proteinG} unit="g" />
          <ProgressBar label="Calories" current={data.today?.calories ?? 0} target={data.targets.calories} unit="kcal" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">This week</h2>
        <div className="rounded-2xl bg-surface p-4">
          <WeekStrip days={data.week} />
        </div>
      </section>
    </main>
  );
}

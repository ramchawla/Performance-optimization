"use client";

import { useState } from "react";
import { Area, Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { baseline, formatClock, formatDuration, timingConsistency } from "@/lib/calc/sleep";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import type { TrendNight } from "@/lib/queries/sleep";
import { STAGE_STYLE } from "./Hypnogram";

const WINDOWS = [7, 30, 90] as const;
type Window = (typeof WINDOWS)[number];

const TOOLTIP = {
  contentStyle: { background: "var(--surface-raised)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
};
const AXIS_TICK = { fontSize: 9, fill: "var(--muted)" };
const hours = (s: number | undefined) => (s === undefined ? null : Math.round((s / 3600) * 10) / 10);

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function ChartCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-raised bg-surface p-3.5">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
        {right}
      </div>
      <div className="h-36 w-full">{children}</div>
    </div>
  );
}

/**
 * `nights` is the full trend read (window + 28 nights of baseline history),
 * oldest first. The window toggle only slices it — one query serves all three.
 */
export function SleepTrends({ nights, today }: { nights: TrendNight[]; today: string }) {
  const [win, setWin] = useState<Window>(30);
  const reducedMotion = usePrefersReducedMotion();

  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (win - 1));
  const from = cutoff.toISOString().slice(0, 10);
  const inWindow = nights.filter((n) => n.date >= from && n.date <= today);
  const withSleep = inWindow.filter((n) => n.metrics.sleep_duration_s !== undefined);

  // HRV band: each night against the 28 nights before it, not a single global
  // mean — a baseline that drifts with you is what makes "low for you" honest.
  const hrvData = inWindow.map((n) => {
    const idx = nights.indexOf(n);
    const prior = nights
      .slice(Math.max(0, idx - 28), idx)
      .map((p) => p.metrics.hrv_ms)
      .filter((v): v is number => v !== undefined);
    const b = baseline(prior);
    return {
      date: n.date,
      hrv: n.metrics.hrv_ms ?? null,
      band: b ? [Math.round(b.mean - b.sd), Math.round(b.mean + b.sd)] : null,
    };
  });

  const chartData = inWindow.map((n) => ({
    date: n.date,
    score: n.metrics.sleep_score ?? null,
    sleepH: hours(n.metrics.sleep_duration_s),
    needH: hours(n.metrics.sleep_need_s),
    deep: hours(n.metrics.sleep_deep_s),
    light: hours(n.metrics.sleep_light_s),
    rem: hours(n.metrics.sleep_rem_s),
    awake: hours(n.metrics.sleep_awake_s),
    rhr: n.metrics.resting_hr_bpm ?? null,
  }));

  const nums = (k: keyof TrendNight["metrics"]) =>
    withSleep.map((n) => n.metrics[k]).filter((v): v is number => v !== undefined);
  const avgScore = mean(nums("sleep_score"));
  const avgDuration = mean(nums("sleep_duration_s"));
  const avgBed = mean(nums("sleep_start_offset_s"));
  const avgWake = mean(nums("sleep_end_offset_s"));
  const bedSd = timingConsistency(nums("sleep_start_offset_s"));
  const wakeSd = timingConsistency(nums("sleep_end_offset_s"));
  const feel = mean(inWindow.map((n) => n.log?.quality).filter((q): q is number => typeof q === "number"));

  const xAxis = (
    <XAxis
      dataKey="date"
      tickFormatter={(d: string) => d.slice(5)}
      tick={AXIS_TICK}
      interval="preserveStartEnd"
      minTickGap={24}
      axisLine={false}
      tickLine={false}
    />
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Trends</h2>
        <div role="tablist" className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              role="tab"
              aria-selected={w === win}
              onClick={() => setWin(w)}
              className={`min-h-8 rounded-lg px-2.5 font-mono text-[11px] font-semibold ${
                w === win ? "bg-accent text-bg" : "bg-surface-raised text-muted"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {withSleep.length === 0 ? (
        <p className="text-xs text-muted">No sleep data in this window yet — backfill history from Settings → Garmin.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Avg score", avgScore !== null ? String(Math.round(avgScore)) : "—"],
              ["Avg sleep", avgDuration !== null ? formatDuration(avgDuration) : "—"],
              ["Avg feel", feel !== null ? `${feel.toFixed(1)}/5` : "—"],
              ["Bedtime", avgBed !== null ? formatClock(avgBed) : "—", bedSd !== null ? `±${Math.round(bedSd)}m` : null],
              ["Wake", avgWake !== null ? formatClock(avgWake) : "—", wakeSd !== null ? `±${Math.round(wakeSd)}m` : null],
              ["Nights", String(withSleep.length)],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border border-surface-raised bg-surface p-2.5 text-center">
                <p className="font-display text-base font-bold tabular-nums text-fg">{value}</p>
                <p className="text-[9px] uppercase tracking-wide text-muted">
                  {label}
                  {sub && <span className="ml-1 normal-case text-accent">{sub}</span>}
                </p>
              </div>
            ))}
          </div>

          <ChartCard title="Sleep score">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                {xAxis}
                <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} />
                <Line dataKey="score" name="Score" stroke="var(--accent)" strokeWidth={2} dot={win === 7} connectNulls isAnimationActive={!reducedMotion} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Sleep vs need" right={<span className="font-mono text-[10px] text-muted">hours</span>}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                {xAxis}
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} />
                <Bar dataKey="sleepH" name="Slept" fill="var(--accent-dim)" radius={[3, 3, 0, 0]} isAnimationActive={!reducedMotion} />
                <Line dataKey="needH" name="Need" stroke="var(--fg)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={!reducedMotion} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Stages" right={<span className="font-mono text-[10px] text-muted">hours</span>}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                {xAxis}
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} />
                {(["deep", "light", "rem", "awake"] as const).map((s) => (
                  <Bar key={s} dataKey={s} name={STAGE_STYLE[s].label} stackId="stages" fill={STAGE_STYLE[s].color} isAnimationActive={!reducedMotion} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Overnight HRV" right={<span className="font-mono text-[10px] text-muted">ms · band = your normal</span>}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hrvData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                {xAxis}
                <YAxis domain={["dataMin - 5", "dataMax + 5"]} tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP} />
                <Area dataKey="band" name="Normal range" stroke="none" fill="var(--accent)" fillOpacity={0.12} connectNulls isAnimationActive={false} />
                <Line dataKey="hrv" name="HRV" stroke="var(--accent)" strokeWidth={2} dot={win === 7} connectNulls isAnimationActive={!reducedMotion} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Resting heart rate" right={<span className="font-mono text-[10px] text-muted">bpm</span>}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                {xAxis}
                <YAxis domain={["dataMin - 3", "dataMax + 3"]} tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP} />
                <Line dataKey="rhr" name="RHR" stroke="#fb7185" strokeWidth={2} dot={win === 7} connectNulls isAnimationActive={!reducedMotion} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </section>
  );
}

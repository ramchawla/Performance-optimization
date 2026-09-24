"use client";

import { baseline } from "@/lib/calc/sleep";
import { recoveryScore, type RecoveryBand } from "@/lib/calc/recovery";
import { todayLocal } from "@/lib/datetime";
import { useSleepTrend, type SleepMetric } from "@/lib/queries/sleep";
import { useGarminToday } from "@/lib/queries/today";

const BAND_STYLE: Record<RecoveryBand, { label: string; className: string; advice: string }> = {
  high: { label: "Recovered", className: "text-accent", advice: "Good day to push intensity." },
  normal: { label: "Normal", className: "text-fg", advice: "Train as planned." },
  low: { label: "Under-recovered", className: "text-rose-300", advice: "Favour volume over intensity, or take it easy." },
};

const COMPONENT_LABEL = { hrv: "HRV", rhr: "Resting HR", sleepScore: "Sleep score" } as const;

/**
 * Today's recovery: the app's own score (lib/calc/recovery.ts — HRV, RHR and
 * sleep vs your 28-night baseline) next to Garmin's Training Readiness, so the
 * two can be compared rather than one silently trusted.
 */
export function RecoveryPanel() {
  const { data: trend, isLoading } = useSleepTrend(90);
  const { data: garmin } = useGarminToday();
  const today = todayLocal();

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-surface-raised" />;

  const nights = trend ?? [];
  const tonight = nights.find((n) => n.date === today)?.metrics ?? {};
  const prior = nights.filter((n) => n.date < today).slice(-28);
  const hist = (k: SleepMetric) => prior.map((n) => n.metrics[k]).filter((v): v is number => v !== undefined);

  const result = recoveryScore(
    { hrv: tonight.hrv_ms, rhr: tonight.resting_hr_bpm, sleepScore: tonight.sleep_score },
    { hrv: baseline(hist("hrv_ms")), rhr: baseline(hist("resting_hr_bpm")), sleepScore: baseline(hist("sleep_score")) }
  );
  const g = garmin?.today ?? {};

  return (
    <section className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Your recovery</p>
          {result ? (
            <>
              <p className={`font-display text-4xl font-bold tabular-nums ${BAND_STYLE[result.band].className}`}>{result.score}</p>
              <p className="text-xs font-semibold text-fg">{BAND_STYLE[result.band].label}</p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Needs last night&apos;s HRV and {Math.max(0, 7 - hist("hrv_ms").length)} more nights of baseline.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-surface-raised bg-surface p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Garmin readiness</p>
          <p className="font-display text-4xl font-bold tabular-nums text-fg">
            {g.training_readiness !== undefined ? Math.round(g.training_readiness) : "—"}
          </p>
          <p className="font-mono text-[10px] text-muted">
            {g.recovery_time_h !== undefined ? `recovery ${Math.round(g.recovery_time_h)}h` : "no score yet"}
            {g.body_battery_high !== undefined && ` · battery ${g.body_battery_high}`}
          </p>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <p className="mb-2 text-xs text-fg">{BAND_STYLE[result.band].advice}</p>
          <ul className="space-y-1.5">
            {result.components.map((c) => {
              // z clamped to ±2 SD for the bar; the centre line is "your normal".
              const pct = (Math.max(-2, Math.min(2, c.z)) / 2) * 50;
              return (
                <li key={c.key} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 shrink-0 text-muted">{COMPONENT_LABEL[c.key]}</span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-bg">
                    <span className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-muted/60" />
                    <span
                      className={`absolute top-0 h-1.5 rounded-full ${c.z >= 0 ? "bg-accent" : "bg-rose-400"}`}
                      style={c.z >= 0 ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${-pct}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-muted">
                    {c.z >= 0 ? "+" : ""}
                    {c.z.toFixed(1)} SD
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

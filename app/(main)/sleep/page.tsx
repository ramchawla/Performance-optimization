"use client";

import { useState } from "react";
import Link from "next/link";
import { RecoverySubnav } from "@/components/recovery/RecoverySubnav";
import { Hypnogram, STAGE_STYLE } from "@/components/sleep/Hypnogram";
import { OvernightChart, type OvernightSeries } from "@/components/sleep/OvernightChart";
import { SleepTrends } from "@/components/sleep/SleepTrends";
import {
  baseline,
  deltaVsBaseline,
  formatClock,
  formatDuration,
  HIGHER_IS_BETTER,
  hypnogramSegments,
  stageMix,
  timeSeries,
  type Tone,
} from "@/lib/calc/sleep";
import { formatDate, shiftDate, todayLocal } from "@/lib/datetime";
import {
  SLEEP_TAGS,
  useSleepNight,
  useSleepTrend,
  useUpsertSleepFeel,
  type SleepLog,
  type SleepMetric,
  type TrendNight,
} from "@/lib/queries/sleep";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

/** "POSITIVE_LONG_AND_REFRESHING" → "Long and refreshing". Garmin adds keys without notice, so no fixed map. */
function humanize(key: unknown): string | null {
  if (typeof key !== "string" || !key || key === "NONE") return null;
  const words = key.replace(/^(POSITIVE|NEGATIVE)_/, "").toLowerCase().split("_");
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const QUALIFIER_STYLE: Record<string, string> = {
  EXCELLENT: "bg-accent/15 text-accent",
  GOOD: "bg-accent/10 text-accent",
  FAIR: "bg-amber-400/15 text-amber-300",
  POOR: "bg-rose-400/15 text-rose-300",
};

const TONE_STYLE: Record<Tone, string> = {
  good: "text-accent",
  bad: "text-rose-300",
  neutral: "text-muted",
};

const SCORE_PARTS: Array<[string, string]> = [
  ["totalDuration", "Duration"],
  ["deepPercentage", "Deep %"],
  ["remPercentage", "REM %"],
  ["lightPercentage", "Light %"],
  ["stress", "Stress"],
  ["awakeCount", "Awakenings"],
  ["restlessness", "Restlessness"],
];

function RecoveryTile({
  label,
  metric,
  value,
  unit,
  history,
}: {
  label: string;
  metric: SleepMetric;
  value: number | undefined;
  unit: string;
  history: number[];
}) {
  const base = baseline(history);
  const d = value !== undefined && base ? deltaVsBaseline(value, base, HIGHER_IS_BETTER[metric] ?? true) : null;
  return (
    <div className="rounded-xl border border-surface-raised bg-surface p-2.5 text-center">
      <p className="font-display text-lg font-bold tabular-nums text-fg">
        {value !== undefined ? Math.round(value) : "—"}
        <span className="ml-0.5 text-[10px] font-normal text-muted">{unit}</span>
      </p>
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-[10px] ${d ? TONE_STYLE[d.tone] : "text-muted"}`}>
        {d ? `${d.delta >= 0 ? "+" : ""}${Math.round(d.delta)} vs normal` : base ? "—" : `baseline ${history.length}/7`}
      </p>
    </div>
  );
}

function FeelForm({ logDate, log }: { logDate: string; log: SleepLog | null }) {
  const upsert = useUpsertSleepFeel();
  const [quality, setQuality] = useState<number | null>(log?.quality ?? null);
  const [tags, setTags] = useState<string[]>(log?.tags ?? []);
  const [notes, setNotes] = useState(log?.notes ?? "");

  function toggle(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Input stays in the form on failure — the global mutation toast says why (rule 7).
        upsert.mutate({ logDate, quality, tags, notes: notes.trim() || null });
      }}
      className="space-y-3"
    >
      <div>
        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">How rested do you feel?</p>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={quality === n}
              onClick={() => setQuality(quality === n ? null : n)}
              className={`min-h-11 rounded-xl font-display text-sm font-bold transition-colors ${
                quality === n ? "bg-accent text-bg" : "bg-surface-raised text-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SLEEP_TAGS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tags.includes(t.key)}
            onClick={() => toggle(t.key)}
            className={`min-h-9 rounded-full border px-3 text-xs transition-colors ${
              tags.includes(t.key) ? "border-accent bg-accent/15 text-accent" : "border-surface-raised text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        aria-label="Sleep notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Woke at 3am, room too warm, …"
        className="w-full resize-none rounded-xl border border-surface-raised bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={upsert.isPending}
        className="min-h-11 w-full rounded-xl bg-accent py-3 font-display text-sm font-bold text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {upsert.isPending ? "Saving…" : "Save"}
      </button>
      {upsert.isSuccess && !upsert.isPending && <p className="text-center text-xs text-accent">Saved.</p>}
    </form>
  );
}

function NightView({ date, trend }: { date: string; trend: TrendNight[] }) {
  const { data: night, isLoading, error } = useSleepNight(date);

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-surface-raised" />;
  if (error || !night) {
    return <p className="text-sm text-rose-300">Couldn&apos;t load this night — {error instanceof Error ? error.message : "try again"}.</p>;
  }

  const m = night.metrics;
  const dto = obj(night.sleepRaw?.dailySleepDTO);
  const scores = obj(dto?.sleepScores);
  const overall = obj(scores?.overall);
  const feedback = humanize(dto?.sleepScoreFeedback);
  const hasWatchData = m.sleep_duration_s !== undefined;

  // Baseline = up to 28 nights strictly before this one.
  const prior = trend.filter((n) => n.date < date).slice(-28);
  const history = (k: SleepMetric) => prior.map((n) => n.metrics[k]).filter((v): v is number => v !== undefined);

  const segments = hypnogramSegments(night.sleepRaw?.sleepLevels);
  const mix = stageMix({
    deep: m.sleep_deep_s ?? 0,
    light: m.sleep_light_s ?? 0,
    rem: m.sleep_rem_s ?? 0,
    awake: m.sleep_awake_s ?? 0,
  });

  const overnight: OvernightSeries[] = [
    { key: "hr", label: "Heart rate", unit: "bpm", points: timeSeries(night.sleepRaw?.sleepHeartRate, "startGMT", "value") },
    { key: "hrv", label: "HRV", unit: "ms", points: timeSeries(night.sleepRaw?.hrvData, "startGMT", "value") },
    {
      key: "resp",
      label: "Breathing",
      unit: "brpm",
      points: timeSeries(night.sleepRaw?.wellnessEpochRespirationDataDTOList, "startTimeGMT", "respirationValue"),
    },
    // Garmin fills stress gaps with negative sentinels; drop them.
    { key: "stress", label: "Stress", unit: "", points: timeSeries(night.sleepRaw?.sleepStress, "startGMT", "value").filter((p) => p.v >= 0) },
    { key: "bb", label: "Body battery", unit: "", points: timeSeries(night.sleepRaw?.sleepBodyBattery, "startGMT", "value") },
  ];

  return (
    <div className="space-y-4">
      {hasWatchData ? (
        <>
          {/* Hero */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="shrink-0 text-center">
                <p className="font-display text-4xl font-bold tabular-nums text-accent">{m.sleep_score ?? "—"}</p>
                {typeof overall?.qualifierKey === "string" && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{overall.qualifierKey}</p>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                {feedback && <p className="text-sm font-semibold text-fg">{feedback}</p>}
                <p className="font-mono text-xs text-muted">
                  <span className="font-bold text-fg">{formatDuration(m.sleep_duration_s!)}</span>
                  {m.sleep_need_s !== undefined && <> / {formatDuration(m.sleep_need_s)} need</>}
                </p>
                {m.sleep_start_offset_s !== undefined && m.sleep_end_offset_s !== undefined && (
                  <p className="font-mono text-xs text-muted">
                    {formatClock(m.sleep_start_offset_s)} → {formatClock(m.sleep_end_offset_s)}
                    {m.sleep_awake_s !== undefined && ` · ${formatDuration(m.sleep_awake_s)} awake`}
                    {m.sleep_awake_count !== undefined && ` (${m.sleep_awake_count}×)`}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Stages */}
          {segments.length > 0 && (
            <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Stages</p>
              <Hypnogram
                segments={segments}
                startLabel={m.sleep_start_offset_s !== undefined ? formatClock(m.sleep_start_offset_s) : null}
                endLabel={m.sleep_end_offset_s !== undefined ? formatClock(m.sleep_end_offset_s) : null}
              />
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                {(["deep", "light", "rem", "awake"] as const).map((s) => {
                  const part = obj(scores?.[`${s}Percentage`]);
                  const secs = m[`sleep_${s}_s` as SleepMetric];
                  return (
                    <div key={s}>
                      <p className="font-display text-sm font-bold tabular-nums" style={{ color: STAGE_STYLE[s].color }}>
                        {mix[s]}%
                      </p>
                      <p className="text-[9px] uppercase tracking-wide text-muted">{STAGE_STYLE[s].label}</p>
                      <p className="font-mono text-[9px] text-muted">{secs !== undefined ? formatDuration(secs) : "—"}</p>
                      {typeof part?.optimalStart === "number" && typeof part?.optimalEnd === "number" && (
                        <p className="font-mono text-[9px] text-muted/70">
                          ideal {part.optimalStart}–{part.optimalEnd}%
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recovery vs baseline */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recovery vs your normal</h2>
            <div className="grid grid-cols-2 gap-2">
              <RecoveryTile label="Overnight HRV" metric="hrv_ms" value={m.hrv_ms} unit="ms" history={history("hrv_ms")} />
              <RecoveryTile label="Resting HR" metric="resting_hr_bpm" value={m.resting_hr_bpm} unit="bpm" history={history("resting_hr_bpm")} />
              <RecoveryTile label="Breathing" metric="sleep_resp_avg" value={m.sleep_resp_avg} unit="brpm" history={history("sleep_resp_avg")} />
              <RecoveryTile label="Body battery +" metric="body_battery_gain" value={m.body_battery_gain} unit="" history={history("body_battery_gain")} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-muted">
              {m.sleep_stress_avg !== undefined && <>Sleep stress {Math.round(m.sleep_stress_avg)} · </>}
              {m.sleep_hr_avg !== undefined && <>avg sleeping HR {Math.round(m.sleep_hr_avg)} bpm · </>}
              {m.hrv_weekly_avg !== undefined && <>HRV 7-day avg {Math.round(m.hrv_weekly_avg)} ms</>}
            </p>
          </section>

          {/* Overnight series */}
          {overnight.some((s) => s.points.length > 1) && (
            <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Through the night</p>
              <OvernightChart key={date} series={overnight} />
            </section>
          )}

          {/* Score breakdown */}
          {scores && (
            <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Why this score</p>
              <ul className="divide-y divide-surface-raised">
                {SCORE_PARTS.map(([key, label]) => {
                  const q = obj(scores[key])?.qualifierKey;
                  if (typeof q !== "string") return null;
                  return (
                    <li key={key} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-fg">{label}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${QUALIFIER_STYLE[q] ?? "bg-surface-raised text-muted"}`}>
                        {q}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-surface-raised bg-surface p-4 text-center">
          <p className="text-sm text-fg">No watch data for this night.</p>
          <p className="mt-1 text-xs text-muted">
            Wear the watch to bed, or check <Link href="/settings" className="text-accent">Settings → Garmin</Link> is connected.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">How it felt</p>
        {/* Keyed by date + saved row so switching nights reloads the form without a setState-in-effect. */}
        <FeelForm key={`${date}:${night.log?.updated_at ?? "new"}`} logDate={date} log={night.log} />
      </section>
    </div>
  );
}

export default function SleepPage() {
  const today = todayLocal();
  const [date, setDate] = useState(today);
  const { data: trend } = useSleepTrend(90);
  const nights = trend ?? [];
  const recent = nights.filter((n) => n.metrics.sleep_duration_s !== undefined || n.log).slice(-14).reverse();

  return (
    <main className="animate-enter space-y-5 p-4 pb-24">
      <RecoverySubnav />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">Sleep</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous night"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-muted active:bg-surface-raised"
          >
            ‹
          </button>
          <span className="min-w-[92px] text-center font-mono text-xs text-fg">{date === today ? "Last night" : formatDate(date)}</span>
          <button
            type="button"
            aria-label="Next night"
            disabled={date >= today}
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg text-muted active:bg-surface-raised disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <NightView date={date} trend={nights} />

      <SleepTrends nights={nights} today={today} />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent nights</h2>
        {recent.length > 0 ? (
          <ul className="space-y-1.5">
            {recent.map((n) => (
              <li key={n.date}>
                <button
                  type="button"
                  onClick={() => {
                    setDate(n.date);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex min-h-11 w-full items-center justify-between rounded-xl border bg-surface px-3 py-2 text-left transition-colors active:scale-[0.98] ${
                    n.date === date ? "border-accent/50" : "border-surface-raised"
                  }`}
                >
                  <span className="text-sm text-fg">{formatDate(n.date)}</span>
                  <span className="font-mono text-xs text-muted">
                    {n.metrics.sleep_score !== undefined && <span className="font-bold text-fg">{n.metrics.sleep_score} · </span>}
                    {n.metrics.sleep_duration_s !== undefined ? formatDuration(n.metrics.sleep_duration_s) : "—"}
                    {n.log?.quality != null && ` · ${n.log.quality}/5`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No nights yet.</p>
        )}
      </section>
    </main>
  );
}

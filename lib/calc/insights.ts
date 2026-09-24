import { baseline, deltaVsBaseline, formatDuration, timingConsistency } from "./sleep";

/**
 * Free, always-on insights (docs/superpowers/specs/2026-09-24-garmin-expansion-design.md
 * phase 5). Deterministic rules over data the app already has — no LLM, no cost.
 * Every rule has a minimum sample size and states it; silence is preferred to
 * a finding built on three data points.
 */

export interface InsightNight {
  date: string;
  metrics: Partial<Record<string, number>>;
  tags: string[];
}

export interface Insight {
  id: string;
  tone: "good" | "warn" | "info";
  title: string;
  detail: string;
}

const TAG_LABEL: Record<string, string> = {
  caffeine_late: "late caffeine",
  alcohol: "alcohol",
  late_meal: "a late meal",
  screens: "screens in bed",
  stressed: "a stressful day",
  sick: "being sick",
  travel: "travel",
  nap: "a nap",
};

const MIN_TAGGED = 3;
const MIN_SCORE_DELTA = 5; // sleep-score points
const MIN_HRV_DELTA_PCT = 8;

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function tagEffects(nights: InsightNight[]): Insight[] {
  const tags = new Set(nights.flatMap((n) => n.tags));
  const out: Insight[] = [];
  for (const tag of tags) {
    const withTag = nights.filter((n) => n.tags.includes(tag));
    const without = nights.filter((n) => !n.tags.includes(tag));
    const series = (ns: InsightNight[], k: string) => ns.map((n) => n.metrics[k]).filter((v): v is number => v !== undefined);

    const sTag = series(withTag, "sleep_score");
    const sOther = series(without, "sleep_score");
    const hTag = series(withTag, "hrv_ms");
    const hOther = series(without, "hrv_ms");

    const parts: string[] = [];
    let worse = false;
    let better = false;
    if (sTag.length >= MIN_TAGGED && sOther.length >= MIN_TAGGED) {
      const d = mean(sTag) - mean(sOther);
      if (Math.abs(d) >= MIN_SCORE_DELTA) {
        parts.push(`sleep score ${d > 0 ? "+" : "−"}${Math.round(Math.abs(d))}`);
        if (d < 0) worse = true;
        else better = true;
      }
    }
    if (hTag.length >= MIN_TAGGED && hOther.length >= MIN_TAGGED) {
      const pct = ((mean(hTag) - mean(hOther)) / mean(hOther)) * 100;
      if (Math.abs(pct) >= MIN_HRV_DELTA_PCT) {
        parts.push(`HRV ${pct > 0 ? "+" : "−"}${Math.round(Math.abs(pct))}%`);
        if (pct < 0) worse = true;
        else better = true;
      }
    }
    if (parts.length === 0) continue;
    const label = TAG_LABEL[tag] ?? tag.replace(/_/g, " ");
    out.push({
      id: `tag:${tag}`,
      tone: worse && !better ? "warn" : better && !worse ? "good" : "info",
      title: `After ${label}: ${parts.join(", ")}`,
      detail: `Compared with your other nights (n=${withTag.length} tagged vs ${without.length}). Correlation, not causation.`,
    });
  }
  return out;
}

const BASELINE_RULES: Array<{ metric: string; label: string; higherIsBetter: boolean }> = [
  { metric: "hrv_ms", label: "Overnight HRV", higherIsBetter: true },
  { metric: "resting_hr_bpm", label: "Resting heart rate", higherIsBetter: false },
  { metric: "sleep_score", label: "Sleep score", higherIsBetter: true },
];

function baselineAlerts(nights: InsightNight[], today: string): Insight[] {
  const tonight = nights.find((n) => n.date === today);
  if (!tonight) return [];
  const prior = nights.filter((n) => n.date < today).slice(-28);
  const out: Insight[] = [];
  for (const rule of BASELINE_RULES) {
    const value = tonight.metrics[rule.metric];
    const base = baseline(prior.map((n) => n.metrics[rule.metric]).filter((v): v is number => v !== undefined));
    if (value === undefined || !base) continue;
    const d = deltaVsBaseline(value, base, rule.higherIsBetter);
    if (Math.abs(d.z) < 1.5) continue;
    out.push({
      id: `baseline:${rule.metric}`,
      tone: d.tone === "good" ? "good" : "warn",
      title: `${rule.label} ${d.tone === "good" ? "well above" : "well off"} your normal`,
      detail: `${Math.round(value)} vs your ${Math.round(base.mean)} average (${d.z > 0 ? "+" : ""}${d.z.toFixed(1)} SD, ${base.n} nights).${
        d.tone === "bad" ? " Consider an easier session today." : ""
      }`,
    });
  }
  return out;
}

function sleepDebt(nights: InsightNight[], today: string): Insight[] {
  const week = nights.filter((n) => n.date <= today).slice(-7);
  const pairs = week.filter((n) => n.metrics.sleep_duration_s !== undefined && n.metrics.sleep_need_s !== undefined);
  if (pairs.length < 4) return [];
  const debtS = pairs.reduce((a, n) => a + (n.metrics.sleep_need_s! - n.metrics.sleep_duration_s!), 0);
  if (debtS < 3 * 3600) return [];
  return [
    {
      id: "sleep_debt",
      tone: "warn",
      title: `Sleep debt: ${formatDuration(debtS)} this week`,
      detail: `Below Garmin's nightly sleep need on ${pairs.length} tracked nights. An earlier night or two pays it down.`,
    },
  ];
}

function bedtimeConsistency(nights: InsightNight[], today: string): Insight[] {
  const recent = nights.filter((n) => n.date <= today).slice(-14);
  const offsets = recent.map((n) => n.metrics.sleep_start_offset_s).filter((v): v is number => v !== undefined);
  if (offsets.length < 7) return [];
  const sd = timingConsistency(offsets);
  if (sd === null || sd <= 60) return [];
  return [
    {
      id: "bedtime_consistency",
      tone: "info",
      title: `Bedtime varies by ±${Math.round(sd)} min`,
      detail: `Over the last ${offsets.length} nights. A steadier bedtime tends to lift sleep quality more than extra hours do.`,
    },
  ];
}

/** All rule-based insights for `today`, most actionable first. */
export function buildInsights(nights: InsightNight[], today: string): Insight[] {
  const order = { warn: 0, good: 1, info: 2 };
  return [
    ...baselineAlerts(nights, today),
    ...sleepDebt(nights, today),
    ...tagEffects(nights.filter((n) => n.date <= today)),
    ...bedtimeConsistency(nights, today),
  ].sort((a, b) => order[a.tone] - order[b.tone]);
}

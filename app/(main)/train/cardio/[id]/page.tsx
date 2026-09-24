"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TrainSubnav } from "@/components/train/TrainSubnav";
import { hrZones, laps, strengthSets } from "@/lib/calc/activity";
import { formatDistance, formatPace } from "@/lib/calc/pace";
import { formatDuration } from "@/lib/calc/sleep";
import { formatDate, formatTime, localDateOf } from "@/lib/datetime";
import { ACTIVITY_LABELS, useActivityDetail, type Activity } from "@/lib/queries/cardio";
import { useUnits } from "@/lib/queries/units";
import { formatWeightKg } from "@/lib/units";

// Garmin's 5-zone palette order, cool → hot.
const ZONE_COLOR = ["#7dd3fc", "var(--accent-dim)", "var(--accent)", "#fbbf24", "#fb7185"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-raised bg-surface p-2.5 text-center">
      <p className="font-display text-base font-bold tabular-nums text-fg">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useActivityDetail(id);
  const { distance: distanceUnit, weight: weightUnit } = useUnits();

  if (isLoading) return <main className="p-4"><div className="h-64 animate-pulse rounded-2xl bg-surface-raised" /></main>;
  if (error || !data) {
    return (
      <main className="p-4">
        <p className="text-sm text-rose-300">Couldn&apos;t load this activity — {error instanceof Error ? error.message : "try again"}.</p>
      </main>
    );
  }

  const s = data.session;
  const zones = hrZones(data.parts.hr_zones);
  const lapRows = laps(data.parts.splits);
  const sets = strengthSets(data.parts.sets);
  const te = (v: number | null) => (v !== null ? v.toFixed(1) : "—");

  return (
    <main className="animate-enter space-y-4 p-4 pb-24">
      <TrainSubnav />
      <div>
        <Link href="/train/cardio" className="font-mono text-[11px] text-accent">
          ‹ Cardio
        </Link>
        <h1 className="mt-1 font-display text-xl font-bold capitalize text-fg">
          {s.notes ?? ACTIVITY_LABELS[s.activity as Activity] ?? s.activity.replace(/_/g, " ")}
        </h1>
        <p className="font-mono text-[11px] text-muted">
          {formatDate(localDateOf(s.started_at))} · {formatTime(s.started_at)}
        </p>
      </div>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="Time" value={s.duration_s !== null ? formatDuration(s.duration_s) : "—"} />
        <Stat label="Distance" value={formatDistance(s.distance_m, distanceUnit)} />
        <Stat label="Pace" value={formatPace(s.distance_m, s.duration_s, distanceUnit)} />
        <Stat label="Avg HR" value={s.avg_hr_bpm !== null ? `${s.avg_hr_bpm}` : "—"} />
        <Stat label="Max HR" value={s.max_hr_bpm !== null ? `${s.max_hr_bpm}` : "—"} />
        <Stat label="Calories" value={s.calories_kcal !== null ? `${s.calories_kcal}` : "—"} />
        <Stat label="Aerobic TE" value={te(s.training_effect_aerobic)} />
        <Stat label="Anaerobic TE" value={te(s.training_effect_anaerobic)} />
        <Stat label="Load" value={s.training_load !== null ? `${Math.round(s.training_load)}` : "—"} />
      </section>

      {zones.length > 0 && (
        <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Heart rate zones</p>
          <ul className="space-y-1.5">
            {zones.map((z) => (
              <li key={z.zone} className="flex items-center gap-2 text-[11px]">
                <span className="w-16 shrink-0 text-muted">
                  Z{z.zone}
                  {z.lowBpm !== null && <span className="text-muted/70"> {z.lowBpm}+</span>}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                  <span className="block h-full rounded-full" style={{ width: `${z.pct}%`, background: ZONE_COLOR[z.zone - 1] ?? "var(--muted)" }} />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-muted">{formatDuration(z.seconds)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sets.length > 0 && (
        <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Sets recorded on the watch</p>
          <ul className="divide-y divide-surface-raised">
            {sets.map((g) => (
              <li key={g.name} className="py-2">
                <p className="text-sm font-semibold text-fg">{g.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">
                  {g.sets
                    .map((set) => `${set.reps ?? "?"}${set.weightKg !== null ? ` × ${formatWeightKg(set.weightKg, weightUnit)}` : ""}`)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lapRows.length > 1 && (
        <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Laps</p>
          <table className="w-full font-mono text-xs">
            <thead className="text-left text-[10px] uppercase text-muted">
              <tr>
                <th className="py-1 font-normal">#</th>
                <th className="py-1 font-normal">Dist</th>
                <th className="py-1 font-normal">Time</th>
                <th className="py-1 font-normal">Pace</th>
                <th className="py-1 text-right font-normal">HR</th>
              </tr>
            </thead>
            <tbody className="text-fg">
              {lapRows.map((l) => (
                <tr key={l.index} className="border-t border-surface-raised">
                  <td className="py-1.5 text-muted">{l.index}</td>
                  <td className="py-1.5">{formatDistance(l.distanceM, distanceUnit)}</td>
                  <td className="py-1.5">{l.durationS !== null ? formatDuration(l.durationS) : "—"}</td>
                  <td className="py-1.5">{formatPace(l.distanceM, l.durationS, distanceUnit)}</td>
                  <td className="py-1.5 text-right">{l.avgHr ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {s.source === "garmin" && zones.length === 0 && sets.length === 0 && lapRows.length <= 1 && (
        <p className="text-xs text-muted">No detail from Garmin for this activity yet — it arrives on the next sync.</p>
      )}
    </main>
  );
}

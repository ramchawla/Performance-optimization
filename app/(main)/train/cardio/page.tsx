"use client";

import { useState } from "react";
import { TrainSubnav } from "@/components/train/TrainSubnav";
import { formatDate, formatTime, localDateOf, nowTimeInput, todayLocal } from "@/lib/datetime";
import {
  ACTIVITIES,
  ACTIVITY_LABELS,
  useCardioHistory,
  useDeleteCardio,
  useLogCardio,
  type Activity,
} from "@/lib/queries/cardio";
import { formatDistance, formatPace } from "@/lib/calc/pace";
import { useUnits } from "@/lib/queries/units";

const FIELD =
  "w-full rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-sm text-fg placeholder:text-muted focus-visible:border-accent focus-visible:outline-none";
const LABEL = "mb-1 block text-[11px] uppercase tracking-wide text-muted";

function LogForm({ onDone }: { onDone: () => void }) {
  const logCardio = useLogCardio();
  const { distance: distanceUnit } = useUnits();

  const [activity, setActivity] = useState<Activity>("run");
  const [date, setDate] = useState(todayLocal);
  const [time, setTime] = useState(nowTimeInput);
  const [distance, setDistance] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Distance is entered in the display unit and stored in metres (CLAUDE.md rule 1).
    const distanceM = distance
      ? Math.round(Number(distance) * (distanceUnit === "mi" ? 1609.344 : 1000))
      : null;
    logCardio.mutate(
      {
        date,
        time,
        activity,
        distanceM,
        durationS: durationMin ? Math.round(Number(durationMin) * 60) : null,
        avgHrBpm: avgHr ? Number(avgHr) : null,
        maxHrBpm: maxHr ? Number(maxHr) : null,
        perceivedEffort: effort ? Number(effort) : null,
        notes: notes.trim() || null,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={submit} className="animate-enter space-y-3 rounded-2xl border border-surface-raised bg-surface p-3.5">
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITIES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setActivity(a)}
            aria-pressed={activity === a}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 ${
              activity === a
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-surface-raised text-muted hover:text-fg"
            }`}
          >
            {ACTIVITY_LABELS[a]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="c-date" className={LABEL}>
            Date
          </label>
          <input id="c-date" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="c-time" className={LABEL}>
            Start time
          </label>
          <input id="c-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="c-dist" className={LABEL}>
            Distance ({distanceUnit})
          </label>
          <input
            id="c-dist"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="c-dur" className={LABEL}>
            Duration (min)
          </label>
          <input
            id="c-dur"
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="c-avghr" className={LABEL}>
            Avg HR
          </label>
          <input id="c-avghr" type="number" min="0" inputMode="numeric" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="c-maxhr" className={LABEL}>
            Max HR
          </label>
          <input id="c-maxhr" type="number" min="0" inputMode="numeric" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="c-rpe" className={LABEL}>
            Effort 1–10
          </label>
          <input id="c-rpe" type="number" min="1" max="10" inputMode="numeric" value={effort} onChange={(e) => setEffort(e.target.value)} className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="c-notes" className={LABEL}>
          Notes
        </label>
        <input id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Route, weather, how it felt" className={FIELD} />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={logCardio.isPending}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {logCardio.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised"
        >
          Cancel
        </button>
      </div>
      {logCardio.isError && <p className="text-xs text-red-400">Failed to save — try again.</p>}
    </form>
  );
}

export default function CardioPage() {
  const [logging, setLogging] = useState(false);
  const { data: sessions } = useCardioHistory(30);
  const { distance: distanceUnit } = useUnits();
  const deleteCardio = useDeleteCardio();

  return (
    <main className="animate-enter p-4 pb-24">
      <TrainSubnav />
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">Cardio</h1>
        <button onClick={() => setLogging((v) => !v)} className="font-mono text-[11px] text-accent">
          {logging ? "Cancel" : "+ Log"}
        </button>
      </div>

      {logging && (
        <div className="mt-4">
          <LogForm onDone={() => setLogging(false)} />
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">History</h2>
        {sessions && sessions.length > 0 ? (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-2xl border border-surface-raised bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-bold capitalize text-fg">
                    {ACTIVITY_LABELS[s.activity as Activity] ?? s.activity}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {formatDate(localDateOf(s.started_at))} · {formatTime(s.started_at)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted">
                  <span className="text-accent">{formatDistance(s.distance_m, distanceUnit)}</span>
                  {s.duration_s !== null && <span>{Math.round(s.duration_s / 60)} min</span>}
                  <span>{formatPace(s.distance_m, s.duration_s, distanceUnit)}</span>
                  {s.avg_hr_bpm !== null && <span>{s.avg_hr_bpm} bpm avg</span>}
                  {s.perceived_effort !== null && <span>RPE {s.perceived_effort}</span>}
                  {s.source === "strava" && <span className="text-muted/60">Strava</span>}
                </div>
                {s.notes && <p className="mt-1 truncate text-xs text-muted">{s.notes}</p>}
                {s.source === "manual" && (
                  <button
                    onClick={() => deleteCardio.mutate(s.id)}
                    className="mt-1.5 font-mono text-[10px] text-muted transition-colors duration-200 hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">Nothing logged yet.</p>
        )}
      </section>
    </main>
  );
}

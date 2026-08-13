"use client";

import { useState } from "react";
import { WeekRing } from "@/components/mobility/WeekRing";
import { RecentSessions, type RecentSessionItem } from "@/components/mobility/RecentSessions";
import { useLogMobility, useMobilityHistory } from "@/lib/queries/mobility";

// ponytail: no mobility_routines/mobility_sessions schema exists — mobility_logs
// is one flat row per day (exercises_done jsonb tag list + hip_tightness +
// duration), so this is a single daily log form, not a routine picker/timer.
const EXERCISE_TAGS = ["Couch stretch", "90/90 hips", "Glute bridge", "Cat-cow", "Ankle rocks", "Shoulder CARs", "Thread the needle", "World's greatest stretch"];

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function daysAgo(logDate: string): number {
  const d = new Date(`${logDate}T12:00:00`);
  const today = new Date(`${todayLocal()}T12:00:00`);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

function LogForm({ onDone }: { onDone: () => void }) {
  const logMobility = useLogMobility();
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [tightness, setTightness] = useState(3);
  const [duration, setDuration] = useState("10");

  function toggleTag(tag: string) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    logMobility.mutate(
      {
        exercisesDone: [...tags],
        hipTightness: tightness,
        durationMin: duration ? Number(duration) : null,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-enter space-y-3 rounded-2xl border border-surface-raised bg-surface p-3.5">
      <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">Log today&apos;s mobility</p>
      <div className="flex flex-wrap gap-1.5">
        {EXERCISE_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            aria-pressed={tags.has(tag)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 ${
              tags.has(tag) ? "border-accent/40 bg-accent/10 text-accent" : "border-surface-raised text-muted hover:text-fg"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Duration (min)
          <input
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-sm text-fg focus-visible:border-accent focus-visible:outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Hip tightness (1–5)
          <input
            type="range"
            min="1"
            max="5"
            value={tightness}
            onChange={(e) => setTightness(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={logMobility.isPending}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {logMobility.isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Page() {
  const [logging, setLogging] = useState(false);
  const { data: history } = useMobilityHistory(14);

  const last7 = (history ?? []).filter((h) => daysAgo(h.log_date) < 7 && h.completed);
  const weekActiveDays = last7.length;

  const sessions: RecentSessionItem[] = (history ?? []).map((h) => ({
    id: h.id,
    routineName: (h.exercises_done as string[]).length > 0 ? (h.exercises_done as string[]).join(", ") : "Mobility session",
    durationLabel: h.duration_min ? `${h.duration_min} min` : "—",
    daysAgo: daysAgo(h.log_date),
    skippedStretch: (h.hip_tightness ?? 0) >= 4,
    isNew: false,
  }));

  return (
    <main className="animate-enter p-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">Mobility</h1>
        <button onClick={() => setLogging((v) => !v)} className="font-mono text-[11px] text-accent">
          {logging ? "Cancel" : "+ Log"}
        </button>
      </div>

      <section className="mt-5 rounded-2xl bg-surface p-4">
        <WeekRing activeDays={weekActiveDays} totalDays={7} streakWeeks={0} />
      </section>

      {logging && (
        <section className="mt-5">
          <LogForm onDone={() => setLogging(false)} />
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent sessions</h2>
        {sessions.length > 0 ? (
          <RecentSessions sessions={sessions} gapLabel={null} />
        ) : (
          <p className="text-xs text-muted">No sessions logged yet.</p>
        )}
      </section>
    </main>
  );
}

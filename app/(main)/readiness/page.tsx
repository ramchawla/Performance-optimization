"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, todayLocal } from "@/lib/datetime";
import {
  ILLNESS_OPTIONS,
  READINESS_FIELDS,
  useReadinessHistory,
  useReadinessLog,
  useUpsertReadiness,
  type ReadinessField,
  type ReadinessLog,
} from "@/lib/queries/readiness";
import { deriveReadinessScore } from "@/lib/calc/readiness";

type Ratings = Partial<Record<ReadinessField, number | null>>;

function ratingsFrom(log: ReadinessLog | null): Ratings {
  if (!log) return {};
  const out: Ratings = {};
  for (const field of READINESS_FIELDS) out[field.key] = log[field.key];
  return out;
}

function RatingRow({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-fg">{label}</span>
        {/* Tapping the selected value clears it — "not recorded" has to stay reachable. */}
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="font-mono text-[10px] text-muted hover:text-fg"
          >
            clear
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label}: ${n} of 5`}
            aria-pressed={value === n}
            className={`min-h-11 flex-1 rounded-xl border font-mono text-sm transition-colors duration-150 ${
              value === n
                ? "border-accent bg-accent text-bg"
                : "border-surface-raised text-muted hover:border-accent/40 hover:text-fg"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export default function ReadinessPage() {
  const [logDate, setLogDate] = useState(todayLocal);
  const { data: existing, isLoading } = useReadinessLog(logDate);
  const { data: history } = useReadinessHistory(14);
  const upsert = useUpsertReadiness();

  // Re-key to the day being edited so switching dates reloads the form
  // without a setState-in-effect cascade.
  const [formKey, setFormKey] = useState(`${logDate}:new`);
  const [ratings, setRatings] = useState<Ratings>({});
  const [illness, setIllness] = useState<string>("none");
  const [notes, setNotes] = useState("");

  const loadedKey = `${logDate}:${existing?.id ?? "new"}`;
  if (!isLoading && formKey !== loadedKey) {
    setFormKey(loadedKey);
    setRatings(ratingsFrom(existing ?? null));
    setIllness(existing?.illness ?? "none");
    setNotes(existing?.notes ?? "");
  }

  const score = deriveReadinessScore(ratings);
  const answered = Object.values(ratings).filter((v) => v != null).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    upsert.mutate({
      logDate,
      illness,
      readinessScore: score,
      notes: notes.trim() || null,
      ...ratings,
    });
  }

  return (
    <main className="animate-enter p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">Check-in</h1>
        <Link href="/dashboard" className="font-mono text-[11px] text-accent">
          Dashboard
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted">
        Twenty seconds. Skip anything you don&apos;t have a feel for — blank is better than a guess.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <label htmlFor="r-date" className="mb-1 block text-[11px] uppercase tracking-wide text-muted">
            Day
          </label>
          <input
            id="r-date"
            type="date"
            value={logDate}
            max={todayLocal()}
            onChange={(e) => setLogDate(e.target.value)}
            className="w-full rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-sm text-fg focus-visible:border-accent focus-visible:outline-none"
          />
        </div>

        <div className="rounded-2xl border border-surface-raised bg-surface px-3.5 py-1 divide-y divide-surface-raised">
          {READINESS_FIELDS.map((field) => (
            <RatingRow
              key={field.key}
              label={field.label}
              low={field.low}
              high={field.high}
              value={ratings[field.key]}
              onChange={(v) => setRatings((r) => ({ ...r, [field.key]: v }))}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">Feeling ill?</span>
          <div className="flex gap-1.5">
            {ILLNESS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setIllness(opt)}
                aria-pressed={illness === opt}
                className={`min-h-11 flex-1 rounded-xl border text-xs capitalize transition-colors duration-150 ${
                  illness === opt
                    ? "border-accent bg-accent text-bg"
                    : "border-surface-raised text-muted hover:text-fg"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <label htmlFor="r-notes" className="mt-3.5 mb-1 block text-[11px] uppercase tracking-wide text-muted">
            Anything worth noting
          </label>
          <textarea
            id="r-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Slept badly, big day at work, tweaked my knee…"
            className="w-full resize-none rounded-xl border border-surface-raised bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
          />
        </div>

        <div className="rounded-2xl border border-surface-raised bg-surface p-4 text-center">
          <div className="font-display text-4xl font-bold leading-none text-accent">{score ?? "—"}</div>
          <div className="mt-1 text-[11px] text-muted">
            {score === null ? "Rate something to get a score" : `Readiness / 10 · from ${answered} answers`}
          </div>
        </div>

        <button
          type="submit"
          disabled={upsert.isPending}
          className="min-h-11 w-full rounded-xl bg-accent px-3 py-3 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {upsert.isPending ? "Saving…" : existing ? "Update check-in" : "Save check-in"}
        </button>
        {upsert.isError && <p className="text-center text-xs text-red-400">Failed to save — try again.</p>}
        {upsert.isSuccess && !upsert.isPending && <p className="text-center text-xs text-accent">Saved.</p>}
      </form>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent</h2>
        {history && history.length > 0 ? (
          <ul className="space-y-1.5">
            {history.map((day) => (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => setLogDate(day.log_date)}
                  className="flex w-full min-h-11 items-center justify-between rounded-xl border border-surface-raised bg-surface px-3 py-2 text-left transition-colors duration-200 hover:border-accent/40"
                >
                  <span className="text-sm text-fg">{formatDate(day.log_date)}</span>
                  <span className="font-mono text-xs text-muted">
                    {day.readiness_score !== null ? `${day.readiness_score}/10` : "—"}
                    {day.illness && day.illness !== "none" ? ` · ${day.illness}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No check-ins yet.</p>
        )}
      </section>
    </main>
  );
}

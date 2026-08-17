"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDuration, resolveSleepWindow } from "@/lib/calc/sleepWindow";
import { useSleepHistory, useSleepLog, useUpsertSleepLog, type SleepLog } from "@/lib/queries/sleep";

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** "" is the honest representation of "I didn't record this", not 0. */
function toNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function minutesToS(v: string): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n * 60);
}

function sToMinutes(v: number | null): string {
  return v === null ? "" : String(Math.round(v / 60));
}

/** Local "HH:MM" for an <input type="time">, or "" if unset. */
function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  bedTime: "",
  wakeTime: "",
  durationH: "",
  remMin: "",
  deepMin: "",
  coreMin: "",
  scoreDisruptions: "",
  scoreConsistency: "",
  scoreDuration: "",
  quality: "",
  notes: "",
};

type Form = typeof EMPTY_FORM;

function formFromLog(log: SleepLog | null): Form {
  if (!log) return EMPTY_FORM;
  return {
    bedTime: toTimeInput(log.bedtime_at),
    wakeTime: toTimeInput(log.waketime_at),
    durationH: log.duration_s === null ? "" : String(Math.round((log.duration_s / 3600) * 100) / 100),
    remMin: sToMinutes(log.rem_s),
    deepMin: sToMinutes(log.deep_s),
    coreMin: sToMinutes(log.core_s),
    scoreDisruptions: log.score_disruptions === null ? "" : String(log.score_disruptions),
    scoreConsistency: log.score_consistency === null ? "" : String(log.score_consistency),
    scoreDuration: log.score_duration === null ? "" : String(log.score_duration),
    quality: log.quality === null ? "" : String(log.quality),
    notes: log.notes ?? "",
  };
}

const FIELD_CLASS =
  "w-full rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-sm text-fg focus-visible:border-accent focus-visible:outline-none";
const LABEL_CLASS = "mb-1.5 block text-[11px] uppercase tracking-wide text-muted";

export default function SleepPage() {
  const [logDate, setLogDate] = useState(todayLocal);
  const { data: existing, isLoading } = useSleepLog(logDate);
  const { data: history } = useSleepHistory(14);
  const upsert = useUpsertSleepLog();

  // Re-key the form to the day being edited so switching dates reloads it
  // without a setState-in-effect cascade.
  const [formKey, setFormKey] = useState(`${logDate}:new`);
  const loadedKey = `${logDate}:${existing?.id ?? "new"}`;
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  if (!isLoading && formKey !== loadedKey) {
    setFormKey(loadedKey);
    setForm(formFromLog(existing ?? null));
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Bed + wake derive the duration; a typed duration wins if bed/wake is blank.
  const window = resolveSleepWindow(logDate, form.bedTime, form.wakeTime);
  const typedDurationS = toNum(form.durationH) === null ? null : Math.round(toNum(form.durationH)! * 3600);
  const durationS = window?.durationS ?? typedDurationS;

  const scoreParts = [form.scoreDisruptions, form.scoreConsistency, form.scoreDuration].map(toNum);
  const scoreTotal = scoreParts.some((p) => p !== null)
    ? scoreParts.reduce<number>((sum, p) => sum + (p ?? 0), 0)
    : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    upsert.mutate({
      logDate,
      bedtimeAt: window?.bedtimeAt ?? null,
      waketimeAt: window?.waketimeAt ?? null,
      durationS,
      remS: minutesToS(form.remMin),
      deepS: minutesToS(form.deepMin),
      coreS: minutesToS(form.coreMin),
      scoreDisruptions: toNum(form.scoreDisruptions),
      scoreConsistency: toNum(form.scoreConsistency),
      scoreDuration: toNum(form.scoreDuration),
      quality: toNum(form.quality),
      notes: form.notes.trim() || null,
    });
  }

  return (
    <main className="animate-enter p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">Sleep</h1>
        <Link href="/dashboard" className="font-mono text-[11px] text-accent">
          Dashboard
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted">Fill in as much or as little as you know — every field is optional.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <label htmlFor="log-date" className={LABEL_CLASS}>
            Night of (wake-up date)
          </label>
          <input
            id="log-date"
            type="date"
            value={logDate}
            max={todayLocal()}
            onChange={(e) => setLogDate(e.target.value)}
            className={FIELD_CLASS}
          />

          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="bed-time" className={LABEL_CLASS}>
                Went to bed
              </label>
              <input
                id="bed-time"
                type="time"
                value={form.bedTime}
                onChange={(e) => set("bedTime", e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="wake-time" className={LABEL_CLASS}>
                Woke up
              </label>
              <input
                id="wake-time"
                type="time"
                value={form.wakeTime}
                onChange={(e) => set("wakeTime", e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="mt-3.5">
            <label htmlFor="duration-h" className={LABEL_CLASS}>
              Total hours {window && <span className="text-accent">· derived from times above</span>}
            </label>
            <input
              id="duration-h"
              type="number"
              step="0.25"
              min="0"
              inputMode="decimal"
              disabled={!!window}
              value={window ? String(Math.round((window.durationS / 3600) * 100) / 100) : form.durationH}
              onChange={(e) => set("durationH", e.target.value)}
              className={`${FIELD_CLASS} disabled:opacity-60`}
            />
            {durationS !== null && (
              <p className="mt-1.5 font-display text-sm font-bold text-accent">{formatDuration(durationS)}</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide text-muted">Stages (minutes)</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["remMin", "REM", "rem-min"],
                ["deepMin", "Deep", "deep-min"],
                ["coreMin", "Core", "core-min"],
              ] as const
            ).map(([key, label, id]) => (
              <div key={key}>
                <label htmlFor={id} className={LABEL_CLASS}>
                  {label}
                </label>
                <input
                  id={id}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">Apple sleep score</p>
            {scoreTotal !== null && (
              <span className="font-mono text-sm font-bold text-accent">{scoreTotal}/100</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["scoreDisruptions", "Disruptions", 20, "score-dis"],
                ["scoreConsistency", "Consistency", 30, "score-con"],
                ["scoreDuration", "Duration", 50, "score-dur"],
              ] as const
            ).map(([key, label, max, id]) => (
              <div key={key}>
                <label htmlFor={id} className={LABEL_CLASS}>
                  {label} /{max}
                </label>
                <input
                  id={id}
                  type="number"
                  min="0"
                  max={max}
                  inputMode="numeric"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-surface-raised bg-surface p-3.5">
          <label htmlFor="quality" className={LABEL_CLASS}>
            How it actually felt {form.quality && <span className="text-accent">· {form.quality}/5</span>}
          </label>
          <input
            id="quality"
            type="range"
            min="1"
            max="5"
            value={form.quality || "3"}
            onChange={(e) => set("quality", e.target.value)}
            className="w-full accent-[var(--accent)]"
          />
          <label htmlFor="notes" className={`${LABEL_CLASS} mt-3.5`}>
            Notes
          </label>
          <textarea
            id="notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Late caffeine, woke at 3am, …"
            className={`${FIELD_CLASS} resize-none placeholder:text-muted`}
          />
        </section>

        <button
          type="submit"
          disabled={upsert.isPending}
          className="min-h-11 w-full rounded-xl bg-accent px-3 py-3 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {upsert.isPending ? "Saving…" : existing ? "Update night" : "Save night"}
        </button>
        {upsert.isError && (
          <p className="text-center text-xs text-red-400">
            {upsert.error instanceof Error ? upsert.error.message : "Failed to save — try again."}
          </p>
        )}
        {upsert.isSuccess && !upsert.isPending && (
          <p className="text-center text-xs text-accent">Saved.</p>
        )}
      </form>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent nights</h2>
        {history && history.length > 0 ? (
          <ul className="space-y-1.5">
            {history.map((night) => (
              <li key={night.id}>
                <button
                  type="button"
                  onClick={() => setLogDate(night.log_date)}
                  className="flex w-full min-h-11 items-center justify-between rounded-xl border border-surface-raised bg-surface px-3 py-2 text-left transition-colors duration-200 hover:border-accent/40 active:scale-[0.98]"
                >
                  <span className="text-sm text-fg">
                    {new Date(`${night.log_date}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {night.duration_s !== null ? formatDuration(night.duration_s) : "—"}
                    {night.quality !== null && ` · ${night.quality}/5`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No nights logged yet.</p>
        )}
      </section>
    </main>
  );
}

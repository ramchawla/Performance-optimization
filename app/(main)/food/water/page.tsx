"use client";

import { useState } from "react";
import { FoodSubnav } from "@/components/food/FoodSubnav";
import { formatDate, formatTime, nowTimeInput, todayLocal } from "@/lib/datetime";
import {
  CONTEXT_LABELS,
  DRINK_CONTEXTS,
  DRINK_LABELS,
  DRINK_TYPES,
  QUICK_VOLUMES_ML,
  TYPICAL_CAFFEINE_MG,
  useDeleteDrink,
  useHydrationLog,
  useLogDrink,
  type DrinkContext,
  type DrinkType,
} from "@/lib/queries/hydration";
import { summarizeHydration } from "@/lib/calc/hydration";

const DAILY_TARGET_ML = 3000;

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

const FIELD =
  "w-full rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-sm text-fg focus-visible:border-accent focus-visible:outline-none";
const LABEL = "mb-1 block text-[11px] uppercase tracking-wide text-muted";

function DrinkForm({ logDate, onDone }: { logDate: string; onDone: () => void }) {
  const logDrink = useLogDrink();
  const [drinkType, setDrinkType] = useState<DrinkType>("water");
  const [volume, setVolume] = useState("500");
  const [time, setTime] = useState(nowTimeInput);
  const [context, setContext] = useState<DrinkContext | "">("");
  const [caffeine, setCaffeine] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [notes, setNotes] = useState("");

  // Switching to coffee shouldn't silently invent a caffeine dose you didn't
  // confirm — it prefills, and only when the field is untouched.
  function pickType(next: DrinkType) {
    setDrinkType(next);
    if (!caffeine) {
      const typical = TYPICAL_CAFFEINE_MG[next];
      if (typical) setCaffeine(String(typical));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const volumeMl = Number(volume);
    if (!Number.isFinite(volumeMl) || volumeMl <= 0) return;
    logDrink.mutate(
      {
        logDate,
        time,
        volumeMl,
        drinkType,
        caffeineMg: caffeine ? Number(caffeine) : null,
        alcoholUnits: alcohol ? Number(alcohol) : null,
        context: context || null,
        notes: notes.trim() || null,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={submit} className="animate-enter space-y-3 rounded-2xl border border-surface-raised bg-surface p-3.5">
      <div className="flex flex-wrap gap-1.5">
        {DRINK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pickType(t)}
            aria-pressed={drinkType === t}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 ${
              drinkType === t ? "border-accent/40 bg-accent/10 text-accent" : "border-surface-raised text-muted hover:text-fg"
            }`}
          >
            {DRINK_LABELS[t]}
          </button>
        ))}
      </div>

      <div>
        <span className={LABEL}>Amount (ml)</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_VOLUMES_ML.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVolume(String(v))}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-colors duration-150 ${
                volume === String(v)
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-surface-raised text-muted hover:text-fg"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          aria-label="Amount in millilitres"
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="drink-time" className={LABEL}>
            Time
          </label>
          <input id="drink-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="drink-context" className={LABEL}>
            Context
          </label>
          <select
            id="drink-context"
            value={context}
            onChange={(e) => setContext(e.target.value as DrinkContext | "")}
            className={FIELD}
          >
            <option value="">—</option>
            {DRINK_CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {CONTEXT_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="drink-caffeine" className={LABEL}>
            Caffeine (mg)
          </label>
          <input
            id="drink-caffeine"
            type="number"
            min="0"
            inputMode="numeric"
            value={caffeine}
            onChange={(e) => setCaffeine(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="drink-alcohol" className={LABEL}>
            Alcohol (units)
          </label>
          <input
            id="drink-alcohol"
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={alcohol}
            onChange={(e) => setAlcohol(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="drink-notes" className={LABEL}>
          Notes
        </label>
        <input
          id="drink-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${FIELD} placeholder:text-muted`}
          placeholder="Optional"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={logDrink.isPending}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {logDrink.isPending ? "Saving…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
      {logDrink.isError && <p className="text-xs text-red-400">Failed to save — try again.</p>}
    </form>
  );
}

export default function WaterPage() {
  const [logDate, setLogDate] = useState(todayLocal);
  const [adding, setAdding] = useState(false);
  const { data: entries } = useHydrationLog(logDate);
  const logDrink = useLogDrink();
  const deleteDrink = useDeleteDrink();

  const totals = summarizeHydration(entries ?? []);
  const pct = Math.min(100, Math.round((totals.waterEquivalentMl / DAILY_TARGET_ML) * 100));

  return (
    <main className="min-h-screen bg-bg p-4 pb-24">
      <FoodSubnav />

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setLogDate((d) => shiftDate(d, -1))}
          aria-label="Previous day"
          className="min-h-11 min-w-11 rounded-xl px-2 text-lg text-fg transition-colors duration-200 hover:bg-surface-raised"
        >
          ‹
        </button>
        <h1 className="font-display text-lg font-bold text-fg">
          {logDate === todayLocal() ? "Today" : formatDate(logDate)}
        </h1>
        <button
          onClick={() => setLogDate((d) => shiftDate(d, 1))}
          aria-label="Next day"
          className="min-h-11 min-w-11 rounded-xl px-2 text-lg text-fg transition-colors duration-200 hover:bg-surface-raised"
        >
          ›
        </button>
      </div>

      <section className="mt-3 rounded-2xl border border-surface-raised bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-display text-4xl font-bold leading-none text-fg">
              {(totals.waterEquivalentMl / 1000).toFixed(2)}
            </span>
            <span className="ml-1 text-xs text-muted">L of {DAILY_TARGET_ML / 1000}L</span>
          </div>
          <span className="font-mono text-sm text-accent">{pct}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-bg px-2 py-2">
            <div className="font-mono text-sm font-bold text-fg">{totals.caffeineMg || "—"}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Caffeine mg</div>
          </div>
          <div className="rounded-xl bg-bg px-2 py-2">
            <div className="font-mono text-sm font-bold text-fg">{totals.alcoholUnits || "—"}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Alcohol</div>
          </div>
          <div className="rounded-xl bg-bg px-2 py-2">
            <div className="font-mono text-sm font-bold text-fg">{formatTime(totals.lastCaffeineAt)}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Last caffeine</div>
          </div>
        </div>
      </section>

      {/* One-tap logging for the overwhelmingly common case. */}
      {!adding && (
        <div className="mt-3 flex gap-2">
          {QUICK_VOLUMES_ML.slice(0, 3).map((v) => (
            <button
              key={v}
              onClick={() => logDrink.mutate({ logDate, volumeMl: v, drinkType: "water" })}
              disabled={logDrink.isPending}
              className="min-h-11 flex-1 rounded-xl border border-surface-raised bg-surface font-display text-sm font-bold text-fg transition-colors duration-200 hover:border-accent/40 active:scale-[0.98] disabled:opacity-50"
            >
              +{v}
            </button>
          ))}
          <button
            onClick={() => setAdding(true)}
            className="min-h-11 rounded-xl bg-accent px-4 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98]"
          >
            More
          </button>
        </div>
      )}

      {adding && (
        <div className="mt-3">
          <DrinkForm logDate={logDate} onDone={() => setAdding(false)} />
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {entries?.length ?? 0} {entries?.length === 1 ? "drink" : "drinks"}
        </h2>
        {entries && entries.length > 0 ? (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-xl border border-surface-raised bg-surface px-3 py-2"
              >
                <span className="font-mono text-[11px] text-muted">{formatTime(e.consumed_at)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {DRINK_LABELS[e.drink_type as DrinkType] ?? e.drink_type}
                  {e.caffeine_mg ? <span className="text-muted"> · {e.caffeine_mg}mg caf</span> : null}
                  {e.context ? <span className="text-muted"> · {CONTEXT_LABELS[e.context as DrinkContext]}</span> : null}
                </span>
                <span className="shrink-0 font-mono text-xs text-accent">{e.volume_ml}ml</span>
                <button
                  onClick={() => deleteDrink.mutate(e.id)}
                  aria-label={`Remove ${e.volume_ml}ml ${e.drink_type}`}
                  className="min-h-11 min-w-11 shrink-0 rounded-xl text-xs text-muted transition-colors duration-200 hover:text-red-400"
                >
                  ✕
                </button>
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

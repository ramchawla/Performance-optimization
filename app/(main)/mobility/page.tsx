"use client";

import { useState } from "react";
import { WeekRing } from "@/components/mobility/WeekRing";
import { RecentSessions, type RecentSessionItem } from "@/components/mobility/RecentSessions";
import { PresetPlayer } from "@/components/mobility/PresetPlayer";
import { useLogMobility, useMobilityHistory } from "@/lib/queries/mobility";
import { todayLocal } from "@/lib/datetime";
import {
  BODY_PART_LABELS,
  CONDITION_LABELS,
  DURATIONS,
  EQUIPMENT_LABELS,
  SELECTABLE_EQUIPMENT,
  filterPresets,
  presetSeconds,
  type BodyPart,
  type Condition,
  type Duration,
  type Equipment,
  type Preset,
} from "@/lib/mobility/presets";

// ponytail: mobility_logs is one flat row per day (exercises_done jsonb tag
// list + hip_tightness + duration) — there is no routines/sessions schema, so
// running a preset just pre-fills that single daily row.
const EXERCISE_TAGS = ["Couch stretch", "90/90 hips", "Glute bridge", "Cat-cow", "Ankle rocks", "Shoulder CARs", "Thread the needle", "World's greatest stretch"];

const BODY_PARTS = Object.keys(BODY_PART_LABELS) as BodyPart[];
const CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[];

const EQUIPMENT_KEY = "perfhub:mobilityEquipment";

function daysAgo(logDate: string): number {
  const d = new Date(`${logDate}T12:00:00`);
  const today = new Date(`${todayLocal()}T12:00:00`);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

function loadEquipment(): Equipment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EQUIPMENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e): e is Equipment => SELECTABLE_EQUIPMENT.includes(e as Equipment)) : [];
  } catch {
    // A corrupt preference is not worth surfacing — fall back to "own nothing".
    return [];
  }
}

const CHIP_BASE = "rounded-full border px-3 py-1.5 text-xs transition-colors duration-150";
const CHIP_ON = "border-accent/40 bg-accent/10 text-accent";
const CHIP_OFF = "border-surface-raised text-muted hover:text-fg";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}>
      {children}
    </button>
  );
}

function PresetPicker({ onStart }: { onStart: (preset: Preset) => void }) {
  const [minutes, setMinutes] = useState<Duration | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>(loadEquipment);
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);

  function toggleEquipment(item: Equipment) {
    setEquipment((prev) => {
      const next = prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item];
      window.localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(next));
      return next;
    });
  }

  const matches = filterPresets({ minutes, equipment, bodyPart, condition });

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-muted">How long?</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={minutes === null} onClick={() => setMinutes(null)}>
            Any
          </Chip>
          {DURATIONS.map((d) => (
            <Chip key={d} on={minutes === d} onClick={() => setMinutes(d)}>
              {d} min
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-muted">
          What have you got?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SELECTABLE_EQUIPMENT.map((item) => (
            <Chip key={item} on={equipment.includes(item)} onClick={() => toggleEquipment(item)}>
              {EQUIPMENT_LABELS[item]}
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Bodyweight routines always show. Remembered for next time.</p>
      </div>

      <div>
        <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-muted">
          Sore or tight anywhere?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BODY_PARTS.map((part) => (
            <Chip
              key={part}
              on={bodyPart === part}
              onClick={() => setBodyPart((p) => (p === part ? null : part))}
            >
              {BODY_PART_LABELS[part]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-muted">Working on</p>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((c) => (
            <Chip key={c} on={condition === c} onClick={() => setCondition((v) => (v === c ? null : c))}>
              {CONDITION_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="border-t border-surface-raised pt-4">
        {matches.length === 0 ? (
          <p className="text-xs text-muted">Nothing matches all of that — try loosening a filter.</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  onClick={() => onStart(preset)}
                  className="w-full rounded-2xl border border-surface-raised bg-surface p-3.5 text-left transition-colors duration-200 hover:border-accent/40 active:scale-[0.98]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-bold text-fg">{preset.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-accent">
                      {Math.round(presetSeconds(preset) / 60)} min
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{preset.summary}</p>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                    {preset.exercises.length} moves ·{" "}
                    {preset.bodyParts.map((b) => BODY_PART_LABELS[b]).join(", ")}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
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
          <Chip key={tag} on={tags.has(tag)} onClick={() => toggleTag(tag)}>
            {tag}
          </Chip>
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
      {logMobility.isError && <p className="text-xs text-red-400">Failed to save — try again.</p>}
    </form>
  );
}

type Mode = "idle" | "picking" | "running" | "logging";

export default function Page() {
  const [mode, setMode] = useState<Mode>("idle");
  const [active, setActive] = useState<Preset | null>(null);
  const { data: history } = useMobilityHistory(14);
  const logMobility = useLogMobility();

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

  function finishPreset(elapsedSec: number) {
    if (!active) return;
    logMobility.mutate(
      {
        exercisesDone: active.exercises.map((e) => e.name),
        hipTightness: null,
        durationMin: Math.max(1, Math.round(elapsedSec / 60)),
        notes: active.name,
      },
      {
        onSuccess: () => {
          setActive(null);
          setMode("idle");
        },
      }
    );
  }

  return (
    <main className="animate-enter p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">Mobility</h1>
        {mode === "idle" && (
          <button onClick={() => setMode("logging")} className="font-mono text-[11px] text-accent">
            + Log manually
          </button>
        )}
      </div>

      {mode !== "running" && (
        <section className="mt-5 rounded-2xl bg-surface p-4">
          <WeekRing activeDays={weekActiveDays} totalDays={7} streakWeeks={0} />
        </section>
      )}

      {mode === "idle" && (
        <button
          onClick={() => setMode("picking")}
          className="mt-5 min-h-11 w-full rounded-xl bg-accent px-3 py-3 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98]"
        >
          Find a routine
        </button>
      )}

      {mode === "picking" && (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-fg">Find a routine</h2>
            <button onClick={() => setMode("idle")} className="font-mono text-[11px] text-muted hover:text-fg">
              Cancel
            </button>
          </div>
          <PresetPicker
            onStart={(preset) => {
              setActive(preset);
              setMode("running");
            }}
          />
        </section>
      )}

      {mode === "running" && active && (
        <section className="mt-5">
          <PresetPlayer
            preset={active}
            onFinish={finishPreset}
            onExit={() => {
              setActive(null);
              setMode("idle");
            }}
          />
        </section>
      )}

      {mode === "logging" && (
        <section className="mt-5">
          <LogForm onDone={() => setMode("idle")} />
        </section>
      )}

      {mode !== "running" && (
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent sessions</h2>
          {sessions.length > 0 ? (
            <RecentSessions sessions={sessions} gapLabel={null} />
          ) : (
            <p className="text-xs text-muted">No sessions logged yet.</p>
          )}
        </section>
      )}
    </main>
  );
}

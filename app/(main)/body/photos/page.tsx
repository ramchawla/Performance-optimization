"use client";

import { useState } from "react";
import { PhotoCompare } from "@/components/body/PhotoCompare";
import type { ProgressPhotoSession } from "@/lib/mock/bodyMock";
import { useBodyMetricsHistory, useLogBodyMetric, useProgressPhotos } from "@/lib/queries/body";
import { displayWeightKg, inputToKg } from "@/lib/units";

const WEIGHT_UNIT = "lb" as const; // profile-driven unit selection is out of scope for Phase 1

// ponytail: fixed viewBox, so a static dash length (longer than any path this
// data can produce) works for the draw-on animation without measuring the
// rendered path at runtime.

function toPolylinePoints(values: number[], width: number, height: number, padY = 6) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1 || 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = padY + (1 - (v - min) / range) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function WeightTrendChart({ points, deltaKg }: { points: number[]; deltaKg: number }) {
  const width = 320;
  const height = 96;
  const line = toPolylinePoints(points, width, height);
  const last = line.split(" ").at(-1)!;
  const [lastX, lastY] = last.split(",").map(Number);
  const fillPolygon = `0,${height} ${line} ${width},${height}`;
  const deltaDisplay = Math.round(displayWeightKg(deltaKg, WEIGHT_UNIT)! * 10) / 10;

  return (
    <div className="rounded-2xl bg-surface p-4 pt-4 pb-3">
      <div className="mb-2.5 flex justify-between font-mono text-[10px] tracking-wide text-muted uppercase">
        <span>Trend</span>
        <span>{deltaDisplay > 0 ? "+" : ""}{deltaDisplay} {WEIGHT_UNIT}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-24 w-full overflow-visible">
        <defs>
          <linearGradient id="weightFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon className="draw-fill" fill="url(#weightFade)" points={fillPolygon} />
        <polyline
          className="draw-path"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={line}
        />
        <circle className="draw-dot" cx={lastX} cy={lastY} r={5.5} fill="var(--accent)" />
      </svg>
    </div>
  );
}

function deltaClass(deltaCm: number) {
  if (deltaCm === 0) return "text-muted";
  return deltaCm < 0 ? "text-accent" : "text-[#ff8a7a]";
}

function deltaLabel(deltaCm: number) {
  if (deltaCm === 0) return "±0.0 cm";
  return `${deltaCm > 0 ? "+" : ""}${Math.round(deltaCm * 10) / 10} cm`;
}

const inputCls =
  "w-full rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none";

function LogMetricForm({ onDone }: { onDone: () => void }) {
  const logMetric = useLogBodyMetric();
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [neck, setNeck] = useState("");
  const [hip, setHip] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    logMetric.mutate(
      {
        weightKg: weight ? inputToKg(Number(weight), WEIGHT_UNIT) : null,
        waistCm: waist ? Number(waist) : null,
        neckCm: neck ? Number(neck) : null,
        hipCm: hip ? Number(hip) : null,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-enter space-y-2.5 rounded-2xl border border-surface-raised bg-surface p-3.5">
      <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">Log weigh-in</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Weight ({WEIGHT_UNIT})
          <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Waist (cm)
          <input type="number" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Neck (cm)
          <input type="number" step="0.1" value={neck} onChange={(e) => setNeck(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Hip (cm)
          <input type="number" step="0.1" value={hip} onChange={(e) => setHip(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={logMetric.isPending}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {logMetric.isPending ? "Saving…" : "Save"}
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
  const { data: history } = useBodyMetricsHistory(90);
  const { data: photos } = useProgressPhotos();

  const chronological = [...(history ?? [])].reverse();
  const weightPoints = chronological.filter((m) => m.weight_kg !== null).map((m) => m.weight_kg!);
  const latest = history?.[0];
  const oldestInWindow = chronological.find((m) => m.weight_kg !== null);
  const deltaKg = latest?.weight_kg && oldestInWindow?.weight_kg ? latest.weight_kg - oldestInWindow.weight_kg : 0;

  function measurementDelta(key: "waist_cm" | "neck_cm" | "hip_cm") {
    const withValue = (history ?? []).filter((m) => m[key] !== null);
    const current = withValue[0]?.[key] ?? null;
    const previous = withValue[1]?.[key] ?? null;
    return { current, delta: current !== null && previous !== null ? current - previous : 0 };
  }

  const measurements = [
    { key: "waist_cm" as const, label: "Waist" },
    { key: "neck_cm" as const, label: "Neck" },
    { key: "hip_cm" as const, label: "Hip" },
  ].map((m) => ({ ...m, ...measurementDelta(m.key) }));

  // progress_photos is one row per pose; group same-day rows into a "session"
  // for PhotoCompare, which compares session-to-session.
  const sessions: ProgressPhotoSession[] = Object.values(
    (photos ?? []).reduce<Record<string, ProgressPhotoSession>>((acc, p) => {
      const date = p.taken_at.slice(0, 10);
      if (!acc[date]) {
        acc[date] = {
          date,
          label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          weightKgAtTime: p.weight_kg_at_time ?? 0,
          poses: [],
        };
      }
      if (p.pose !== "other") acc[date].poses.push(p.pose);
      return acc;
    }, {})
  );

  return (
    <main className="p-4 pb-8">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-wide text-muted uppercase">
          Body {latest ? `· ${new Date(latest.measured_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </span>
        <button onClick={() => setLogging((v) => !v)} className="font-mono text-[11px] text-accent">
          {logging ? "Cancel" : "+ Log"}
        </button>
      </div>

      {logging && (
        <div className="mb-4">
          <LogMetricForm onDone={() => setLogging(false)} />
        </div>
      )}

      <div className="flex items-baseline gap-2 font-display text-6xl font-bold tracking-tight text-fg">
        {latest?.weight_kg ? Math.round(displayWeightKg(latest.weight_kg, WEIGHT_UNIT)! * 10) / 10 : "—"}
        <span className="text-xl font-medium text-muted">{WEIGHT_UNIT}</span>
      </div>

      {weightPoints.length > 1 && (
        <div className="mt-4">
          <WeightTrendChart points={weightPoints} deltaKg={deltaKg} />
        </div>
      )}

      <div className="mt-6 mb-3 flex items-center justify-between font-display text-lg font-bold">
        Measurements
      </div>
      <div className="grid grid-cols-2 gap-2">
        {measurements.map((m) => (
          <div key={m.key} className="rounded-xl bg-surface p-3 pb-2.5">
            <div className="font-mono text-[10px] tracking-wide text-muted uppercase">{m.label}</div>
            <div className="mt-1 font-display text-2xl font-bold tracking-tight text-fg">
              {m.current ?? "—"}
              <small className="text-xs font-medium text-muted"> cm</small>
            </div>
            <div className={`mt-1.5 font-mono text-[11px] font-bold ${deltaClass(m.delta)}`}>{deltaLabel(m.delta)}</div>
          </div>
        ))}
      </div>

      {sessions.length > 1 && (
        <>
          <div className="mt-6 mb-3 flex items-center justify-between font-display text-lg font-bold">
            Compare photos
            <span className="font-mono text-[9.5px] font-normal tracking-wide text-muted uppercase">drag to scrub</span>
          </div>
          <PhotoCompare sessions={sessions} />
        </>
      )}
    </main>
  );
}

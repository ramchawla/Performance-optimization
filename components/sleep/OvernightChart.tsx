"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

export interface OvernightSeries {
  key: string;
  label: string;
  unit: string;
  points: Array<{ t: number; v: number }>;
}

const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * One chart, a segmented control to pick the series — five stacked charts
 * would be most of a phone screen of near-identical axes.
 */
export function OvernightChart({ series }: { series: OvernightSeries[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const available = series.filter((s) => s.points.length > 1);
  const [selected, setSelected] = useState(available[0]?.key);
  const active = available.find((s) => s.key === selected) ?? available[0];
  if (!active) return null;

  const values = active.points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {available.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={s.key === active.key}
            onClick={() => setSelected(s.key)}
            className={`min-h-8 shrink-0 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
              s.key === active.key ? "bg-accent text-bg" : "bg-surface-raised text-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mb-1 flex gap-4 font-mono text-[11px] text-muted">
        <span>
          avg <span className="font-bold text-fg">{Math.round(avg)}</span>
        </span>
        <span>
          low <span className="text-fg">{Math.round(min)}</span>
        </span>
        <span>
          high <span className="text-fg">{Math.round(max)}</span>
        </span>
        <span>{active.unit}</span>
      </div>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={active.points} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <defs>
              <linearGradient id="overnightFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={clock}
              tick={{ fontSize: 9, fill: "var(--muted)" }}
              tickCount={4}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={["dataMin - 3", "dataMax + 3"]}
              tick={{ fontSize: 9, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(t) => clock(Number(t))}
              formatter={(v) => [`${Math.round(Number(v))} ${active.unit}`, active.label]}
              contentStyle={{ background: "var(--surface-raised)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--muted)" }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--accent)"
              strokeWidth={1.75}
              fill="url(#overnightFill)"
              isAnimationActive={!reducedMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

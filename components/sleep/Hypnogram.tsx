import type { Segment, Stage } from "@/lib/calc/sleep";

// Top-to-bottom lane order is the convention every sleep app uses: awake on
// top, deepest sleep at the bottom, so a dip reads as "going deeper".
const LANES: Stage[] = ["awake", "rem", "light", "deep"];

export const STAGE_STYLE: Record<Stage, { label: string; color: string }> = {
  awake: { label: "Awake", color: "#fbbf24" },
  rem: { label: "REM", color: "#7dd3fc" },
  light: { label: "Light", color: "var(--accent-dim)" },
  deep: { label: "Deep", color: "var(--accent)" },
};

interface HypnogramProps {
  segments: Segment[];
  startLabel: string | null;
  endLabel: string | null;
}

export function Hypnogram({ segments, startLabel, endLabel }: HypnogramProps) {
  const total = segments.length ? segments[segments.length - 1].endMin : 0;
  if (total <= 0) return null;

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-0.5 text-[9px] uppercase tracking-wide text-muted">
          {LANES.map((l) => (
            <span key={l} className="h-3 leading-3">
              {STAGE_STYLE[l].label}
            </span>
          ))}
        </div>
        <div
          className="relative h-[72px] flex-1 overflow-hidden rounded-lg bg-bg/60"
          role="img"
          aria-label={`Sleep stages over ${Math.round(total / 60)} hours`}
        >
          {segments.map((s, i) => (
            <div
              key={i}
              className="absolute h-3 rounded-[3px]"
              style={{
                left: `${(s.startMin / total) * 100}%`,
                width: `max(1px, ${((s.endMin - s.startMin) / total) * 100}%)`,
                top: `${LANES.indexOf(s.stage) * 18 + 2}px`,
                background: STAGE_STYLE[s.stage].color,
              }}
            />
          ))}
        </div>
      </div>
      {(startLabel || endLabel) && (
        <div className="mt-1 flex justify-between pl-11 font-mono text-[10px] text-muted">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}

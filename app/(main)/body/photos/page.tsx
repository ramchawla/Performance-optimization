import { PhotoCompare } from "@/components/body/PhotoCompare";
import { MOCK_BODY, type MeasurementTrendPoint, type WeightTrendPoint } from "@/lib/mock/bodyMock";

// ponytail: fixed viewBox, so a static dash length (longer than any path this
// data can produce) works for the draw-on animation without measuring the
// rendered path at runtime.

function toPolylinePoints(values: number[], width: number, height: number, padY = 6) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = padY + (1 - (v - min) / range) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function WeightTrendChart({ points, deltaKg }: { points: WeightTrendPoint[]; deltaKg: number }) {
  const width = 320;
  const height = 96;
  const line = toPolylinePoints(
    points.map((p) => p.weightKg),
    width,
    height,
  );
  const last = line.split(" ").at(-1)!;
  const [lastX, lastY] = last.split(",").map(Number);
  const fillPolygon = `0,${height} ${line} ${width},${height}`;

  return (
    <div className="rounded-2xl bg-surface p-4 pt-4 pb-3">
      <div className="mb-2.5 flex justify-between font-mono text-[10px] tracking-wide text-muted uppercase">
        <span>90-day trend</span>
        <span>{deltaKg > 0 ? "+" : ""}{deltaKg} kg</span>
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

function MiniTrend({ trend }: { trend: MeasurementTrendPoint[] }) {
  const points = toPolylinePoints(
    trend.map((p) => p.valueCm),
    300,
    32,
    4,
  );
  return (
    <svg viewBox="0 0 300 32" preserveAspectRatio="none" className="mt-2 block h-8 w-full">
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.8}
      />
    </svg>
  );
}

function deltaClass(deltaCm: number) {
  if (deltaCm === 0) return "text-muted";
  return deltaCm < 0 ? "text-accent" : "text-[#ff8a7a]";
}

function deltaLabel(deltaCm: number) {
  if (deltaCm === 0) return "±0.0 cm";
  return `${deltaCm > 0 ? "+" : ""}${deltaCm} cm`;
}

export default function Page() {
  const { current, streakWeeks, weightTrend90d, measurements, photoSessions } = MOCK_BODY;

  return (
    <main className="p-4 pb-8">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-wide text-muted uppercase">
          Body · {new Date(current.asOf).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        <span className="fade-in-delayed font-mono text-[11px] text-accent">{streakWeeks}-week streak</span>
      </div>

      <div className="flex items-baseline gap-2 font-display text-6xl font-bold tracking-tight text-fg">
        {current.weightKg}
        <span className="text-xl font-medium text-muted">kg</span>
      </div>

      <div className="mt-4">
        <WeightTrendChart points={weightTrend90d} deltaKg={current.deltaKg} />
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between font-display text-lg font-bold">
        Measurements
        <span className="font-mono text-[9.5px] font-normal tracking-wide text-muted uppercase">tap a card</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {measurements.map((m, i) => (
          <div
            key={m.key}
            tabIndex={0}
            className={`rounded-xl bg-surface p-3 pb-2.5 transition-transform active:scale-[0.97] ${
              m.trend ? "col-span-2" : ""
            }`}
          >
            <div className="font-mono text-[10px] tracking-wide text-muted uppercase">
              {m.label}
              {m.trend ? ` — ${m.deltaDays} day trend` : ""}
            </div>
            <div className="mt-1 font-display text-2xl font-bold tracking-tight text-fg">
              {m.currentCm}
              <small className="text-xs font-medium text-muted"> cm</small>
            </div>
            {m.trend ? (
              <MiniTrend trend={m.trend} />
            ) : (
              <div
                className={`rise-in-delayed mt-1.5 font-mono text-[11px] font-bold ${deltaClass(m.deltaCm)}`}
                style={{ animationDelay: `${1.7 + i * 0.1}s` }}
              >
                {deltaLabel(m.deltaCm)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between font-display text-lg font-bold">
        Compare photos
        <span className="font-mono text-[9.5px] font-normal tracking-wide text-muted uppercase">drag to scrub</span>
      </div>
      <PhotoCompare sessions={photoSessions} />
    </main>
  );
}

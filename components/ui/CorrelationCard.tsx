interface CorrelationCardProps {
  title: string;
  xLabel: string;
  yLabel: string;
  r: number;
  n: number;
  strength: "weak" | "moderate" | "strong";
}

export function CorrelationCard({ title, xLabel, yLabel, r, n, strength }: CorrelationCardProps) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-sm text-fg">{title}</p>
      <p className="mt-1 font-mono text-[10px] text-muted">
        {xLabel} vs. {yLabel}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-xl font-bold text-fg">
          {r > 0 ? "+" : ""}
          {r.toFixed(2)}
        </span>
        <span className="text-xs text-muted">{strength}</span>
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted">correlation, not causation — n={n}</p>
    </div>
  );
}

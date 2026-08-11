interface CorrelationCardProps {
  title: string;
  xLabel: string;
  yLabel: string;
  r: number;
  n: number;
  strength: "weak" | "moderate" | "strong";
}

export function CorrelationCard({ title, xLabel, yLabel, r, n, strength }: CorrelationCardProps) {
  const magnitudePct = Math.min(100, Math.abs(r) * 100);
  return (
    <div className="animate-enter rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.98]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tracking-tight tabular-nums text-fg">
          r = {r > 0 ? "+" : ""}
          {r.toFixed(2)}
        </span>
        <span className="text-xs text-muted">{strength}</span>
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted">
        {xLabel} vs. {yLabel} · correlation, not causation · n={n}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${magnitudePct}%`, backgroundImage: "linear-gradient(90deg, var(--accent-dim), var(--accent))" }}
        />
      </div>
    </div>
  );
}

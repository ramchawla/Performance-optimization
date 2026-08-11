interface ProgressBarProps {
  label: string;
  current: number;
  target: number | null;
  unit: string;
}

export function ProgressBar({ label, current, target, unit }: ProgressBarProps) {
  const pct = target && target > 0 ? Math.min(1, current / target) : 0;
  const complete = pct >= 1;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-sm tabular-nums text-fg">
          {Math.round(current)}
          {target !== null ? ` / ${target}` : ""} {unit}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            complete ? "shadow-[0_0_10px_-2px_var(--accent)]" : ""
          }`}
          style={{
            width: `${pct * 100}%`,
            backgroundImage: "linear-gradient(90deg, var(--accent-dim), var(--accent))",
          }}
        />
      </div>
    </div>
  );
}

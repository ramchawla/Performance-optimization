interface ProgressBarProps {
  label: string;
  current: number;
  target: number | null;
  unit: string;
}

export function ProgressBar({ label, current, target, unit }: ProgressBarProps) {
  const pct = target && target > 0 ? Math.min(1, current / target) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="font-mono text-sm text-fg">
          {Math.round(current)}
          {target !== null ? ` / ${target}` : ""} {unit}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

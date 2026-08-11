import { useId, type CSSProperties, type ReactNode } from "react";

interface RadialProgressProps {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  className?: string;
}

/** Ring draws itself in via the `.ring-draw` stroke-dashoffset animation (globals.css). */
export function RadialProgress({ value, size = 72, strokeWidth = 6, children, className = "" }: RadialProgressProps) {
  const gradientId = useId();
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const pct = Math.max(0, Math.min(1, value));
  const offset = 1 - pct;

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-dim)" />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-white/10" />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
          stroke={`url(#${gradientId})`}
          className="ring-draw"
          style={{ "--ring-offset": offset } as CSSProperties}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}

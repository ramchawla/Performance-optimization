import { LineChart, Line, ResponsiveContainer } from "recharts";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface RecompTileProps {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  favorable: boolean;
  /** Needs attention — renders amber instead of the neutral/favorable treatment. */
  watch?: boolean;
  sparkline: number[];
  wide?: boolean;
}

const ARROW: Record<RecompTileProps["trend"], string> = { up: "↗", down: "↘", flat: "→" };

export function RecompTile({ label, value, trend, favorable, watch = false, sparkline, wide = false }: RecompTileProps) {
  const reducedMotion = usePrefersReducedMotion();
  const data = sparkline.map((v, i) => ({ i, v }));
  const lineColor = favorable ? "var(--accent)" : watch ? "#fbbf24" : "var(--muted)";

  return (
    <div
      className={`animate-enter relative overflow-hidden rounded-2xl border p-3 backdrop-blur-xl transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] active:duration-150 ${
        favorable
          ? "border-accent/40 bg-accent/[0.07] shadow-[0_0_20px_-10px_var(--accent)] hover:shadow-[0_12px_28px_-14px_var(--accent)]"
          : watch
            ? "border-amber-400/30 bg-amber-400/[0.05]"
            : "border-white/10 bg-white/[0.04]"
      } ${wide ? "col-span-2" : ""}`}
    >
      {data.length > 1 && (
        <div className="absolute inset-0 opacity-25">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive={!reducedMotion} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p
          className={`font-display font-bold tracking-tight tabular-nums ${wide ? "text-3xl" : "text-2xl"} ${
            favorable ? "text-accent" : watch ? "text-amber-300" : "text-fg"
          }`}
        >
          {ARROW[trend]} {value}
        </p>
      </div>
    </div>
  );
}

import { ComposedChart, Line, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface WeightTrendChartProps {
  data: Array<{ date: string; rawKg: number | null; emaKg: number }>;
}

export function WeightTrendChart({ data }: WeightTrendChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const lastIndex = data.length - 1;

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="weightTrendGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent-dim)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "var(--muted)" }}
            tickFormatter={(d: string) => d.slice(5)}
            interval={14}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 9, fill: "var(--muted)" }} domain={["dataMin - 1", "dataMax + 1"]} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--surface-raised)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted)" }}
          />
          <Scatter dataKey="rawKg" fill="var(--muted)" opacity={0.35} isAnimationActive={!reducedMotion} />
          <Line
            type="monotone"
            dataKey="emaKg"
            stroke="url(#weightTrendGradient)"
            strokeWidth={2.5}
            isAnimationActive={!reducedMotion}
            animationDuration={1100}
            animationEasing="ease-out"
            dot={(dotProps: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = dotProps;
              if (cx === undefined || cy === undefined || index !== lastIndex) {
                return <circle key={index} cx={cx ?? 0} cy={cy ?? 0} r={0} fill="none" />;
              }
              return <circle key={index} cx={cx} cy={cy} r={4} fill="var(--accent)" className="pulse-dot" />;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

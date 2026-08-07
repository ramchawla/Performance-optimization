import { ComposedChart, Line, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface WeightTrendChartProps {
  data: Array<{ date: string; rawKg: number | null; emaKg: number }>;
}

export function WeightTrendChart({ data }: WeightTrendChartProps) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
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
            contentStyle={{ background: "var(--surface-raised)", border: "none", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted)" }}
          />
          <Scatter dataKey="rawKg" fill="var(--muted)" opacity={0.4} />
          <Line type="monotone" dataKey="emaKg" stroke="var(--accent)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

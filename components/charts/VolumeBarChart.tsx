import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface VolumeBarChartProps {
  data: Array<{ weekLabel: string; volumeKg: number }>;
}

export function VolumeBarChart({ data }: VolumeBarChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const lastIndex = data.length - 1;

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="volumeBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-dim)" />
            </linearGradient>
          </defs>
          <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--surface-raised)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(value) => [`${Number(value).toLocaleString()} kg`, "volume"]}
          />
          <Bar dataKey="volumeKg" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} animationEasing="ease-out">
            {data.map((entry, i) => (
              <Cell key={entry.weekLabel} fill={i === lastIndex ? "var(--accent)" : "url(#volumeBarGradient)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

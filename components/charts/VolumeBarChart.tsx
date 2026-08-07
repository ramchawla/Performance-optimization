import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface VolumeBarChartProps {
  data: Array<{ weekLabel: string; volumeKg: number }>;
}

export function VolumeBarChart({ data }: VolumeBarChartProps) {
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "var(--surface-raised)", border: "none", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(value) => [`${Number(value).toLocaleString()} kg`, "volume"]}
          />
          <Bar dataKey="volumeKg" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

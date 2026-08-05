import { LineChart, Line, ResponsiveContainer } from "recharts";

interface RecompTileProps {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  favorable: boolean;
  sparkline: number[];
}

const ARROW: Record<RecompTileProps["trend"], string> = { up: "↗", down: "↘", flat: "→" };

export function RecompTile({ label, value, trend, favorable, sparkline }: RecompTileProps) {
  const data = sparkline.map((v, i) => ({ i, v }));
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface p-3 ${
        favorable ? "ring-1 ring-accent shadow-[0_0_16px_-4px_var(--accent)]" : ""
      }`}
    >
      {data.length > 1 && (
        <div className="absolute inset-0 opacity-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={favorable ? "var(--accent)" : "var(--muted)"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative">
        <p className="text-xs text-muted">{label}</p>
        <p className="font-display text-2xl font-bold text-fg">
          {ARROW[trend]} {value}
        </p>
      </div>
    </div>
  );
}

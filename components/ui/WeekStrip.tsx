interface WeekStripProps {
  days: Array<{ date: string; trained: boolean }>;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function WeekStrip({ days }: WeekStripProps) {
  return (
    <div className="flex justify-between">
      {days.map((d) => {
        const dow = DOW[new Date(d.date + "T00:00:00Z").getUTCDay()];
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted">{dow}</span>
            <span
              className={`h-3 w-3 rounded-full ${d.trained ? "bg-accent" : "bg-surface-raised"}`}
            />
          </div>
        );
      })}
    </div>
  );
}

interface SleepConsistencyStripProps {
  nights: Array<{ date: string; bedtimeDeviationMin: number }>;
}

/** Dot per night; opacity/size/color track how far bedtime drifted from average — not a pass/fail color. */
export function SleepConsistencyStrip({ nights }: SleepConsistencyStripProps) {
  const maxDeviation = Math.max(...nights.map((n) => Math.abs(n.bedtimeDeviationMin)), 1);

  return (
    <div className="flex items-end justify-between gap-1">
      {nights.map((n) => {
        const magnitude = Math.abs(n.bedtimeDeviationMin) / maxDeviation;
        const size = 8 + magnitude * 12;
        const tight = magnitude < 0.34;
        return (
          <div key={n.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`rounded-full transition-[width,height] duration-300 ${tight ? "bg-accent" : "bg-amber-400"}`}
              style={{
                width: size,
                height: size,
                opacity: 0.35 + (1 - magnitude) * 0.65,
                boxShadow: tight ? "0 0 8px -1px var(--accent)" : undefined,
              }}
              title={`${n.date}: ${n.bedtimeDeviationMin > 0 ? "+" : ""}${n.bedtimeDeviationMin} min from average bedtime`}
            />
          </div>
        );
      })}
    </div>
  );
}

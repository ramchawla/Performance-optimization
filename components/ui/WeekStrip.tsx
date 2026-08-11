interface WeekStripProps {
  days: Array<{ date: string; trained: boolean }>;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekpills — a wider, gym-glanceable swap for the old 3px training dots. */
export function WeekStrip({ days }: WeekStripProps) {
  return (
    <div className="stagger flex gap-1.5">
      {days.map((d) => {
        const dow = DOW[new Date(d.date + "T00:00:00Z").getUTCDay()];
        return (
          <div
            key={d.date}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[11px] font-bold transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 ${
              d.trained
                ? "text-bg shadow-[0_0_16px_-4px_var(--accent)]"
                : "border border-white/10 bg-white/[0.04] text-muted"
            }`}
            style={
              d.trained ? { backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-dim))" } : undefined
            }
          >
            <span>{dow}</span>
          </div>
        );
      })}
    </div>
  );
}

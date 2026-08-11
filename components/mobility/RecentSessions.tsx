export interface RecentSessionItem {
  id: string;
  routineName: string;
  durationLabel: string; // e.g. "8 min" or "0m 42s" for a just-logged session
  daysAgo: number | null; // null = just logged this session
  skippedStretch: boolean;
  isNew: boolean;
}

interface RecentSessionsProps {
  sessions: RecentSessionItem[];
  gapLabel: string | null;
}

function dayLabel(daysAgo: number | null): string {
  if (daysAgo === null) return "Just now";
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return `${daysAgo} days ago`;
}

export function RecentSessions({ sessions, gapLabel }: RecentSessionsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((s) => (
        <li
          key={s.id}
          className={`flex items-center gap-2.5 rounded-xl border border-surface-raised bg-bg px-3.5 py-2.5 text-xs ${
            s.isNew ? "animate-mobility-slide-in" : ""
          }`}
        >
          <span className="w-16 shrink-0 font-mono text-accent">{dayLabel(s.daysAgo)}</span>
          <span className="min-w-0 flex-1 truncate text-fg">
            {s.routineName}
            {s.skippedStretch && <span className="ml-1.5 text-[10.5px] italic text-muted">skipped 1</span>}
          </span>
          <span className="shrink-0 font-mono text-muted">{s.durationLabel}</span>
        </li>
      ))}
      {gapLabel && (
        <li className="flex items-center gap-2.5 rounded-xl border border-surface-raised bg-bg px-3.5 py-2.5 text-xs italic opacity-50">
          <span className="w-16 shrink-0 font-mono text-accent">{gapLabel}</span>
          <span className="flex-1 text-fg">No session logged</span>
        </li>
      )}
    </ul>
  );
}

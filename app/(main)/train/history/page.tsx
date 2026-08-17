"use client";

import { TrainSubnav } from "@/components/train/TrainSubnav";
import Link from "next/link";
import { useSessionHistory } from "@/lib/queries/sessions";
import { displayWeightKg } from "@/lib/units";

export default function HistoryPage() {
  const { data: sessions, isLoading } = useSessionHistory();

  return (
    <main className="space-y-4 p-4 pb-24">
      <TrainSubnav />
      <h1 className="font-display text-xl font-bold tracking-tight text-fg">History</h1>

      {isLoading && (
        <ul className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-2xl bg-surface-raised" />
          ))}
        </ul>
      )}

      <ul className="stagger space-y-2.5">
        {sessions?.map((s) => (
          <li key={s.id}>
            <Link
              href={`/train/history/${s.id}`}
              className="flex items-center justify-between rounded-2xl bg-surface p-3.5 transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:bg-surface-raised active:scale-[0.98]"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-fg">{s.template_name_snapshot ?? "Workout"}</div>
                <div className="font-mono text-xs text-muted">
                  {new Date(s.started_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                {s.is_deload && (
                  <span className="mt-1.5 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-black">
                    Deload
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-mono text-sm font-bold tabular-nums text-accent">
                  {Math.round(displayWeightKg(s.volumeKg, "lb") ?? 0).toLocaleString()} lb
                </div>
                <div className="font-mono text-xs text-muted">{s.durationMin} min</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {sessions?.length === 0 && !isLoading && (
        <p className="text-sm text-muted">No completed sessions yet.</p>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useSessionHistory } from "@/lib/queries/sessions";

export default function HistoryPage() {
  const { data: sessions, isLoading } = useSessionHistory();

  return (
    <main className="space-y-4 p-4">
      <h1 className="font-display text-xl font-bold text-fg">History</h1>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <ul className="space-y-2">
        {sessions?.map((s) => (
          <li key={s.id}>
            <Link
              href={`/train/history/${s.id}`}
              className="flex items-center justify-between rounded-2xl bg-surface p-3"
            >
              <div>
                <div className="text-sm font-medium text-fg">{s.template_name_snapshot ?? "Workout"}</div>
                <div className="font-mono text-xs text-muted">
                  {new Date(s.started_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              {s.is_deload && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  Deload
                </span>
              )}
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

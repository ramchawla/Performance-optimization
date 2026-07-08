"use client";

import Link from "next/link";
import { useSessionHistory } from "@/lib/queries/sessions";

export default function HistoryPage() {
  const { data: sessions, isLoading } = useSessionHistory();

  return (
    <main className="p-4 pb-24">
      <h1 className="text-xl font-semibold">History</h1>

      {isLoading && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}

      <ul className="mt-4 space-y-2">
        {sessions?.map((s) => (
          <li key={s.id}>
            <Link
              href={`/train/history/${s.id}`}
              className="flex items-center justify-between rounded border border-neutral-200 p-3"
            >
              <div>
                <div className="text-sm font-medium">{s.template_name_snapshot ?? "Workout"}</div>
                <div className="text-xs text-neutral-500">
                  {new Date(s.started_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              {s.is_deload && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  Deload
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {sessions?.length === 0 && !isLoading && (
        <p className="mt-4 text-sm text-neutral-500">No completed sessions yet.</p>
      )}
    </main>
  );
}

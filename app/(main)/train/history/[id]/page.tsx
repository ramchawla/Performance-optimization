"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatWeightKg } from "@/lib/units";
import { MOCK_HISTORY, MOCK_HISTORY_DETAILS } from "@/lib/mock/trainMock";

// ponytail: rendering MOCK_HISTORY_DETAILS directly instead of
// useSessionDetail(id) — no seed data locally, this is a visual preview.
// Swap back to useSessionDetail(id) once workout sessions are seeded in the
// real DB.
export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = MOCK_HISTORY_DETAILS[id] ?? MOCK_HISTORY_DETAILS[MOCK_HISTORY[0].id];

  const { session, exercises } = data;

  return (
    <main className="space-y-4 p-4">
      <Link href="/train/history" className="inline-block text-xs text-muted transition-colors hover:text-fg">
        ← History
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold tracking-tight text-fg">{session.template_name_snapshot ?? "Workout"}</h1>
        {session.is_deload && (
          <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-black">Deload</span>
        )}
      </div>
      <p className="font-mono text-xs text-muted">
        {new Date(session.started_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </p>

      <div className="stagger space-y-3">
        {exercises.map((ex) => (
          <section key={ex.id} className="rounded-2xl bg-surface p-3.5">
            <h2 className="text-sm font-bold text-fg">{ex.exerciseName}</h2>
            <p className="text-xs text-muted">
              Target: {ex.targetSets ?? "—"} × {ex.targetRepsMin ?? "?"}–{ex.targetRepsMax ?? "?"}
              {ex.targetWeightKg !== null ? ` @ ${formatWeightKg(ex.targetWeightKg, "lb")}` : ""}
              {ex.targetRpe !== null ? ` RPE ${ex.targetRpe}` : ""}
            </p>
            <ul className="mt-2 space-y-1.5">
              {ex.sets.map((s) => (
                <li key={s.setNumber} className="flex items-center gap-2 rounded-lg bg-surface-raised px-2.5 py-1.5 text-sm text-fg">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg">
                    {s.isWarmup ? "W" : s.setNumber}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatWeightKg(s.actualWeightKg, "lb")} × {s.actualReps ?? "—"}
                    {s.actualRpe !== null ? ` @ RPE ${s.actualRpe}` : ""}
                  </span>
                </li>
              ))}
              {ex.sets.length === 0 && <li className="text-xs text-muted">No sets logged.</li>}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

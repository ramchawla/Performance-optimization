"use client";

import { useParams } from "next/navigation";
import { useSessionDetail } from "@/lib/queries/sessions";
import { formatWeightKg } from "@/lib/units";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useSessionDetail(id);

  if (isLoading || !data) {
    return (
      <main className="p-4">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const { session, exercises } = data;

  return (
    <main className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-fg">{session.template_name_snapshot ?? "Workout"}</h1>
        {session.is_deload && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">Deload</span>
        )}
      </div>
      <p className="font-mono text-xs text-muted">
        {new Date(session.started_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </p>

      <div className="space-y-4">
        {exercises.map((ex) => (
          <section key={ex.id} className="rounded-2xl bg-surface p-3">
            <h2 className="text-sm font-semibold text-fg">{ex.exerciseName}</h2>
            <p className="text-xs text-muted">
              Target: {ex.targetSets ?? "—"} x {ex.targetRepsMin ?? "?"}–{ex.targetRepsMax ?? "?"}
              {ex.targetWeightKg !== null ? ` @ ${formatWeightKg(ex.targetWeightKg, "lb")}` : ""}
              {ex.targetRpe !== null ? ` RPE ${ex.targetRpe}` : ""}
            </p>
            <ul className="mt-2 space-y-1">
              {ex.sets.map((s) => (
                <li key={s.setNumber} className="flex items-center gap-2 text-sm text-fg">
                  <span className="w-5 text-xs text-muted">{s.isWarmup ? "W" : s.setNumber}</span>
                  <span>
                    {s.actualReps ?? "—"} x {formatWeightKg(s.actualWeightKg, "lb")}
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

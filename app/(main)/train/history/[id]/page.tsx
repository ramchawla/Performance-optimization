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
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  const { session, exercises } = data;

  return (
    <main className="p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{session.template_name_snapshot ?? "Workout"}</h1>
        {session.is_deload && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Deload</span>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        {new Date(session.started_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </p>

      <div className="mt-4 space-y-4">
        {exercises.map((ex) => (
          <section key={ex.id} className="rounded border border-neutral-200 p-3">
            <h2 className="text-sm font-semibold">{ex.exerciseName}</h2>
            <p className="text-xs text-neutral-500">
              Target: {ex.targetSets ?? "—"} x {ex.targetRepsMin ?? "?"}–{ex.targetRepsMax ?? "?"}
              {ex.targetWeightKg !== null ? ` @ ${formatWeightKg(ex.targetWeightKg, "lb")}` : ""}
              {ex.targetRpe !== null ? ` RPE ${ex.targetRpe}` : ""}
            </p>
            <ul className="mt-2 space-y-1">
              {ex.sets.map((s) => (
                <li key={s.setNumber} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-xs text-neutral-400">{s.isWarmup ? "W" : s.setNumber}</span>
                  <span>
                    {s.actualReps ?? "—"} x {formatWeightKg(s.actualWeightKg, "lb")}
                    {s.actualRpe !== null ? ` @ RPE ${s.actualRpe}` : ""}
                  </span>
                </li>
              ))}
              {ex.sets.length === 0 && <li className="text-xs text-neutral-400">No sets logged.</li>}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

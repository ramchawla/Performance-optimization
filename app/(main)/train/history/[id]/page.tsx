"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatWeightKg } from "@/lib/units";
import { useSessionDetail, useUpdateSessionTimes } from "@/lib/queries/sessions";
import { localDateOf, toTimeInput } from "@/lib/datetime";
import { useState } from "react";
import type { Database } from "@/lib/database.types";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useSessionDetail(id);

  if (isLoading) {
    return (
      <main className="space-y-4 p-4">
        <div className="h-6 w-24 animate-pulse rounded bg-surface-raised" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface-raised" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="space-y-4 p-4">
        <Link href="/train/history" className="inline-block text-xs text-muted transition-colors hover:text-fg">
          ← History
        </Link>
        <p className="text-sm text-muted">Session not found.</p>
      </main>
    );
  }

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
      <SessionTimeEditor session={session} />

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

/**
 * A session stamps started_at when you tap start, which is wrong for anything
 * logged after the fact. This is how a workout gets moved to the day and time
 * it actually happened.
 */
function SessionTimeEditor({ session }: { session: Database["public"]["Tables"]["workout_sessions"]["Row"] }) {
  const update = useUpdateSessionTimes();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(() => localDateOf(session.started_at));
  const [time, setTime] = useState(() => toTimeInput(session.started_at));
  const [durationMin, setDurationMin] = useState(() =>
    session.completed_at
      ? String(
          Math.round(
            (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000
          )
        )
      : ""
  );

  if (!editing) {
    return (
      <p className="font-mono text-xs text-muted">
        {new Date(session.started_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        <button onClick={() => setEditing(true)} className="ml-2 text-accent">
          edit
        </button>
      </p>
    );
  }

  const fieldCls =
    "rounded-lg border border-surface-raised bg-bg px-2 py-1.5 font-mono text-xs text-fg focus-visible:border-accent focus-visible:outline-none";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(
          { sessionId: session.id, date, time, durationMin: durationMin ? Number(durationMin) : null },
          { onSuccess: () => setEditing(false) }
        );
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Session date" className={fieldCls} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" className={fieldCls} />
      <input
        type="number"
        min="0"
        value={durationMin}
        onChange={(e) => setDurationMin(e.target.value)}
        aria-label="Duration in minutes"
        placeholder="min"
        className={`${fieldCls} w-20 placeholder:text-muted`}
      />
      <button type="submit" disabled={update.isPending} className="text-xs font-semibold text-accent disabled:opacity-50">
        {update.isPending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted">
        Cancel
      </button>
      {update.isError && <span className="text-xs text-red-400">Failed to save.</span>}
    </form>
  );
}

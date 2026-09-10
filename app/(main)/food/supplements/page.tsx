"use client";

import { useState } from "react";
import { FoodSubnav } from "@/components/food/FoodSubnav";
import { formatDate, formatTime, shiftDate, todayLocal } from "@/lib/datetime";
import {
  DOSE_UNITS,
  FORMS,
  TIMING_LABELS,
  TIMING_RULES,
  useCreateSupplement,
  useDeleteIntake,
  useLogSupplementIntake,
  useSetSupplementActive,
  useSupplementAdherence,
  useSupplementIntakes,
  useSupplements,
  useUpdateSupplement,
  type Supplement,
  type SupplementIntake,
  type SupplementInput,
} from "@/lib/queries/supplements";

const FIELD =
  "w-full rounded-xl border border-surface-raised bg-bg px-3 py-2 font-mono text-sm text-fg placeholder:text-muted focus-visible:border-accent focus-visible:outline-none";
const LABEL = "mb-1 block text-[11px] uppercase tracking-wide text-muted";

function doseLabel(s: Pick<Supplement, "dose_amount" | "dose_unit">): string {
  if (s.dose_amount === null) return "";
  return `${Number(s.dose_amount)}${s.dose_unit ? ` ${s.dose_unit}` : ""}`;
}

function SupplementForm({
  initial,
  title,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Supplement;
  title: string;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (input: SupplementInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [form, setForm] = useState(initial?.form ?? "");
  const [doseAmount, setDoseAmount] = useState(initial?.dose_amount !== null && initial?.dose_amount !== undefined ? String(initial.dose_amount) : "");
  const [doseUnit, setDoseUnit] = useState(initial?.dose_unit ?? "mg");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [timingRule, setTimingRule] = useState(initial?.timing_rule ?? "any");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      brand: brand.trim() || null,
      form: form || null,
      doseAmount: doseAmount ? Number(doseAmount) : null,
      doseUnit: doseUnit || null,
      purpose: purpose.trim() || null,
      timingRule,
    });
  }

  return (
    <form onSubmit={submit} className="animate-enter space-y-2.5 rounded-2xl border border-surface-raised bg-surface p-3.5">
      <p className="font-display text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Creatine)" className={FIELD} />
      <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" className={FIELD} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="s-dose" className={LABEL}>
            Dose
          </label>
          <input
            id="s-dose"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={doseAmount}
            onChange={(e) => setDoseAmount(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="s-unit" className={LABEL}>
            Unit
          </label>
          <select id="s-unit" value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)} className={FIELD}>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="s-form" className={LABEL}>
            Form
          </label>
          <select id="s-form" value={form} onChange={(e) => setForm(e.target.value)} className={FIELD}>
            <option value="">—</option>
            {FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-timing" className={LABEL}>
            Timing
          </label>
          <select id="s-timing" value={timingRule} onChange={(e) => setTimingRule(e.target.value)} className={FIELD}>
            {TIMING_RULES.map((t) => (
              <option key={t} value={t}>
                {TIMING_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        placeholder="Why you take it (optional)"
        className={FIELD}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 rounded-xl bg-accent px-3 py-2 font-display text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl border border-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-200 hover:bg-surface-raised"
        >
          Cancel
        </button>
      </div>
      {error !== null && error !== undefined && (
        <p className="text-xs text-red-400">{error instanceof Error ? error.message : "Failed to save."}</p>
      )}
    </form>
  );
}

export default function SupplementsPage() {
  const [logDate, setLogDate] = useState(todayLocal);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: supplements } = useSupplements(managing);
  const { data: intakes } = useSupplementIntakes(logDate);
  const { data: adherence } = useSupplementAdherence(30);
  const logIntake = useLogSupplementIntake();
  const deleteIntake = useDeleteIntake();
  const setActive = useSetSupplementActive();
  const create = useCreateSupplement();
  const update = useUpdateSupplement();

  const takenBySupplement = new Map<string, SupplementIntake>();
  for (const intake of intakes ?? []) {
    if (!intake.skipped) takenBySupplement.set(intake.supplement_id, intake);
  }

  return (
    <main className="min-h-screen bg-bg p-4 pb-24">
      <FoodSubnav />

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setLogDate((d) => shiftDate(d, -1))}
          aria-label="Previous day"
          className="min-h-11 min-w-11 rounded-xl px-2 text-lg text-fg transition-colors duration-200 hover:bg-surface-raised"
        >
          ‹
        </button>
        <h1 className="font-display text-lg font-bold text-fg">
          {logDate === todayLocal() ? "Today" : formatDate(logDate)}
        </h1>
        <button
          onClick={() => setLogDate((d) => shiftDate(d, 1))}
          aria-label="Next day"
          className="min-h-11 min-w-11 rounded-xl px-2 text-lg text-fg transition-colors duration-200 hover:bg-surface-raised"
        >
          ›
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Stack</h2>
        <div className="flex gap-3">
          <button onClick={() => setManaging((v) => !v)} className="font-mono text-[11px] text-muted hover:text-fg">
            {managing ? "Hide retired" : "Show retired"}
          </button>
          <button onClick={() => setAdding((v) => !v)} className="font-mono text-[11px] text-accent">
            {adding ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      {adding && (
        <div className="mt-2">
          <SupplementForm
            title="Add to stack"
            submitLabel="Add"
            pending={create.isPending}
            error={create.error}
            onSubmit={(input) => create.mutate(input, { onSuccess: () => setAdding(false) })}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <ul className="mt-2 space-y-2">
        {(supplements ?? []).map((s) => {
          const taken = takenBySupplement.get(s.id);
          const pct = adherence?.[s.id];

          if (editingId === s.id) {
            return (
              <li key={s.id}>
                <SupplementForm
                  initial={s}
                  title="Edit supplement"
                  submitLabel="Save"
                  pending={update.isPending}
                  error={update.error}
                  onSubmit={(input) => update.mutate({ id: s.id, input }, { onSuccess: () => setEditingId(null) })}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }

          return (
            <li
              key={s.id}
              className={`rounded-2xl border bg-surface p-3 transition-colors duration-200 ${
                taken ? "border-accent/40" : "border-surface-raised"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-fg">
                    {s.name}
                    {s.dose_amount !== null && <span className="ml-1.5 font-mono text-xs text-muted">{doseLabel(s)}</span>}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {[s.brand, s.timing_rule ? TIMING_LABELS[s.timing_rule as keyof typeof TIMING_LABELS] : null, s.purpose]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  {pct !== undefined && (
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{pct}% of the last 30 days</p>
                  )}
                </div>

                {taken ? (
                  <button
                    onClick={() => deleteIntake.mutate(taken.id)}
                    className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[11px] text-accent"
                  >
                    ✓ {formatTime(taken.taken_at)}
                  </button>
                ) : (
                  <button
                    onClick={() => logIntake.mutate({ supplement: s, logDate })}
                    disabled={logIntake.isPending || !s.active}
                    className="shrink-0 rounded-full bg-accent px-3.5 py-2 font-display text-xs font-bold text-bg transition-transform duration-150 active:scale-95 disabled:opacity-40"
                  >
                    Take
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => setEditingId(s.id)}
                  className="font-mono text-[10px] text-muted hover:text-fg"
                >
                  Edit
                </button>
                {managing && (
                  <button
                    onClick={() => setActive.mutate({ id: s.id, active: !s.active })}
                    className="font-mono text-[10px] text-muted hover:text-fg"
                  >
                    {s.active ? "Retire" : "Restore to stack"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {supplements?.length === 0 && (
          <li className="rounded-2xl border border-dashed border-surface-raised p-4 text-center text-xs text-muted">
            No supplements yet. Add what you take so adherence and timing become trackable.
          </li>
        )}
      </ul>
    </main>
  );
}

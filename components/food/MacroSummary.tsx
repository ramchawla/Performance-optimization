import type { DailyTotals } from "@/lib/calc/nutritionTotals";
import { macroProgress, type MacroTargets } from "@/lib/calc/nutritionTotals";
import { MICRO_VOCAB, type MicroKey } from "@/lib/nutrition";

function ProgressBar({ label, consumed, target, ratio }: { label: string; consumed: number; target: number | null; ratio: number | null }) {
  const pct = ratio !== null ? Math.min(100, Math.round(ratio * 100)) : null;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="tabular-nums text-neutral-700">
          {Math.round(consumed)}{target ? ` / ${target}` : ""}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full rounded-full bg-neutral-100">
        <div
          className={`h-1.5 rounded-full ${ratio !== null && ratio > 1 ? "bg-amber-500" : "bg-neutral-900"}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function MacroSummary({ totals, targets }: { totals: DailyTotals; targets: MacroTargets }) {
  const progress = macroProgress(totals, targets);
  const microEntries = Object.entries(totals.micros).filter(([, v]) => v > 0);

  return (
    <div className="space-y-2 rounded border border-neutral-200 p-3">
      <ProgressBar label="Calories" consumed={totals.calories} target={targets.calories} ratio={progress.calories} />
      <ProgressBar label="Protein" consumed={totals.proteinG} target={targets.proteinG} ratio={progress.proteinG} />
      <ProgressBar label="Carbs" consumed={totals.carbsG} target={targets.carbsG} ratio={progress.carbsG} />
      <ProgressBar label="Fat" consumed={totals.fatG} target={targets.fatG} ratio={progress.fatG} />
      {microEntries.length > 0 && (
        <div className="border-t border-neutral-100 pt-2">
          <p className="text-xs text-neutral-400">Micros today</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
            {microEntries.map(([key, value]) => (
              <span key={key}>
                {MICRO_VOCAB[key as MicroKey] ?? key}: {Math.round(value * 10) / 10}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

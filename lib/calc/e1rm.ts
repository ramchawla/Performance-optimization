/**
 * Estimated 1-rep-max and exercise progress calculations.
 * See TECHNICAL-DESIGN.md §6 for the rules this implements — do not change
 * the reps>12 exclusion or the deload exclusion without updating that doc.
 */

export interface LoggedSet {
  reps: number;
  weightKg: number;
  isWarmup: boolean;
}

export interface SessionForProgress {
  sessionId: string;
  performedAt: string; // ISO date
  isDeload: boolean;
  sets: LoggedSet[];
}

/**
 * Epley formula: e1RM = weight * (1 + reps/30)
 * Only valid for working sets (not warmups) with reps <= 12 — the formula
 * degrades badly above that rep range, so we deliberately exclude it rather
 * than return a misleading number.
 */
export function epley1RM(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps > 12) return null;
  return weightKg * (1 + reps / 30);
}

/**
 * Best e1RM among a set of logged sets for one exercise in one session.
 * Warmup sets are always excluded. Returns null if no eligible set exists
 * (e.g., every set was a warmup, or every set had reps > 12).
 */
export function bestSessionE1RM(sets: LoggedSet[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    if (set.isWarmup) continue;
    const est = epley1RM(set.weightKg, set.reps);
    if (est === null) continue;
    if (best === null || est > best) best = est;
  }
  return best;
}

export interface ProgressPoint {
  sessionId: string;
  performedAt: string;
  e1rm: number;
}

/**
 * Builds the exercise progress series for charting: one point per session
 * that has an eligible set, sessions marked isDeload excluded entirely (per
 * TECHNICAL-DESIGN §6 — deloads never count toward progression or PRs).
 * Sorted ascending by date.
 */
export function buildProgressSeries(sessions: SessionForProgress[]): ProgressPoint[] {
  return sessions
    .filter((s) => !s.isDeload)
    .map((s) => {
      const e1rm = bestSessionE1RM(s.sets);
      return e1rm === null ? null : { sessionId: s.sessionId, performedAt: s.performedAt, e1rm };
    })
    .filter((p): p is ProgressPoint => p !== null)
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
}

/**
 * All-time PR (max e1RM), deload-excluded. Returns null if no eligible data.
 */
export function currentPR(sessions: SessionForProgress[]): ProgressPoint | null {
  const series = buildProgressSeries(sessions);
  if (series.length === 0) return null;
  return series.reduce((max, p) => (p.e1rm > max.e1rm ? p : max), series[0]);
}

/**
 * "Ready to progress" cue: true if every non-warmup set in the most recent
 * eligible session hit the target rep max at or below the target RPE.
 * Cheap heuristic per TECHNICAL-DESIGN §2 — not a replacement for judgment.
 */
export function readyToProgress(
  lastSets: Array<{ reps: number; rpe: number | null; isWarmup: boolean }>,
  targetRepsMax: number,
  targetRpe: number | null
): boolean {
  const working = lastSets.filter((s) => !s.isWarmup);
  if (working.length === 0) return false;
  return working.every((s) => {
    const hitReps = s.reps >= targetRepsMax;
    const hitRpe = targetRpe === null || s.rpe === null || s.rpe <= targetRpe;
    return hitReps && hitRpe;
  });
}

/**
 * Small pure helpers for Garmin daily data (CLAUDE.md rule 6).
 */

const STALE_AFTER_MIN = 120;

/**
 * "Watch synced 2h ago". Garmin's cloud only knows what the watch last
 * uploaded (via the phone app), so a stale upload — not our sync — is why
 * the app can trail the watch face. Takes minutes since epoch, the unit
 * garmin-sync stores as `watch_last_sync_epoch_min`.
 */
export function syncAgeLabel(epochMin: number | undefined, nowMs: number): { label: string; stale: boolean } | null {
  if (epochMin === undefined || !Number.isFinite(epochMin)) return null;
  const ageMin = Math.max(0, Math.round(nowMs / 60_000 - epochMin));
  const stale = ageMin > STALE_AFTER_MIN;
  if (ageMin < 5) return { label: "just now", stale };
  if (ageMin < 60) return { label: `${ageMin}m ago`, stale };
  if (ageMin < 24 * 60) return { label: `${Math.floor(ageMin / 60)}h ago`, stale };
  return { label: `${Math.floor(ageMin / (24 * 60))}d ago`, stale };
}

/** Garmin's weekly intensity minutes: vigorous counts double toward the 150/week goal. */
export function weeklyIntensityMinutes(days: Array<{ moderate: number | undefined; vigorous: number | undefined }>): number {
  return days.reduce((sum, d) => sum + (d.moderate ?? 0) + 2 * (d.vigorous ?? 0), 0);
}

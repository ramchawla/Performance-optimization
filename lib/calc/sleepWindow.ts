/**
 * Turning "I went to bed at 11:20 and woke at 6:45" into two real timestamps.
 *
 * The log date is the WAKE-UP date (CLAUDE.md rule 5), so the bedtime almost
 * always belongs to the previous calendar day. The rule: bedtime lands on the
 * log date only when it's strictly earlier in the clock than the wake time
 * (a nap, or a 2am-to-9am night); otherwise it rolls back a day.
 */

export interface SleepWindow {
  bedtimeAt: string; // ISO timestamp
  waketimeAt: string;
  durationS: number;
}

/** `time` is a 24h "HH:MM" string, as produced by <input type="time">. */
export function resolveSleepWindow(logDate: string, bedTime: string, wakeTime: string): SleepWindow | null {
  if (!/^\d{2}:\d{2}$/.test(bedTime) || !/^\d{2}:\d{2}$/.test(wakeTime)) return null;

  const wake = new Date(`${logDate}T${wakeTime}:00`);
  if (Number.isNaN(wake.getTime())) return null;

  const bed = new Date(`${logDate}T${bedTime}:00`);
  if (bedTime >= wakeTime) bed.setDate(bed.getDate() - 1);

  return {
    bedtimeAt: bed.toISOString(),
    waketimeAt: wake.toISOString(),
    durationS: Math.round((wake.getTime() - bed.getTime()) / 1000),
  };
}

/** "7h 25m" — the shape a duration should be read in, never raw seconds. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

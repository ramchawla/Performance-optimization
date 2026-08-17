/**
 * Local-date/time helpers. Dates in this app are *local* calendar dates
 * (CLAUDE.md rule 5) while timestamps are real instants stored as UTC — these
 * are the conversions between the two, in one place rather than re-derived in
 * every form.
 */

/** Today as YYYY-MM-DD in the user's local timezone. */
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** The local calendar date an instant falls on. */
export function localDateOf(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-CA");
}

/** Local "HH:MM" for an <input type="time">, or "" when unset. */
export function toTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Current local time as "HH:MM" — the sensible default for a "when?" field. */
export function nowTimeInput(): string {
  return toTimeInput(new Date().toISOString());
}

/**
 * Combines a local date and a local "HH:MM" into an instant. Falls back to
 * midday when the time is blank so a date-only entry can't drift into the
 * neighbouring day in another timezone.
 */
export function combineLocal(date: string, time: string): string {
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "12:00:00";
  return new Date(`${date}T${safeTime}`).toISOString();
}

/** Whole days between two local dates — positive when `date` is in the past. */
export function daysAgo(date: string): number {
  const then = new Date(`${date}T12:00:00`).getTime();
  const now = new Date(`${todayLocal()}T12:00:00`).getTime();
  return Math.round((now - then) / 86_400_000);
}

/** "7:20 AM" — how a time should be read back. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Sat, Aug 16" */
export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

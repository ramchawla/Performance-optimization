/**
 * Local-date/time helpers. Dates in this app are *local* calendar dates
 * (CLAUDE.md rule 5) while timestamps are real instants stored as UTC — these
 * are the conversions between the two, in one place rather than re-derived in
 * every form.
 *
 * "Local" means the timezone on `profiles.timezone`, not the device's. Those
 * agree at home and disagree the moment you travel: fly to London and a
 * device-local Tuesday-morning weigh-in lands on Tuesday there but belongs to
 * Monday's day in your own history. Anchoring to the profile's zone keeps a
 * trip from putting two weigh-ins on one date and none on the next.
 */

/**
 * Set once at app start from the profile (see app/providers.tsx). Module state
 * rather than a parameter on all ten functions: every caller wants the same
 * answer, and threading it through would touch every form in the app for no
 * added correctness. Undefined until loaded, which falls back to device-local
 * — the pre-existing behaviour, and right for the first render.
 */
let profileTimezone: string | undefined;

export function setProfileTimezone(tz: string | null | undefined): void {
  // An invalid IANA name would make every subsequent date call throw, taking
  // the whole app down over a bad profile row. Validate before adopting it.
  if (!tz) return;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    profileTimezone = tz;
  } catch {
    profileTimezone = undefined;
  }
}

/** The zone dates are being resolved in — device-local until the profile loads. */
export function activeTimezone(): string {
  return profileTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function dateOpts(): Intl.DateTimeFormatOptions {
  return profileTimezone ? { timeZone: profileTimezone } : {};
}

/** Today as YYYY-MM-DD in the user's timezone. */
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA", dateOpts());
}

/** The calendar date an instant falls on, in the user's timezone. */
export function localDateOf(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-CA", dateOpts());
}

/**
 * Local "HH:MM" for an <input type="time">, or "" when unset.
 *
 * Device-local, NOT the profile zone — and deliberately so. Two different
 * questions are being answered in this file:
 *
 *   - *Which day does this belong to?* → the profile's zone, so a trip can't
 *     scatter your history across the wrong dates.
 *   - *What time is this?* → the device's zone, because a clock time is only
 *     meaningful next to the clock the user is looking at.
 *
 * Mixing them is what produces the "I typed 08:00 and it saved 03:00" bug, so
 * the pairs must agree: toTimeInput/combineLocal are both device-local and
 * round-trip exactly; todayLocal/localDateOf are both profile-zoned.
 */
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

/**
 * Shared auth constraints.
 *
 * Supabase's "Prevent use of leaked passwords" (HaveIBeenPwned) is Pro-plan
 * only, so on the free tier length and character variety are the whole defence.
 * Keep this in sync with the "Minimum password length" setting in
 * Authentication → Providers → Email — the server-side rule is the one that
 * actually binds; this only gives a better error before the round trip.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Preview-only mock data for the mobility tab (Kinetic design direction).
 * No mobility schema exists yet (routines/sessions aren't in schema.sql).
 * ponytail: swap for real queries once a mobility_routines/mobility_sessions
 * table + lib/queries wiring exists — shapes below are deliberately simple
 * and can guide that schema when it's designed.
 */

export interface MobilityRoutine {
  id: string;
  name: string;
  durationMin: number;
  stretchCount: number;
  targetArea: string;
}

export interface MobilitySession {
  id: string;
  routineName: string;
  durationMin: number;
  daysAgo: number; // 0 = today
  skippedStretch: boolean;
}

export const MOCK_MOBILITY = {
  weekActiveDays: 4,
  weekTotalDays: 7,
  streakWeeks: 2,
  routines: [
    { id: "hip-opener", name: "Hip opener flow", durationMin: 12, stretchCount: 6, targetArea: "Hips, glutes" },
    { id: "shoulder-reset", name: "Post-lift shoulder reset", durationMin: 8, stretchCount: 4, targetArea: "Shoulders, chest" },
    { id: "morning-full-body", name: "Morning full-body", durationMin: 15, stretchCount: 8, targetArea: "Full body" },
    { id: "ankle-mobility", name: "Ankle mobility for squats", durationMin: 6, stretchCount: 3, targetArea: "Ankles" },
  ] satisfies MobilityRoutine[],
  recentSessions: [
    { id: "s1", routineName: "Post-lift shoulder reset", durationMin: 8, daysAgo: 0, skippedStretch: false },
    { id: "s2", routineName: "Hip opener flow", durationMin: 12, daysAgo: 1, skippedStretch: false },
    { id: "s3", routineName: "Morning full-body", durationMin: 14, daysAgo: 3, skippedStretch: true },
  ] satisfies MobilitySession[],
};

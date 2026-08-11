/**
 * Preview-only mock data for the settings screen. All settings-page state is
 * local-state only for now (toggle, edit targets, connect/disconnect) — no
 * backend wiring yet, mirrors lib/mock/dashboardMock.ts's pattern.
 * ponytail: swap for real profile/sync/integration queries + mutations once
 * those tables/endpoints exist.
 */

export interface MockNutritionTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MockIntegration {
  id: "strava" | "appleHealth";
  name: string;
  description: string;
  initials: string;
  connected: boolean;
}

export const MOCK_SETTINGS = {
  profile: {
    name: "Ram",
    units: "Metric (kg)",
  },
  nutritionTargets: {
    kcal: 2400,
    proteinG: 180,
    carbsG: 220,
    fatG: 75,
  } satisfies MockNutritionTargets,
  sync: {
    lastSyncedLabel: "2 minutes ago",
    outboxPending: 0,
    wifiOnly: false,
  },
  integrations: [
    { id: "strava", name: "Strava", description: "Auto-imports runs and rides", initials: "S", connected: true },
    { id: "appleHealth", name: "Apple Health", description: "Sleep, weight, steps", initials: "A", connected: false },
  ] satisfies MockIntegration[],
};

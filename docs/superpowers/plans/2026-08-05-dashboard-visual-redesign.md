# Dashboard Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace default create-next-app styling with a dark-athletic design system, and build a real Dashboard page (recomp tiles, today's nutrition, week strip) wired to existing DB view and calc functions.

**Architecture:** New CSS tokens in `app/globals.css` + Space Grotesk display font. New `lib/calc/e1rm.ts` slope helper (mirrors existing `weightTrend.ts` pattern) with unit test. New `lib/queries/dashboard.ts` composing `daily_rollup` view + calc functions into one `useDashboard()` hook. New presentational components in `components/ui/`. Rebuilt `(main)/layout.tsx` nav and `(main)/dashboard/page.tsx`.

**Tech Stack:** Next.js App Router, TanStack Query, Supabase browser client, Tailwind v4 (`@theme inline` tokens), Recharts (sparkline), Vitest.

## Global Constraints

- DB stores kg/meters/seconds/kcal only; convert at display layer via `lib/units.ts` (CLAUDE.md rule 1)
- Deload sessions (`is_deload`) excluded from all e1RM/PR/trend calculations, without exception (CLAUDE.md rule 8)
- Pure calc functions in `lib/calc/` take plain data in/out, no I/O, and get vitest unit tests (CLAUDE.md rule 6)
- Every Supabase call's error is handled — no silent `catch {}` (CLAUDE.md rule 7)
- No dependencies beyond the existing Stack section without justification comment (CLAUDE.md rule 9)
- Mobile-width (390px) layout must work — phone-first, one-handed at the gym (CLAUDE.md Definition of Done)
- Never present weight alone as success/failure — recomp tiles use neutral trend arrows, not red/green pass-fail (TECHNICAL-DESIGN §97)
- `npm run build`, `npm run typecheck`, `npm run lint` must all pass clean before this is done

---

### Task 1: Design tokens + Space Grotesk font

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties `--bg`, `--surface`, `--surface-raised`, `--fg`, `--muted`, `--accent`, `--accent-dim`, `--font-display` (Tailwind theme vars `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-fg`, `--color-muted`, `--color-accent`, `--color-accent-dim`, `--font-display`) available to every later task via Tailwind utility classes (`bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `text-accent`, `border-accent`, `font-display`, etc).

- [ ] **Step 1: Replace `app/globals.css` theme block**

```css
@import "tailwindcss";

:root {
  --bg: #0a0b0d;
  --surface: #16181c;
  --surface-raised: #1e2126;
  --fg: #f4f5f0;
  --muted: #8a8f98;
  --accent: #c6ff3d;
  --accent-dim: #7a9e2e;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-dim: var(--accent-dim);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-display: var(--font-space-grotesk);
}

body {
  background: var(--bg);
  color: var(--fg);
}
```

This app is dark-only by design (CLAUDE.md: gym-phone-first), so the previous `prefers-color-scheme` media query is removed — one theme, not light/dark switching.

- [ ] **Step 2: Add Space Grotesk font in `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Performance Hub",
  description: "Personal training, nutrition, sleep, and body-metrics tracker.",
  appleWebApp: { title: "Perf Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck && npm run lint`
Expected: both clean (no errors)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: dark-athletic design tokens + Space Grotesk display font"
```

---

### Task 2: `e1rmSlopePerWeek` calc helper + test

**Files:**
- Modify: `lib/calc/e1rm.ts`
- Modify: `lib/calc/e1rm.test.ts`

**Interfaces:**
- Consumes: `ProgressPoint` (existing type: `{ sessionId: string; performedAt: string; e1rm: number }`), produced by existing `buildProgressSeries()`
- Produces: `e1rmSlopePerWeek(series: ProgressPoint[], trailingDays = 28): number | null` — kg/week slope over the trailing window, same shape as `emaSlopeKgPerWeek` in `weightTrend.ts`. Task 3 calls this per-exercise.

- [ ] **Step 1: Write the failing test**

Add to `lib/calc/e1rm.test.ts` (check existing imports at top of file first and match them):

```ts
describe("e1rmSlopePerWeek", () => {
  it("returns null with fewer than 2 points", () => {
    expect(e1rmSlopePerWeek([{ sessionId: "a", performedAt: "2026-01-01", e1rm: 100 }])).toBeNull();
  });

  it("computes positive slope in kg/week over the trailing window", () => {
    const series = [
      { sessionId: "a", performedAt: "2026-01-01", e1rm: 100 },
      { sessionId: "b", performedAt: "2026-01-08", e1rm: 107 },
    ];
    const slope = e1rmSlopePerWeek(series, 28);
    expect(slope).toBeCloseTo(7, 5);
  });

  it("only considers the trailing N days of points", () => {
    const series = [
      { sessionId: "a", performedAt: "2026-01-01", e1rm: 50 },
      { sessionId: "b", performedAt: "2026-01-08", e1rm: 100 },
      { sessionId: "c", performedAt: "2026-01-15", e1rm: 107 },
    ];
    const slope = e1rmSlopePerWeek(series, 8);
    expect(slope).toBeCloseTo(7, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/calc/e1rm.test.ts`
Expected: FAIL — `e1rmSlopePerWeek is not defined`

- [ ] **Step 3: Implement in `lib/calc/e1rm.ts`**

Append to the file:

```ts
/**
 * Slope of e1RM over the trailing N days, in kg/week, mirroring
 * weightTrend.ts's emaSlopeKgPerWeek. Positive = getting stronger.
 * Returns null if fewer than 2 points fall in the window.
 */
export function e1rmSlopePerWeek(series: ProgressPoint[], trailingDays = 28): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = new Date(last.performedAt + "T00:00:00Z").getTime() - trailingDays * 86400000;
  const window = series.filter((p) => new Date(p.performedAt + "T00:00:00Z").getTime() >= cutoff);
  if (window.length < 2) return null;

  const first = window[0];
  const daysApart =
    (new Date(last.performedAt + "T00:00:00Z").getTime() -
      new Date(first.performedAt + "T00:00:00Z").getTime()) /
    86400000;
  if (daysApart <= 0) return null;

  const kgPerDay = (last.e1rm - first.e1rm) / daysApart;
  return kgPerDay * 7;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/calc/e1rm.test.ts`
Expected: PASS, all tests green

- [ ] **Step 5: Commit**

```bash
git add lib/calc/e1rm.ts lib/calc/e1rm.test.ts
git commit -m "feat: add e1rmSlopePerWeek calc helper for strength trend"
```

---

### Task 3: `lib/queries/dashboard.ts`

**Files:**
- Create: `lib/queries/dashboard.ts`

**Interfaces:**
- Consumes: `computeWeightEMA`, `emaSlopeKgPerWeek` from `lib/calc/weightTrend.ts`; `buildProgressSeries`, `e1rmSlopePerWeek` from `lib/calc/e1rm.ts`; `createClient` from `lib/supabase/client.ts`; `Database` type from `lib/database.types.ts`
- Produces: `useDashboard(): UseQueryResult<DashboardData>` where

```ts
export interface DashboardData {
  today: {
    day: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    trained: boolean;
  } | null;
  targets: {
    calories: number | null;
    proteinG: number | null;
  };
  weightSlopeKgPerWeek: number | null;
  strengthSlopeKgPerWeek: number | null;
  waistSlopeCmPerWeek: number | null;
  week: Array<{ date: string; trained: boolean }>; // 7 entries, oldest first, today last
}
```

Task 5 (Dashboard page) and Task 4 (components) consume this shape directly — field names above are final.

- [ ] **Step 1: Write the query/composition function**

```ts
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { computeWeightEMA, emaSlopeKgPerWeek } from "@/lib/calc/weightTrend";
import { buildProgressSeries, e1rmSlopePerWeek } from "@/lib/calc/e1rm";

export interface DashboardData {
  today: {
    day: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    trained: boolean;
  } | null;
  targets: {
    calories: number | null;
    proteinG: number | null;
  };
  weightSlopeKgPerWeek: number | null;
  strengthSlopeKgPerWeek: number | null;
  waistSlopeCmPerWeek: number | null;
  week: Array<{ date: string; trained: boolean }>;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const userId = userData.user.id;

      const todayIso = isoDate(new Date());
      const windowStart = isoDate(new Date(Date.now() - 35 * 86400000));

      const [rollupRes, profileRes, bodyRes, sessionsRes] = await Promise.all([
        supabase
          .from("daily_rollup")
          .select("day, calories, protein_g, carbs_g, fat_g, trained")
          .eq("user_id", userId)
          .gte("day", windowStart)
          .order("day"),
        supabase
          .from("profiles")
          .select("target_calories, target_protein_g")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("body_metrics")
          .select("measured_at, weight_kg, waist_cm")
          .eq("user_id", userId)
          .gte("measured_at", windowStart)
          .order("measured_at"),
        supabase
          .from("workout_sessions")
          .select(
            "id, started_at, is_deload, session_exercises(exercise_id, session_sets(set_number, is_warmup, actual_reps, actual_weight_kg))"
          )
          .eq("user_id", userId)
          .gte("started_at", windowStart)
          .not("completed_at", "is", null)
          .order("started_at"),
      ]);

      if (rollupRes.error) throw rollupRes.error;
      if (profileRes.error) throw profileRes.error;
      if (bodyRes.error) throw bodyRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      const rollupRows = rollupRes.data ?? [];
      const todayRow = rollupRows.find((r) => r.day === todayIso) ?? null;

      const weighIns = (bodyRes.data ?? [])
        .filter((b) => b.weight_kg !== null)
        .map((b) => ({ date: (b.measured_at as string).slice(0, 10), weightKg: b.weight_kg as number }));
      const weightSlopeKgPerWeek = emaSlopeKgPerWeek(computeWeightEMA(weighIns), 14);

      const waistIns = (bodyRes.data ?? [])
        .filter((b) => b.waist_cm !== null)
        .map((b) => ({ date: (b.measured_at as string).slice(0, 10), weightKg: b.waist_cm as number }));
      const waistSlopeCmPerWeek = waistIns.length > 0 ? emaSlopeKgPerWeek(computeWeightEMA(waistIns), 14) : null;

      // Strength trend: mean 28-day e1RM slope across every exercise with
      // enough data. TECHNICAL-DESIGN calls for "the big 4-6 lifts" but the
      // exercises table has no such flag — averaging across everything
      // trained is the honest v1 substitute.
      // ponytail: exercise-category flag would let us restrict to compounds; add if this reads noisy in practice.
      const byExercise = new Map<
        string,
        Array<{ sessionId: string; performedAt: string; isDeload: boolean; sets: { reps: number; weightKg: number; isWarmup: boolean }[] }>
      >();
      for (const session of sessionsRes.data ?? []) {
        const performedAt = (session.started_at as string).slice(0, 10);
        for (const se of session.session_exercises ?? []) {
          const list = byExercise.get(se.exercise_id) ?? [];
          list.push({
            sessionId: session.id,
            performedAt,
            isDeload: session.is_deload,
            sets: (se.session_sets ?? [])
              .filter((s) => s.actual_reps !== null && s.actual_weight_kg !== null)
              .map((s) => ({ reps: s.actual_reps as number, weightKg: s.actual_weight_kg as number, isWarmup: s.is_warmup })),
          });
          byExercise.set(se.exercise_id, list);
        }
      }
      const slopes: number[] = [];
      for (const sessions of byExercise.values()) {
        const series = buildProgressSeries(sessions);
        const slope = e1rmSlopePerWeek(series, 28);
        if (slope !== null) slopes.push(slope);
      }
      const strengthSlopeKgPerWeek = slopes.length > 0 ? slopes.reduce((a, b) => a + b, 0) / slopes.length : null;

      const week: DashboardData["week"] = [];
      for (let i = 6; i >= 0; i--) {
        const date = isoDate(new Date(Date.now() - i * 86400000));
        const row = rollupRows.find((r) => r.day === date);
        week.push({ date, trained: row?.trained ?? false });
      }

      return {
        today: todayRow
          ? {
              day: todayRow.day as string,
              calories: todayRow.calories,
              proteinG: todayRow.protein_g,
              carbsG: todayRow.carbs_g,
              fatG: todayRow.fat_g,
              trained: todayRow.trained ?? false,
            }
          : null,
        targets: {
          calories: profileRes.data?.target_calories ?? null,
          proteinG: profileRes.data?.target_protein_g ?? null,
        },
        weightSlopeKgPerWeek,
        strengthSlopeKgPerWeek,
        waistSlopeCmPerWeek,
        week,
      };
    },
  });
}
```

- [ ] **Step 2: Verify types**

Run: `npm run typecheck`
Expected: clean. If the nested `session_exercises(...)` select shape doesn't match generated types, check `lib/database.types.ts` relationship names for `workout_sessions` and adjust the select string's foreign-table names to match exactly (do not change table/column names elsewhere).

- [ ] **Step 3: Commit**

```bash
git add lib/queries/dashboard.ts
git commit -m "feat: add useDashboard query composing daily_rollup + calc functions"
```

---

### Task 4: Presentational components

**Files:**
- Create: `components/ui/RecompTile.tsx`
- Create: `components/ui/ProgressBar.tsx`
- Create: `components/ui/WeekStrip.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks except Tailwind tokens from Task 1 (`bg-surface`, `text-accent`, etc.) and `recharts` (already a project dependency) for the sparkline
- Produces:
  - `<RecompTile label: string, value: string, trend: "up" | "down" | "flat", favorable: boolean, sparkline: number[] />`
  - `<ProgressBar label: string, current: number, target: number | null, unit: string />`
  - `<WeekStrip days: Array<{ date: string; trained: boolean }> />`

  Task 5 (Dashboard page) imports and renders all three with these exact prop names.

- [ ] **Step 1: `components/ui/RecompTile.tsx`**

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface RecompTileProps {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  favorable: boolean;
  sparkline: number[];
}

const ARROW: Record<RecompTileProps["trend"], string> = { up: "↗", down: "↘", flat: "→" };

export function RecompTile({ label, value, trend, favorable, sparkline }: RecompTileProps) {
  const data = sparkline.map((v, i) => ({ i, v }));
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface p-3 ${
        favorable ? "ring-1 ring-accent shadow-[0_0_16px_-4px_var(--accent)]" : ""
      }`}
    >
      {data.length > 1 && (
        <div className="absolute inset-0 opacity-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={favorable ? "var(--accent)" : "var(--muted)"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative">
        <p className="text-xs text-muted">{label}</p>
        <p className="font-display text-2xl font-bold text-fg">
          {ARROW[trend]} {value}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `components/ui/ProgressBar.tsx`**

```tsx
interface ProgressBarProps {
  label: string;
  current: number;
  target: number | null;
  unit: string;
}

export function ProgressBar({ label, current, target, unit }: ProgressBarProps) {
  const pct = target && target > 0 ? Math.min(1, current / target) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="font-mono text-sm text-fg">
          {Math.round(current)}
          {target !== null ? ` / ${target}` : ""} {unit}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `components/ui/WeekStrip.tsx`**

```tsx
interface WeekStripProps {
  days: Array<{ date: string; trained: boolean }>;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function WeekStrip({ days }: WeekStripProps) {
  return (
    <div className="flex justify-between">
      {days.map((d) => {
        const dow = DOW[new Date(d.date + "T00:00:00Z").getUTCDay()];
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted">{dow}</span>
            <span
              className={`h-3 w-3 rounded-full ${d.trained ? "bg-accent" : "bg-surface-raised"}`}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify types**

Run: `npm run typecheck && npm run lint`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add components/ui/RecompTile.tsx components/ui/ProgressBar.tsx components/ui/WeekStrip.tsx
git commit -m "feat: add RecompTile, ProgressBar, WeekStrip presentational components"
```

---

### Task 5: Nav shell + Dashboard page

**Files:**
- Modify: `app/(main)/layout.tsx`
- Modify: `app/(main)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useDashboard()` from Task 3, `RecompTile`/`ProgressBar`/`WeekStrip` from Task 4, existing `SyncStatus` component (unchanged)

- [ ] **Step 1: Rebuild `app/(main)/layout.tsx` nav**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SyncStatus } from "@/components/sync/SyncStatus";

const NAV = [
  { href: "/dashboard", label: "Dash" },
  { href: "/train/templates", label: "Train" },
  { href: "/food/log", label: "Food" },
  { href: "/body/photos", label: "Body" },
  { href: "/mobility", label: "Mobility" },
  { href: "/settings", label: "Settings" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-bg pb-24">
      <SyncStatus />
      {children}
      <nav className="fixed bottom-4 left-4 right-4 flex justify-around rounded-2xl border border-surface-raised bg-surface/95 py-2 backdrop-blur">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href.split("/")[1] ? `/${item.href.split("/")[1]}` : item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                active ? "bg-accent text-bg shadow-[0_0_12px_-2px_var(--accent)]" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Rebuild `app/(main)/dashboard/page.tsx`**

```tsx
"use client";

import { useDashboard } from "@/lib/queries/dashboard";
import { RecompTile } from "@/components/ui/RecompTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { WeekStrip } from "@/components/ui/WeekStrip";

function trendFor(slope: number | null): "up" | "down" | "flat" {
  if (slope === null || Math.abs(slope) < 0.05) return "flat";
  return slope > 0 ? "up" : "down";
}

export default function Page() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <main className="p-4">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="p-4">
        <p className="text-sm text-muted">Couldn&apos;t load dashboard. Pull to refresh.</p>
      </main>
    );
  }

  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <main className="space-y-6 p-4">
      <p className="font-mono text-xs text-muted">{todayLabel}</p>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recomp</h2>
        <div className="grid grid-cols-3 gap-2">
          <RecompTile
            label="Weight"
            value={data.weightSlopeKgPerWeek !== null ? `${data.weightSlopeKgPerWeek.toFixed(2)} kg/wk` : "—"}
            trend={trendFor(data.weightSlopeKgPerWeek)}
            favorable={data.weightSlopeKgPerWeek !== null && data.weightSlopeKgPerWeek < 0}
            sparkline={[]}
          />
          <RecompTile
            label="Strength"
            value={data.strengthSlopeKgPerWeek !== null ? `${data.strengthSlopeKgPerWeek.toFixed(1)} kg/wk` : "—"}
            trend={trendFor(data.strengthSlopeKgPerWeek)}
            favorable={data.strengthSlopeKgPerWeek !== null && data.strengthSlopeKgPerWeek > 0}
            sparkline={[]}
          />
          <RecompTile
            label="Waist"
            value={data.waistSlopeCmPerWeek !== null ? `${data.waistSlopeCmPerWeek.toFixed(2)} cm/wk` : "—"}
            trend={trendFor(data.waistSlopeCmPerWeek)}
            favorable={data.waistSlopeCmPerWeek !== null && data.waistSlopeCmPerWeek < 0}
            sparkline={[]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Nutrition today</h2>
        <div className="space-y-3 rounded-2xl bg-surface p-4">
          <ProgressBar label="Protein" current={data.today?.proteinG ?? 0} target={data.targets.proteinG} unit="g" />
          <ProgressBar label="Calories" current={data.today?.calories ?? 0} target={data.targets.calories} unit="kcal" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">This week</h2>
        <div className="rounded-2xl bg-surface p-4">
          <WeekStrip days={data.week} />
        </div>
      </section>
    </main>
  );
}
```

`sparkline={[]}` is intentional for v1 — the RecompTile component supports a
sparkline but `useDashboard` doesn't build per-day trend arrays yet (only the
slope scalar). Empty array renders the tile without the trace line, no crash.
Wiring real sparkline data is a natural follow-up, not required for v1 per
the approved spec.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/dashboard` at 390px width (browser devtools device toolbar). Confirm:
- Dark background, lime accents render
- Recomp tiles show `—` gracefully when no data exists yet (new/empty account) rather than crashing
- Nav pill bar shows active tab highlighted in lime
- No console errors

- [ ] **Step 4: Run full verification suite**

Run: `npm run build && npm run typecheck && npm run lint && npm test`
Expected: all clean/passing

- [ ] **Step 5: Commit**

```bash
git add "app/(main)/layout.tsx" "app/(main)/dashboard/page.tsx"
git commit -m "feat: dashboard v1 - recomp tiles, nutrition progress, week strip"
```

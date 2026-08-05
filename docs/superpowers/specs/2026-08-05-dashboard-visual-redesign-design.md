# Dashboard visual redesign — design system v1 + Dashboard page

## Problem

App currently ships with default `create-next-app` styling (no theme, no nav shell,
`app/page.tsx` was unmodified boilerplate) and `/dashboard` is a one-line stub.
CLAUDE.md describes Dashboard as "daily rollup dashboard" and TECHNICAL-DESIGN.md
specs a recomp composite indicator, but none of it is built — the `daily_rollup`
DB view and calc functions (`weightTrend`, `e1rm`, `correlation`, `nutritionTotals`)
exist and are tested, but nothing wires them into UI.

## Scope (v1)

Design system (tokens, nav shell) + Dashboard page only. Other feature pages
(Train, Food, Body, Mobility, Settings) get the pattern applied in follow-up
passes once this is validated.

Dashboard v1 shows:
1. Recomp composite: 3 tiles (weight EMA slope, strength trend = mean 28-day
   e1RM slope across big 4-6 lifts, waist EMA slope if measured)
2. Today's nutrition totals (protein, calories) vs. targets
3. This week's session strip (7 days, filled dot = session logged)

Deferred to a later pass: B12 deficiency panel, correlation panel
(TECHNICAL-DESIGN §102).

## Visual direction: dark athletic

**Color tokens**
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0B0D` | page background |
| `--surface` | `#16181C` | card background |
| `--surface-raised` | `#1E2126` | nested/elevated card |
| `--fg` | `#F4F5F0` | primary text |
| `--muted` | `#8A8F98` | secondary text, captions |
| `--accent` | `#C6FF3D` | electric lime — active nav, CTAs, favorable trend glow |
| `--accent-dim` | `#7A9E2E` | secondary lime accent |

No red/green pass-fail binary on recomp tiles — TECHNICAL-DESIGN explicitly
forbids treating weight trend alone as success/failure. Trend arrows are
neutral (↘ ↗ →); lime glow border marks "on track" only, muted gray otherwise.

**Type**
- Display (stat numbers, headline): Space Grotesk Bold, via `next/font/google`
- Body: Geist Sans (already wired)
- Data/labels/captions: Geist Mono (already wired), tabular figures

**Layout** — mobile-first, 390px primary width, single column, bottom pill nav
replaces current text-link nav bar.

**Signature element** — RECOMP tiles: each stat sits over a faint full-bleed
sparkline (plate/heartbeat-trace look). Lime-glow border appears only on
tiles trending favorably. This motif is unique to this panel; not reused
elsewhere in v1.

## Data flow

New `lib/queries/dashboard.ts`:
- reads `daily_rollup` view for today's nutrition totals + session info
- reads recent weight logs → `lib/calc/weightTrend.ts` for weight EMA slope
- reads recent sessions/sets → `lib/calc/e1rm.ts` for strength trend (mean
  28-day e1RM slope across big lifts), excluding `is_deload` sessions per
  CLAUDE.md rule 8
- reads recent measurements for waist EMA slope (nullable — not everyone logs waist)

All reads go through existing Supabase client patterns in `lib/queries/`;
no new tables, no migration needed.

## Components

- `components/ui/RecompTile.tsx` — single tile: label, trend arrow, big
  number, sparkline background, conditional glow
- `components/ui/ProgressBar.tsx` — thick bar for nutrition (protein/calories)
- `components/ui/WeekStrip.tsx` — 7-day dot strip
- `app/(main)/layout.tsx` — replaced nav with floating pill bar, lime active state
- `app/globals.css` — new color tokens, Space Grotesk font var
- `app/(main)/dashboard/page.tsx` — assembles the above from `lib/queries/dashboard.ts`

## Error handling

Nutrition/session/weight queries can independently be empty (new user, no
logs yet) — each section renders an empty state ("no sessions logged yet")
rather than crashing or hiding the whole dashboard. Supabase errors toast
per CLAUDE.md rule 7, dashboard shows last-known/cached data if available
else empty state.

## Testing

`lib/calc/*` already has unit tests and is unchanged by this work. No new
calc logic is introduced — `lib/queries/dashboard.ts` is thin composition
over existing tested calc functions, consistent with CLAUDE.md (UI/query
composition doesn't require new unit tests in v1).

## Out of scope

- Train/Food/Body/Mobility/Settings visual redesign (follow-up pass)
- B12 deficiency panel, correlation panel
- Any new DB schema/migration

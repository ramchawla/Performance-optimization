# Production Plan

Living document. Companion to `DOMAIN-ROADMAP.md` (which owns *what to track*);
this one owns *making the thing trustworthy*.

**Decisions locked:**
- **End state:** personal, built to last. No billing, onboarding funnel, ToS,
  or GDPR surface. "Production-grade" here means reliable, observable, backed
  up, and incapable of quietly losing data.
- **AI layer:** server-side. An Edge Function assembles context, calls the
  Claude API, renders in-app. Can run scheduled and can prompt for missing data.
- **Testing:** unit (have) + integration against a real DB + Playwright E2E on
  the flows that would ruin a day if broken.

---

# Part 1 — Technical debt inventory

Every item below was verified against the live project or the code, not
inferred. Severity-ordered.

## 🔴 Exploitable right now

**SEC-1 — `daily_rollup` bypasses row-level security.**
The view has no `security_invoker` option set (`reloptions` is null on
PostgreSQL 17.6), so it executes with its owner's privileges and **RLS on the
underlying tables is never applied to the querying user.** `lib/queries/dashboard.ts:83`
filters `.eq("user_id", userId)` — but nothing *requires* that filter. Any
authenticated user can `select * from daily_rollup` with no filter and read
every user's calories, weight, sleep, HRV and training history.

Flagged by Supabase's own linter as ERROR (`security_definer_view`).

**SEC-2 — Public sign-up appears to be open.**
`SignInForm` now has a working "Create account" path, and the codebase implies
Supabase's "Confirm email" is off. If so, anyone who finds the Vercel URL can
create an account on your project.

**On their own, each is survivable. Together they are a working data-exfiltration
chain:** sign up freely → query `daily_rollup` unfiltered → read everything.
There is exactly one user today (`auth.users` count = 1), so nothing has leaked
yet. Both fixes are small and should land before anything else in this document.

## 🟠 Data safety

| ID | Issue |
| --- | --- |
| **DATA-1** | **No export.** A system meant to last decades with no way to get data out. Also the prerequisite for the AI layer's context assembly. |
| **DATA-2** | **Backup posture unverified.** Supabase's free tier retains limited backups and no PITR. Needs confirming, and an independent copy if the answer is thin. |
| **DATA-3** | **`profiles.timezone` is read nowhere.** Every date derives from browser-local time. Correct at home, silently wrong the moment you travel — and CLAUDE.md rule 5 hangs date attribution on the user's timezone. |
| **DATA-4** | **New tables bypass the offline outbox.** `sleep_logs`, `hydration_logs`, `supplement_intakes`, `readiness_logs` write directly. A gym dead-spot drops the entry rather than queuing it. |

## 🟡 Reliability

| ID | Issue |
| --- | --- |
| **REL-1** | **No error boundaries.** No `error.tsx`, `global-error.tsx`, or `not-found.tsx`. An unhandled render error shows Next.js's raw error screen. |
| **REL-2** | **No toast system** — despite CLAUDE.md rule 7 requiring "toast + preserved input for user actions". Today, failures surface as inline text at best; several mutations have no error UI at all. This is a stated project rule going unmet. |
| **REL-3** | **`QueryClient` has zero defaults** (`app/providers.tsx:7`). No retry policy, no `staleTime`, no global error handling. Every transient network blip is a hard failure. |
| **REL-4** | **No observability.** No error tracking. If the Apple Health webhook stops delivering, nothing tells you — you'd notice weeks later via a gap in a chart. |

## 🟢 Performance

Not urgent at one user with a small dataset; all real at any scale.

- **PERF-1** — 36 RLS policies re-evaluate `auth.uid()` **per row**. Fix is
  mechanical: `auth.uid()` → `(select auth.uid())`.
- **PERF-2** — 10 unindexed foreign keys (`foods.user_id`, `nutrition_logs.food_id`,
  `recipe_items.*`, `session_exercises.exercise_id`, and others).
- **PERF-3** — `daily_rollup` is a plain view running ~15 correlated subqueries
  per day per query. Fine now; degrades as history grows. 0001 §11 already
  anticipates converting it to a materialized view.
- **PERF-4** — 5 unused indexes. Mostly features not yet exercised — leave them.

## 🔵 Product debt

- Only pure logic is tested (92 tests). No integration, no E2E.
- Dashboard's Today strip queries tables directly instead of the `water_ml` /
  `caffeine_mg` / `readiness_score` columns now in `daily_rollup`.
- Correlations are still the original two pairs. Readiness, water, caffeine
  timing and alcohol are all now logged and uncorrelated.
- Supplement intake UI is one-tap only; schema supports time, with-food, and
  skip-with-reason.
- `soreness_logs`: full 14-site enum, still zero UI.
- No PR detection; `lib/calc/e1rm.ts` is built and tested but only feeds sparklines.

---

# Part 2 — The plan

Six phases. Each ends green on `typecheck`, `lint`, `test`, `build`, and each
is independently shippable.

## Phase 1 — Close the security hole *(do first, small)*

1. `alter view daily_rollup set (security_invoker = on)` — migration `0005`.
   Then verify by querying the view as `authenticated` and confirming it
   returns only own rows.
2. Turn off public sign-up in Supabase (Authentication → Providers → Email →
   disable "Enable sign-ups"). Keep sign-in and password recovery working.
   Then remove the now-dead "Create account" affordance from `SignInForm`.
3. Enable leaked-password protection (HaveIBeenPwned) — dashboard toggle.
4. Re-run the Supabase security advisor; expect zero ERROR-level findings.

## Phase 2 — Data safety

1. **Export** (`DATA-1`). A `/settings/export` route plus a
   `lib/export/collect.ts` that walks every table for the user and emits:
   - **JSON** — complete, lossless, the AI layer's input format.
   - **CSV-per-table** in a zip — spreadsheet-friendly.
   Deliberately built as a pure data-assembly module so Phase 5 reuses it
   rather than reimplementing context gathering.
2. **Backups** (`DATA-2`). Confirm the Supabase plan's retention. If it's thin,
   add a scheduled job that writes the JSON export to storage weekly, so
   there's always a restorable copy independent of Supabase's own backups.
3. **Timezone** (`DATA-3`). Populate `profiles.timezone` on first load, and
   route every `todayLocal()` call through a helper that honours it.
   `lib/datetime.ts` already centralises these, so this is a contained change.
4. **Outbox coverage** (`DATA-4`). Add the four new tables to `OutboxTable`,
   give them `client_id` columns, and update TECHNICAL-DESIGN §3 — that doc
   owns the offline-writable list, so it changes first.

## Phase 3 — Reliability floor

1. `app/global-error.tsx`, `app/(main)/error.tsx`, `app/not-found.tsx` — real
   recovery UI, not a stack trace.
2. **Toast system** (`REL-2`) — a small context + hook, no dependency. Wire
   every mutation's `onError` to it, preserving input per rule 7. This closes
   the outstanding CLAUDE.md compliance gap.
3. **`QueryClient` defaults** (`REL-3`): retry with backoff on network errors,
   no retry on 4xx, sane `staleTime`, global error handler → toast.
4. **Observability** (`REL-4`): Sentry for client and Edge Function errors,
   plus an ingest heartbeat — if no `health_export` metric arrives for 48h,
   surface it in Settings and notify. A silent integration failure is the
   single most likely way this system rots.

## Phase 4 — Test harness

1. **Integration tests** against a real Supabase test project (or local
   `supabase start`). The bugs worth catching:
   - RLS genuinely isolates two users (would have caught SEC-1),
   - the outbox drains and is idempotent,
   - snapshot rules hold — editing a food never rewrites past logs,
   - deload sessions stay excluded from PRs and e1RM (rule 8).
2. **Playwright E2E** on three flows: sign in; start → log sets → finish a
   workout; search → log a food. Run against a seeded test DB.
3. Extend `.github/workflows/ci.yml` (already runs typecheck/lint/test/build)
   with the integration and E2E jobs and the test-DB secrets.

## Phase 5 — The AI insight layer *(the payoff)*

1. **Context assembly** — reuse Phase 2's collector, adding derived features
   the model shouldn't have to compute: rolling baselines, deltas vs 90-day
   norms, streaks, adherence, and an explicit **inventory of what's missing**
   so the model can ask rather than guess.
2. **`supabase/functions/insights`** — verify JWT, assemble context, call the
   Claude API, persist to a new `insights` table (so past reviews are readable
   and cheap to re-open). Zod-validate the response shape.
3. **`/insights` route** — weekly review, on-demand "analyse this", and
   inline "I can't answer that without X" prompts that deep-link to the right
   logging screen.
4. **Scheduling** — weekly generation via `pg_cron` or a Vercel cron route.
5. **Cost control** — cap context size, cache by data-version so an unchanged
   week never re-bills.

*Prerequisite: an `ANTHROPIC_API_KEY` as an Edge Function secret. Phases 1–4
should land first — an insight engine reading from an unreliable, unexportable,
untested store is a fast way to trust wrong conclusions.*

## Phase 6 — Performance & product polish

1. `(select auth.uid())` across all 36 policies (`PERF-1`) — one migration.
2. Indexes for the 10 unindexed FKs (`PERF-2`).
3. Convert `daily_rollup` to a materialized view with scheduled refresh **only
   if** measurement shows it's needed (0001 §11's own threshold: >200ms).
4. Dashboard reads `water_ml` / `caffeine_mg` / `readiness_score` from the
   rollup instead of separate queries.
5. Expand correlations now that readiness, hydration and caffeine timing exist
   — caffeine-after-2pm vs sleep is the one most likely to tell you something.
6. Remaining roadmap Wave 2: soreness UI, training phase, PR detection.
7. Full supplement intake UI (time, with-food, skip-with-reason).

---

# Part 3 — What I need from you

### Immediately (Phase 1)
- [ ] **Disable public sign-ups** — Supabase → Authentication → Providers →
      Email → turn off "Enable sign-ups". Tell me once done and I'll remove the
      dead UI.
- [ ] **Enable leaked-password protection** — Authentication → Policies.
- [ ] **Confirm whether "Confirm email" is on or off** — determines how exposed
      sign-up currently is.

### Phase 2
- [ ] **Confirm your Supabase plan** (free vs pro) so I can size the backup gap.

### Phase 4
- [ ] Decide: a **second Supabase project** for tests, or **local `supabase start`**
      in CI. Local is free and hermetic; a real project catches
      hosted-environment differences. My recommendation: local for CI, and I'll
      note the difference where it matters.

### Phase 5
- [ ] **`ANTHROPIC_API_KEY`** as a Supabase Edge Function secret.
- [ ] A rough **monthly spend ceiling** for AI calls so I can size context and
      caching to it.

### Still outstanding from earlier
- [ ] Strava secrets + callback domain.
- [ ] Change your password off `PerfHub-2026-temp`.
- [ ] Settings → Profile: height, birth date, sex, goals.
- [ ] Food → Supps: seed your stack.

---

# Definition of done

The system is "productionized" for your purposes when:

1. Supabase's security advisor reports zero ERROR findings.
2. One command produces a complete, restorable export of everything.
3. Any failed write is visible to you at the moment it fails, and recoverable.
4. Any silent integration failure alerts within 48 hours.
5. CI runs unit + integration + E2E on every push, and a red build blocks deploy.
6. Every screen has a real loading, empty, and error state.
7. The AI layer can answer a question about your last 90 days and correctly
   name what it doesn't know.

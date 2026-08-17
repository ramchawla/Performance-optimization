# Domain Roadmap — the whole physical portfolio

Living document. `TECHNICAL-DESIGN.md` owns *how* things are built; this owns
*what* the system should eventually cover and why. Nothing here is implemented
unless it says so.

Three parts:
1. **Audit** — what's incomplete in what already exists.
2. **Domain map** — every facet of physical health worth tracking.
3. **Field-level detail** — per category, everything an AI could leverage.

Plus a running **What I need from you** list at the bottom.

---

# Part 1 — Audit of the current system

Same lens you used: things that look present but aren't wired, or are wired but
don't do what they appear to. Each was verified against the code, not guessed.

## A. Data-integrity bugs (fix before more data accumulates)

**1. Meal timestamps are wrong on backdated entries.** `useLogFood`
(`lib/queries/nutrition.ts:19`) never sets `logged_at`, so it falls to the DB
default `now()`. Log Tuesday's dinner on Thursday and it's stamped Thursday.
`log_date` is right, `logged_at` is a lie — and `useDailyLog` orders by it
(`:85`), so backfilled meals sort wrong within a day. This is also exactly the
meal-timing gap you named: **the column exists, nothing writes to it.**

**2. Unit preference is decorative.** `profiles.unit_weight` is *displayed* in
Settings (`app/(main)/settings/page.tsx:240`) but there's no way to change it,
and both `app/(main)/body/photos/page.tsx:9` and
`app/(main)/train/templates/[id]/page.tsx:19` hardcode `const WEIGHT_UNIT = "lb"`.
Flipping the profile to kg would change one label and nothing else.

**3. `profiles.timezone` is never read anywhere.** Every date is computed from
the browser's local timezone. Fine while you're in one place; wrong the moment
you travel, and CLAUDE.md rule 5 explicitly hangs date attribution on the
user's timezone.

## B. Schema exists, no UI (data you literally cannot enter)

**4. Cardio.** `cardio_sessions` is read by the dashboard and now written by
Strava — but there is **no manual logging UI at all**. A run without a watch,
a bike commute, a swim: unrecordable.

**5. Soreness.** `soreness_logs` has a full `joint_site` enum (14 sites),
severity, session linkage — and **zero UI**. It's in the offline outbox table
list, so it was clearly intended.

**6. Profile fields with no editor.** `height_cm`, `birth_date`, `sex`,
`goal_weight_kg`, `goal_body_fat_pct`, `display_name`. Height and age gate
every body-composition formula (Navy body fat, BMR, FFMI); goals gate every
"are you on track" statement.

## C. Features implied but absent

**7. No PR detection.** `lib/calc/e1rm.ts` is fully built and tested, but only
feeds dashboard sparklines. Nothing ever tells you "that was a PR." CLAUDE.md
rule 8 goes out of its way to say deloads are excluded from PRs — from a PR
system that doesn't exist.

**8. No retroactive workout logging.** A session stamps `started_at` at the
moment you tap start. There's no way to record yesterday's lift, or fix a
session you forgot to end.

**9. No data export.** For a system meant to last decades this is the single
biggest structural gap. One `npm run` away from a full JSON/CSV dump would
also make feeding history to an AI trivial.

**10. No AI insights surface.** The stated purpose of the whole system. The
dashboard has a two-pair correlation card gated at n≥20 and nothing else.

**11. Auth is still the temporary password shim.** `components/auth/SignInForm.tsx:7`
says so itself. Worse, it falls back to `signUp` on *any* sign-in error, which
is what produced the misleading "User already registered" on your phone — a
wrong password reports as an account problem.

## D. Correcting two things I assumed were broken

I checked rather than claiming — both are fine:
- **Recipes are fully loggable** (`useLogRecipe`, `lib/queries/recipes.ts:68`).
- **Micronutrients are summed and displayed** (`components/food/MacroSummary.tsx:65`),
  not write-only as I first suspected.

---

# Part 2 — Domain map

What a complete physical portfolio covers. Tiered by how much signal each adds
relative to the effort of logging it.

## Tier 0 — Have it

Training · Nutrition (macros + micros) · Sleep · Mobility · Body composition ·
Progress photos · Passive health metrics (HRV, RHR, steps, active energy)

## Tier 1 — High signal, low effort, missing

| Domain | Why it earns its place |
| --- | --- |
| **Hydration** | You asked. Drives weight noise, RHR, perceived energy, and lifting performance. Cheap to log. |
| **Supplementation** | You asked. Without dose + timing + adherence, no supplement's effect is ever assessable. |
| **Daily readiness check-in** | 20 seconds: energy, mood, motivation, stress, soreness. The single highest insight-per-second item in the whole system — it's the subjective layer every objective number gets interpreted against. |
| **Caffeine & alcohol** | The two largest confounders of sleep and HRV that exist. Tracking sleep without them is tracking noise. |
| **Cardio (manual)** | Schema is already there (§B4). |
| **Soreness & pain** | Schema is already there (§B5). Also the natural trigger for the mobility presets. |
| **Injury log** | Distinct from soreness: persistent, has a start date, a diagnosis, a rehab protocol, and a return-to-full-load date. This is what turns "my knee hurts" into a tracked arc. |
| **Training phase / goal context** | Bulk, cut, maintenance, peak, deload block. Without it every trend is uninterpretable — losing weight is good or bad depending on the phase. |

## Tier 2 — Substantial signal

| Domain | Notes |
| --- | --- |
| **Sports & skill sessions** | You named it. Different shape from lifting: duration, intensity, position, competition vs practice, contact load. |
| **Recovery modalities** | Sauna, cold, massage, compression, naps. Each has a claimed effect that's testable only if logged. |
| **Blood pressure** | Conspicuously missing from a health app. Cheap cuff, huge clinical weight. |
| **Performance benchmarks** | Vertical jump, grip strength, sprint, plank, sit-and-reach, VO2max. Periodic, not daily — the objective counterweight to how you feel. |
| **Digestion / GI** | Bristol scale, bloating, suspected food reactions. Closes the loop on nutrition. |
| **Stress & mental load** | Work hours, perceived stress, meditation. Physically expressed via HRV and sleep. |
| **Illness log** | Sick days, symptoms, fever, duration. Explains the HRV crater you'd otherwise puzzle over. |
| **Medication** | Separate from supplements: prescriptions, adherence, side effects. |
| **Sun / outdoor / light exposure** | Circadian anchor and vitamin D proxy. |
| **Travel & timezone shifts** | Explains multi-day sleep and readiness disruption. |

## Tier 3 — Periodic / long-horizon

Bloodwork & biomarkers (you flagged — out of scope, slot designed below) ·
Preventive care & screenings · Vaccinations · Dental · Vision & hearing ·
Respiratory + allergies + air quality · Skin/hair/nails · Movement screen &
postural assessment · DEXA / BIA scans · Gear mileage (running shoe mileage is
a genuine injury predictor) · Environment (altitude, heat, humidity)

## Cross-cutting principles

These matter more than any individual field:

1. **Timestamp everything.** Your meal-timing instinct generalizes. A value
   without a time is half a data point — it can't participate in any
   within-day, sequencing, or interval analysis.
2. **Pair every objective number with a subjective one.** HRV plus "how do you
   feel" is far more than twice as useful as either alone.
3. **Distinguish "zero" from "not recorded".** Nullable everywhere. `0` water
   means you drank none; `null` means you didn't log. Conflating them poisons
   every average.
4. **Record provenance.** `metric_source` already does this — keep it on
   everything new. Manual, device, and derived values need different trust.
5. **Everything optional.** Your stated model: room for everything, obligation
   for nothing, with the AI coach prompting for what's missing when it would
   change an answer.
6. **Free-text notes on every entity.** The catch-all that captures what no
   schema anticipated — and LLMs read it natively.

---

# Part 3 — Field-level detail

The "meal timing lens" applied to each domain: everything worth capturing,
whether or not it's ever filled in.

## 3.1 Nutrition (extending what exists)

**Per entry:** `logged_at` *(exists, unwritten — see §A1)* · time eaten ·
duration of the meal · hunger before (1–5) · fullness after (1–5) ·
satisfaction/enjoyment (1–5) · eating speed · location (home/work/restaurant/
travel) · social context (alone/with others) · prepared by (self/restaurant/
packaged) · portion confidence (weighed / measured / eyeballed) · was it
planned or a deviation · craving or emotional trigger · digestive response
(0–3 hrs later) · energy response

**Derived free once times exist:** fasting window length · eating window
(first→last meal) · pre/post-workout timing deltas · late-night eating
frequency · meal spacing regularity · protein distribution across the day
(matters more than daily total for MPS)

**Per day:** adherence vs target · diet protocol in effect (IF, low-carb, etc.)
· refeed/cheat day flag

## 3.2 Hydration

**Per entry:** time · volume (ml) · type (water / electrolyte / coffee / tea /
juice / soda / alcohol / other) · caffeine mg · alcohol units · sodium mg ·
temperature (some people drink far less cold water in winter) · context (with
meal / during training / on waking)

**Per day:** total ml · total caffeine · time of first and last caffeine
*(the sleep-relevant one)* · total alcohol · urine color (1–8 chart) as a
hydration proxy · thirst rating

## 3.3 Supplementation

**Per supplement (definition):** name · brand · form (capsule/powder/liquid/
gummy) · dose per unit + unit · active ingredients breakdown · purpose/reason ·
cost per serving · start date · planned cycle (on/off weeks) · timing rule
(with food, empty stomach, pre-bed, pre-workout) · prescribing source (self,
doctor, coach)

**Per intake:** timestamp · dose taken · taken with food · skipped (+ reason)

**Derived:** adherence % over any window · cumulative intake · overlap
detection (two products both containing magnesium) · upper-limit warnings ·
cost per month · effect windows for correlation (did HRV move after week 3 of
creatine?)

## 3.4 Daily readiness check-in

One screen, morning. Every field 1–5 or 1–10:

energy · mood · motivation to train · perceived stress · overall soreness ·
sleep quality (already in sleep) · mental clarity · appetite · libido *(a real
and underrated recovery/hormonal marker)* · joint stiffness · illness symptoms
(none/mild/moderate/severe) · readiness self-score · free-text note

**Derived:** readiness vs actual session performance · which inputs predict a
good session for *you* specifically · rolling baseline and deviation

## 3.5 Training (extending what exists)

**Per session:** `started_at`/`completed_at` *(exist)* · **time of day** *(you
asked — derivable from `started_at` once retroactive logging exists)* ·
location/gym · training partner · pre-workout nutrition timing · pre-workout
caffeine · session RPE (overall, 1–10) · perceived quality vs expectation ·
energy before / after · sleep the night before (auto-joinable) · body weight
that day (auto-joinable) · environment (temp, crowded) · music/no music ·
warm-up done · time-constrained flag

**Per exercise:** existing targets + actuals · tempo · range-of-motion note ·
form quality (1–5) · pain during (0–3 + site) · assistance/spotter · failure
reached · technique cue that worked

**Per set:** existing reps/weight/RPE · rest taken before the set *(actual, not
target — the single most-skipped variable in lifting logs)* · bar speed if ever
measured · drop-set/cluster/myo-rep markers

**Derived once present:** volume load, tonnage, per-muscle weekly sets ·
e1RM trends *(calc exists)* · **PR detection** *(missing — §C7)* · fatigue
index within a session · time-of-day performance effect · rest-to-performance
relationship

## 3.6 Cardio & conditioning

type (run/bike/swim/row/ruck/walk/HIIT) · start time · duration · distance ·
elevation · avg + max HR · HR zone distribution · pace/splits · perceived
effort · terrain/surface · indoor vs outdoor · weather + temp · shoes used
*(mileage tracking)* · fasted or fed · purpose (recovery/base/intervals/race) ·
post-session feel

**Derived:** weekly load, acute:chronic ratio, zone balance, aerobic decoupling,
pace-at-HR drift over months (the cleanest fitness signal there is)

## 3.7 Sports & skill

sport · session type (practice/scrimmage/competition/skills/film) · duration ·
minutes actually active · position · intensity (1–10) · contact level · score/
result · what went well / what didn't · specific skills drilled · injuries or
near-misses · teammates/opponents level · surface · equipment

## 3.8 Recovery modalities

modality (sauna/cold plunge/massage/foam roll/compression/nap/stretch/
meditation/breathwork) · start time · duration · intensity (temp for sauna/cold,
pressure for massage) · pre/post training or standalone · subjective effect
(1–5) · cost

## 3.9 Soreness, pain & injury

**Soreness (transient, per day):** site *(the `joint_site` enum exists)* ·
severity 1–5 · onset (during/after/next day) · movement-limiting (y/n) ·
attributed session

**Injury (persistent entity):** name/diagnosis · site + side · onset date ·
mechanism · severity trajectory over time · imaging/diagnosis source ·
practitioner · rehab protocol · rehab adherence · pain at rest vs under load ·
loads/movements to avoid · return-to-full-load date · recurrence flag

This is the one that most needs to be an entity with a lifecycle rather than a
daily row — an injury is a story, not a measurement.

## 3.10 Body composition (extending)

existing weight/waist/neck/hip/body-fat + method · **time of day weighed**
(morning fasted vs evening is a 2kg swing) · fasted flag · post-void flag ·
more girths: chest, shoulders, arm L/R, forearm L/R, thigh L/R, calf L/R ·
scan results (DEXA/BodPod/BIA) with lean mass, fat mass, visceral fat, bone
density · derived: FFMI, waist-to-height, Navy body fat *(needs height — §B6)*

## 3.11 Vitals & biomarkers

**Regular:** blood pressure (systolic/diastolic/pulse, arm, position, time) ·
resting HR *(have)* · HRV *(have)* · respiratory rate · SpO2 · body temp ·
VO2max · blood glucose (if ever CGM)

**Periodic (bloodwork — designed now, built later):** panel date · lab · fasted
· full marker set with value + unit + reference range + flag · PDF attachment ·
ordering doctor · notes. The design requirement is simply that the schema store
*arbitrary named markers with ranges*, so a new panel never needs a migration.

## 3.12 Environment & context

daily: outdoor time · sunlight exposure · air quality · altitude · ambient
temp · travel/timezone change · schedule disruption · work hours · screen time
before bed

---

# Part 4 — Build order

**Wave 1 — ✅ DONE** (migration `0004`, routes `/food/water`, `/food/supplements`,
`/readiness`, `/train/cardio`)

- ✅ `logged_at` written on every meal, with a time field in the log form and
  times shown in the daily list. Backfilled days default to midday rather than
  `now()`, so a meal can no longer land on the wrong date.
- ✅ Workout time-of-day + retroactive: date/time/duration editor on the
  session detail page. Moving a session re-invalidates training-day targets.
- ✅ Hydration: per-drink logging with time, type, caffeine, alcohol, sodium
  and context; one-tap quick volumes; daily totals including last-caffeine time.
- ✅ Supplementation: stack definitions + per-intake logging with dose
  snapshotting, 30-day adherence, retire-don't-delete.
- ✅ Manual cardio logging with pace/distance derivation.
- ✅ Readiness check-in (promoted from Wave 2): nine 1–5 ratings, illness,
  notes, derived 1–10 score.
- ✅ Units setting made real (`useUnits`) — no more hardcoded `"lb"`.
- ✅ Profile editor: height, birth date, sex, goal weight, goal body fat.
- ✅ Auth: sign-in and sign-up separated (no more misleading "already
  registered"), forgot-password flow, `/reset-password` page.

**Wave 2 — the rest of the cheap high-signal layer**
Soreness UI (`soreness_logs` still has no interface) · training phase context ·
data export · PR detection

**Wave 3 — depth**
Injury lifecycle · recovery modalities · sports sessions · blood pressure ·
performance benchmarks · PR detection · richer per-set training fields

**Wave 4 — the payoff**
The AI insight surface that consumes all of it · bloodwork ingestion ·
productization concerns (multi-user is already schema-safe)

---

# What I need from you

Running list. Nothing here is blocked on me.

### Open now
- [ ] **Strava secrets** — Supabase → Project Settings → Edge Functions → Secrets:
      `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_STATE_SECRET` (any long
      random string), `APP_URL`. Then set the Strava app's **Authorization
      Callback Domain** to `knkgfdeygcecwkcjzthg.supabase.co`.
      Until then `/settings` shows "Status unavailable".
- [ ] **Change your password** — Settings → Account. `PerfHub-2026-temp` is still live.
- [ ] **Say when to commit + push** — the last batch of work is unpushed, so
      Vercel is still serving the old build.

### Data only you can enter (all have UI now)
- [ ] **Profile** — Settings → Profile: height, birth date, sex. Body fat,
      BMR and FFMI stay uncomputable until these exist.
- [ ] **Goals** — Settings → Profile: goal weight and goal body fat.
- [ ] **Supplement stack** — Food → Supps: name, dose, timing for each.
      Adherence tracking starts from the day you add them.
- [ ] **Verify a Supabase email template exists** for password recovery
      (Authentication → Email Templates → Reset Password). The forgot-password
      flow depends on it; the rest of the auth work doesn't.

### Next decisions
- [ ] **Wave 2 scope** — soreness UI, training phase, data export, PR
      detection. My order: data export first (it's the one that protects
      everything else), then training phase (it makes every trend readable).
- [ ] **Injury log** — worth building as a lifecycle entity now, given
      jumper's knee / rounded shoulders / APT are already live concerns?

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile, useUpdateProfile } from "@/lib/queries/settings";
import { count as outboxCount } from "@/lib/sync/outbox";
import { kcalFromMacros, scaleMacrosToKcal, type Macros } from "@/lib/calc/macros";
import { displayWeightKg, inputToKg } from "@/lib/units";
import type { WeightUnit } from "@/lib/queries/units";
import {
  useHealthExportStatus,
  useStravaConnect,
  useStravaDisconnect,
  useStravaStatus,
  useStravaSync,
} from "@/lib/queries/integrations";
import { useQuery } from "@tanstack/react-query";

// Kinetic direction: same tokens as the rest of the app, motion carries the
// personality. Spring overshoot for the toggle thumb, a smooth ease for
// expand/collapse + color transitions. Both are plain Tailwind arbitrary
// values — no keyframes needed for transition-based motion.
const EASE_SPRING = "ease-[cubic-bezier(0.34,1.56,0.64,1)]";
const EASE_SMOOTH = "ease-[cubic-bezier(0.16,1,0.3,1)]";

const MACRO_FIELDS: { key: keyof Macros; label: string }[] = [
  { key: "proteinG", label: "Protein" },
  { key: "carbsG", label: "Carbs" },
  { key: "fatG", label: "Fat" },
];

/**
 * Calories and macros are one number expressed two ways. Typing a macro
 * re-derives calories; typing calories rescales the macros proportionally.
 * There is deliberately no way to save a split that doesn't add up.
 */
function TargetFields({
  idPrefix,
  label,
  value,
  onMacroChange,
  onKcalChange,
}: {
  idPrefix: string;
  label: string;
  value: Macros;
  onMacroChange: (key: keyof Macros, value: number) => void;
  onKcalChange: (kcal: number) => void;
}) {
  const kcal = kcalFromMacros(value);
  return (
    <div>
      <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <label htmlFor={`${idPrefix}-kcal`} className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
        Calories
      </label>
      <input
        id={`${idPrefix}-kcal`}
        type="number"
        inputMode="numeric"
        value={kcal}
        onChange={(e) => onKcalChange(Number(e.target.value))}
        className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none"
      />
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {MACRO_FIELDS.map((field) => (
          <div key={field.key}>
            <label
              htmlFor={`${idPrefix}-${field.key}`}
              className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted"
            >
              {field.label}
            </label>
            <input
              id={`${idPrefix}-${field.key}`}
              type="number"
              inputMode="numeric"
              value={value[field.key]}
              onChange={(e) => onMacroChange(field.key, Number(e.target.value))}
              className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {value.proteinG}p × 4 + {value.carbsG}c × 4 + {value.fatG}f × 9 = {kcal} kcal
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 font-display text-xs font-bold uppercase tracking-wide text-muted/80">
      {children}
    </p>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-300 ${EASE_SMOOTH} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent ${
        on ? "bg-accent-dim/40" : "bg-surface-raised"
      }`}
    >
      <span
        className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full transition-[transform,background-color] duration-[320ms] ${EASE_SPRING} ${
          on ? "translate-x-[18px] bg-accent" : "translate-x-0 bg-fg/70"
        }`}
      />
    </button>
  );
}

export default function Page() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const { data: pending } = useQuery({
    queryKey: ["outbox", "pending-count"],
    queryFn: outboxCount,
    refetchInterval: 5000,
  });

  const [draft, setDraft] = useState<{ rest: Macros; training: Macros | null }>({
    rest: { proteinG: 0, carbsG: 0, fatG: 0 },
    training: null,
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  function openEdit() {
    if (!profile) return;
    setDraft({
      rest: {
        proteinG: profile.target_protein_g ?? 0,
        carbsG: profile.target_carbs_g ?? 0,
        fatG: profile.target_fat_g ?? 0,
      },
      training:
        profile.target_calories_training_day === null
          ? null
          : {
              proteinG: profile.target_protein_training_day_g ?? 0,
              carbsG: profile.target_carbs_training_day_g ?? 0,
              fatG: profile.target_fat_training_day_g ?? 0,
            },
    });
    setEditing(true);
  }

  /** Editing a macro re-derives calories; the two can never drift apart. */
  function setMacro(which: "rest" | "training", key: keyof Macros, value: number) {
    setDraft((d) => {
      const current = which === "rest" ? d.rest : d.training;
      if (!current) return d;
      return { ...d, [which]: { ...current, [key]: Math.max(0, value) } };
    });
  }

  /** Editing calories rescales the split, holding each macro's share constant. */
  function setKcal(which: "rest" | "training", kcal: number) {
    setDraft((d) => {
      const current = which === "rest" ? d.rest : d.training;
      if (!current) return d;
      const scaled = scaleMacrosToKcal(current, kcal);
      return scaled ? { ...d, [which]: scaled } : d;
    });
  }

  function toggleTrainingDay() {
    // Seed the training set from the rest-day one — it's always a delta off it.
    setDraft((d) => ({ ...d, training: d.training ? null : { ...d.rest } }));
  }

  function handleSave() {
    updateProfile.mutate(
      {
        target_calories: kcalFromMacros(draft.rest),
        target_protein_g: draft.rest.proteinG,
        target_carbs_g: draft.rest.carbsG,
        target_fat_g: draft.rest.fatG,
        target_calories_training_day: draft.training ? kcalFromMacros(draft.training) : null,
        target_protein_training_day_g: draft.training?.proteinG ?? null,
        target_carbs_training_day_g: draft.training?.carbsG ?? null,
        target_fat_training_day_g: draft.training?.fatG ?? null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => {
            setEditing(false);
            setSaved(false);
          }, 900);
        },
      }
    );
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  if (profileLoading || !profile) {
    return (
      <main className="space-y-4 p-4">
        <div className="h-8 w-32 animate-pulse rounded bg-surface-raised" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface-raised" />
      </main>
    );
  }

  return (
    <main className="animate-enter space-y-7 p-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          {profile.display_name ?? "—"} · {profile.unit_weight === "lb" ? "Imperial (lb)" : "Metric (kg)"}
        </p>
      </div>

      <section>
        <SectionLabel>Profile</SectionLabel>
        <div className="rounded-2xl border border-surface-raised bg-surface p-4">
          <ProfileForm profile={profile} />
        </div>
      </section>

      <section>
        <SectionLabel>Nutrition targets</SectionLabel>
        <div className="rounded-2xl border border-surface-raised bg-surface p-4">
          {!editing && (
            <>
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <span className="font-display text-[34px] font-bold leading-none text-fg">
                    {profile.target_calories ?? "—"}
                  </span>
                  <span className="ml-1 text-xs text-muted">kcal / day</span>
                </div>
                <button
                  type="button"
                  onClick={openEdit}
                  className="rounded-md border border-surface-raised px-3 py-1.5 text-xs font-semibold text-fg/80 transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[10px] bg-bg px-2 py-3 text-center">
                  <div className="font-mono text-[17px] font-bold text-accent">{profile.target_protein_g ?? "—"}g</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">Protein</div>
                </div>
                <div className="rounded-[10px] bg-bg px-2 py-3 text-center">
                  <div className="font-mono text-[17px] font-bold text-[#5b8fd6]">{profile.target_carbs_g ?? "—"}g</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">Carbs</div>
                </div>
                <div className="rounded-[10px] bg-bg px-2 py-3 text-center">
                  <div className="font-mono text-[17px] font-bold text-[#e0a63b]">{profile.target_fat_g ?? "—"}g</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">Fat</div>
                </div>
              </div>
              {profile.target_calories_training_day !== null && (
                <p className="mt-3 text-center text-[11px] text-muted">
                  Training day: {profile.target_calories_training_day} kcal · {profile.target_protein_training_day_g}p /{" "}
                  {profile.target_carbs_training_day_g}c / {profile.target_fat_training_day_g}f
                </p>
              )}
            </>
          )}

          {/* grid-template-rows expand/collapse trick, ported from the mockup */}
          <div
            className={`grid transition-[grid-template-rows] duration-[320ms] ${EASE_SMOOTH} ${
              editing ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <TargetFields
                idPrefix="rest"
                label="Rest day"
                value={draft.rest}
                onMacroChange={(k, v) => setMacro("rest", k, v)}
                onKcalChange={(v) => setKcal("rest", v)}
              />

              <div className="mt-5 flex items-center justify-between border-t border-surface-raised pt-4">
                <div>
                  <span className="text-sm font-medium text-fg">Separate training-day targets</span>
                  <div className="mt-0.5 text-xs text-muted">Applied on any day with a logged workout</div>
                </div>
                <Toggle on={draft.training !== null} onToggle={toggleTrainingDay} label="Separate training-day targets" />
              </div>

              {draft.training && (
                <div className="mt-4">
                  <TargetFields
                    idPrefix="training"
                    label="Training day"
                    value={draft.training}
                    onMacroChange={(k, v) => setMacro("training", k, v)}
                    onKcalChange={(v) => setKcal("training", v)}
                  />
                </div>
              )}

              {/* Save button: label morphs into a checkmark via cross-fade, not a route/dialog change */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saved || updateProfile.isPending}
                className={`relative mt-4 w-full overflow-hidden rounded-lg py-3 text-sm font-bold text-bg transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent ${
                  saved ? "bg-accent-dim" : "bg-accent"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center gap-1.5 transition-[transform,opacity] duration-[280ms] ${EASE_SPRING} ${
                    saved ? "-translate-y-2 scale-90 opacity-0" : "translate-y-0 scale-100 opacity-100"
                  }`}
                >
                  {updateProfile.isPending ? "Saving…" : "Save targets"}
                </span>
                <span
                  className={`absolute inset-0 flex items-center justify-center gap-1.5 transition-[transform,opacity] duration-[280ms] ${EASE_SPRING} ${
                    saved ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-90 opacity-0"
                  }`}
                >
                  Saved ✓
                </span>
              </button>
              {updateProfile.isError && (
                <p className="mt-2 text-center text-xs text-red-400">Failed to save — try again.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Sync</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-surface-raised bg-surface">
          {/* Anything logged offline queues locally first; this is that queue's depth. */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center">
              <span className="relative mr-2 inline-block h-[7px] w-[7px] rounded-full bg-accent">
                {pending !== undefined && pending > 0 && (
                  <span className="animate-sync-ping absolute -inset-1 rounded-full border border-accent" />
                )}
              </span>
              <div>
                <span className="text-sm font-medium text-fg">
                  {pending && pending > 0 ? `Uploading ${pending} change${pending === 1 ? "" : "s"}` : "All changes saved"}
                </span>
                <div className="mt-0.5 text-xs text-muted">
                  {pending && pending > 0
                    ? "Logged on this device, not yet in the cloud"
                    : "Nothing waiting to upload"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Integrations</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-surface-raised bg-surface">
          <StravaRow />
          <AppleHealthRow />
        </div>
      </section>

      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-surface-raised bg-surface p-4">
          <ChangePasswordForm />
        </div>
      </section>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-2 w-full rounded-xl border border-red-900/50 py-3.5 text-sm font-semibold text-red-400 transition-colors duration-150 hover:bg-red-500/10 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-red-400"
      >
        Sign out
      </button>

      <p className="text-center font-mono text-[11px] text-muted/50">PERFORMANCE HUB</p>
    </main>
  );
}

const PROFILE_FIELD =
  "w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg focus-visible:border-accent focus-visible:outline-none";
const PROFILE_LABEL = "mb-1 block text-[11px] uppercase tracking-wide text-muted";

/**
 * Height, birth date and sex aren't vanity fields — Navy body fat, BMR and
 * FFMI are all uncomputable without them. Goals are what turn a trend line
 * into "on track" or "not".
 */
function ProfileForm({ profile }: { profile: NonNullable<ReturnType<typeof useProfile>["data"]> }) {
  const updateProfile = useUpdateProfile();
  const weightUnit: WeightUnit = profile.unit_weight === "kg" ? "kg" : "lb";

  const [draft, setDraft] = useState(() => ({
    displayName: profile.display_name ?? "",
    unitWeight: weightUnit,
    unitDistance: profile.unit_distance === "km" ? "km" : "mi",
    heightCm: profile.height_cm === null ? "" : String(profile.height_cm),
    birthDate: profile.birth_date ?? "",
    sex: profile.sex ?? "",
    goalWeight:
      profile.goal_weight_kg === null
        ? ""
        : String(Math.round(displayWeightKg(profile.goal_weight_kg, weightUnit)! * 10) / 10),
    goalBodyFat: profile.goal_body_fat_pct === null ? "" : String(profile.goal_body_fat_pct),
  }));
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate(
      {
        display_name: draft.displayName.trim() || null,
        unit_weight: draft.unitWeight,
        unit_distance: draft.unitDistance,
        height_cm: draft.heightCm ? Number(draft.heightCm) : null,
        birth_date: draft.birthDate || null,
        sex: draft.sex || null,
        // Goal weight is typed in display units and stored in kg (rule 1).
        goal_weight_kg: draft.goalWeight ? inputToKg(Number(draft.goalWeight), draft.unitWeight) : null,
        goal_body_fat_pct: draft.goalBodyFat ? Number(draft.goalBodyFat) : null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 1200);
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="p-name" className={PROFILE_LABEL}>
          Name
        </label>
        <input
          id="p-name"
          value={draft.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          className={PROFILE_FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="p-uw" className={PROFILE_LABEL}>
            Weight units
          </label>
          <select
            id="p-uw"
            value={draft.unitWeight}
            onChange={(e) => set("unitWeight", e.target.value as WeightUnit)}
            className={PROFILE_FIELD}
          >
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>
        <div>
          <label htmlFor="p-ud" className={PROFILE_LABEL}>
            Distance units
          </label>
          <select
            id="p-ud"
            value={draft.unitDistance}
            onChange={(e) => set("unitDistance", e.target.value)}
            className={PROFILE_FIELD}
          >
            <option value="mi">Miles</option>
            <option value="km">Kilometres</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="p-height" className={PROFILE_LABEL}>
            Height (cm)
          </label>
          <input
            id="p-height"
            type="number"
            inputMode="numeric"
            value={draft.heightCm}
            onChange={(e) => set("heightCm", e.target.value)}
            className={PROFILE_FIELD}
          />
        </div>
        <div>
          <label htmlFor="p-dob" className={PROFILE_LABEL}>
            Born
          </label>
          <input
            id="p-dob"
            type="date"
            value={draft.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
            className={PROFILE_FIELD}
          />
        </div>
        <div>
          <label htmlFor="p-sex" className={PROFILE_LABEL}>
            Sex
          </label>
          <select id="p-sex" value={draft.sex} onChange={(e) => set("sex", e.target.value)} className={PROFILE_FIELD}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="p-goalw" className={PROFILE_LABEL}>
            Goal weight ({draft.unitWeight})
          </label>
          <input
            id="p-goalw"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={draft.goalWeight}
            onChange={(e) => set("goalWeight", e.target.value)}
            className={PROFILE_FIELD}
          />
        </div>
        <div>
          <label htmlFor="p-goalbf" className={PROFILE_LABEL}>
            Goal body fat (%)
          </label>
          <input
            id="p-goalbf"
            type="number"
            step="0.1"
            inputMode="decimal"
            value={draft.goalBodyFat}
            onChange={(e) => set("goalBodyFat", e.target.value)}
            className={PROFILE_FIELD}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={updateProfile.isPending}
        className="min-h-11 w-full rounded-lg bg-accent py-2.5 text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
      >
        {updateProfile.isPending ? "Saving…" : saved ? "Saved ✓" : "Save profile"}
      </button>
      {updateProfile.isError && <p className="text-center text-xs text-red-400">Failed to save — try again.</p>}
    </form>
  );
}

function IntegrationShell({
  initials,
  name,
  status,
  connected,
  isLast,
  children,
}: {
  initials: string;
  name: string;
  status: string;
  connected: boolean;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`px-4 py-3.5 ${isLast ? "" : "border-b border-surface-raised"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-sm font-bold transition-colors duration-300 ${
              connected ? "bg-accent/10 text-accent" : "bg-bg text-muted"
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-fg">{name}</div>
            <div className={`mt-0.5 text-xs ${connected ? "text-accent" : "text-muted"}`}>{status}</div>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">{children}</div>
      </div>
    </div>
  );
}

const SMALL_BTN =
  "min-h-11 rounded-md border border-surface-raised px-3 text-xs font-semibold text-fg/80 transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-50";

function StravaRow() {
  const { data: status, isLoading, error } = useStravaStatus();
  const connect = useStravaConnect();
  const disconnect = useStravaDisconnect();
  const sync = useStravaSync();

  const connected = status?.connected ?? false;
  const statusText = isLoading
    ? "Checking…"
    : error
      ? "Status unavailable"
      : connected
        ? sync.isSuccess
          ? `Imported ${sync.data.imported} of ${sync.data.fetched} activities`
          : "Connected"
        : "Not connected";

  return (
    <IntegrationShell initials="S" name="Strava" status={statusText} connected={connected}>
      {connected ? (
        <>
          <button type="button" onClick={() => sync.mutate()} disabled={sync.isPending} className={SMALL_BTN}>
            {sync.isPending ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className={SMALL_BTN}
          >
            Disconnect
          </button>
        </>
      ) : (
        <button type="button" onClick={() => connect.mutate()} disabled={connect.isPending} className={SMALL_BTN}>
          {connect.isPending ? "Opening…" : "Connect"}
        </button>
      )}
    </IntegrationShell>
  );
}

/**
 * Apple Health has no web API — the Shortcut posting to ingest-health is the
 * only route in, so there is nothing to "connect". Show when data last
 * arrived instead of a button that couldn't do anything.
 */
function AppleHealthRow() {
  const { data } = useHealthExportStatus();
  const last = data?.lastMetricAt;
  return (
    <IntegrationShell
      initials="A"
      name="Apple Health"
      connected={!!last}
      isLast
      status={
        last
          ? `Last delivery ${new Date(last).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : "No data received yet"
      }
    >
      <span className="self-center text-[11px] text-muted">via Shortcut</span>
    </IntegrationShell>
  );
}

function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setResult({ ok: false, message: "Use at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setResult({ ok: false, message: "Those don't match." });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setResult({ ok: false, message: error.message });
      return;
    }
    setPassword("");
    setConfirm("");
    setResult({ ok: true, message: "Password updated." });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <p className="font-display text-[11px] font-bold uppercase tracking-wide text-muted">Change password</p>
      <input
        type="password"
        autoComplete="new-password"
        placeholder="New password"
        aria-label="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 text-[15px] text-fg placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Confirm new password"
        aria-label="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 text-[15px] text-fg placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={saving || !password}
        className="min-h-11 w-full rounded-lg bg-accent py-2.5 text-sm font-bold text-bg transition-transform duration-200 active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Update password"}
      </button>
      {result && (
        <p className={`text-center text-xs ${result.ok ? "text-accent" : "text-red-400"}`}>{result.message}</p>
      )}
    </form>
  );
}

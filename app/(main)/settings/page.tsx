"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile, useUpdateProfile } from "@/lib/queries/settings";
import { count as outboxCount } from "@/lib/sync/outbox";
import { useQuery } from "@tanstack/react-query";

type IntegrationDef = { id: "strava" | "health_export"; name: string; description: string; initials: string };

const INTEGRATIONS: IntegrationDef[] = [
  { id: "strava", name: "Strava", description: "Auto-imports runs and rides", initials: "S" },
  { id: "health_export", name: "Apple Health", description: "Sleep, weight, steps", initials: "A" },
];

// Kinetic direction: same tokens as the rest of the app, motion carries the
// personality. Spring overshoot for the toggle thumb, a smooth ease for
// expand/collapse + color transitions. Both are plain Tailwind arbitrary
// values — no keyframes needed for transition-based motion.
const EASE_SPRING = "ease-[cubic-bezier(0.34,1.56,0.64,1)]";
const EASE_SMOOTH = "ease-[cubic-bezier(0.16,1,0.3,1)]";

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

  const [draft, setDraft] = useState({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("perfhub:wifiOnly") === "true"
  );

  function toggleWifiOnly() {
    setWifiOnly((v) => {
      const next = !v;
      window.localStorage.setItem("perfhub:wifiOnly", String(next));
      return next;
    });
  }

  function openEdit() {
    if (!profile) return;
    setDraft({
      kcal: profile.target_calories ?? 0,
      proteinG: profile.target_protein_g ?? 0,
      carbsG: profile.target_carbs_g ?? 0,
      fatG: profile.target_fat_g ?? 0,
    });
    setEditing(true);
  }

  function handleSave() {
    updateProfile.mutate(
      {
        target_calories: draft.kcal,
        target_protein_g: draft.proteinG,
        target_carbs_g: draft.carbsG,
        target_fat_g: draft.fatG,
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
        <div className="overflow-hidden rounded-2xl border border-surface-raised bg-surface">
          <div className="flex items-center justify-between border-b border-surface-raised px-4 py-3.5">
            <span className="text-sm font-medium text-fg">Name</span>
            <span className="font-mono text-sm text-fg/80">{profile.display_name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm font-medium text-fg">Units</span>
            <span className="font-mono text-sm text-fg/80">
              {profile.unit_weight === "lb" ? "Imperial (lb)" : "Metric (kg)"}
            </span>
          </div>
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
              <div>
                <label htmlFor="kcal-in" className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
                  Calories
                </label>
                <input
                  id="kcal-in"
                  type="number"
                  inputMode="numeric"
                  value={draft.kcal}
                  onChange={(e) => setDraft((d) => ({ ...d, kcal: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none"
                />
              </div>
              <div className="mt-3.5 grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="p-in" className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
                    Protein
                  </label>
                  <input
                    id="p-in"
                    type="number"
                    inputMode="numeric"
                    value={draft.proteinG}
                    onChange={(e) => setDraft((d) => ({ ...d, proteinG: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="c-in" className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
                    Carbs
                  </label>
                  <input
                    id="c-in"
                    type="number"
                    inputMode="numeric"
                    value={draft.carbsG}
                    onChange={(e) => setDraft((d) => ({ ...d, carbsG: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="f-in" className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
                    Fat
                  </label>
                  <input
                    id="f-in"
                    type="number"
                    inputMode="numeric"
                    value={draft.fatG}
                    onChange={(e) => setDraft((d) => ({ ...d, fatG: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-surface-raised bg-bg px-3 py-2 font-mono text-[15px] text-fg transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none"
                  />
                </div>
              </div>

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
          <div className="flex items-center justify-between border-b border-surface-raised px-4 py-3.5">
            <div className="flex items-center">
              <span className="relative mr-2 inline-block h-[7px] w-[7px] rounded-full bg-accent">
                <span className="animate-sync-ping absolute -inset-1 rounded-full border border-accent" />
              </span>
              <div>
                <span className="text-sm font-medium text-fg">{pending && pending > 0 ? "Syncing" : "Synced"}</span>
                <div className="mt-0.5 text-xs text-muted">Outbox: {pending ?? 0} pending</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm font-medium text-fg">Sync on Wi-Fi only</span>
            <Toggle on={wifiOnly} onToggle={toggleWifiOnly} label="Sync on Wi-Fi only" />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Integrations</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-surface-raised bg-surface">
          {INTEGRATIONS.map((integration, i) => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              isLast={i === INTEGRATIONS.length - 1}
            />
          ))}
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

function IntegrationRow({ integration, isLast }: { integration: IntegrationDef; isLast: boolean }) {
  const { data: connected } = useQuery({
    queryKey: ["integration-account", integration.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("integration_accounts")
        .select("id")
        .eq("provider", integration.id)
        .maybeSingle();
      return !!data;
    },
  });

  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${isLast ? "" : "border-b border-surface-raised"}`}>
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-sm font-bold transition-colors duration-300 ${
            connected ? "bg-accent/10 text-accent" : "bg-bg text-muted"
          }`}
        >
          {integration.initials}
        </div>
        <div>
          <div className="text-sm font-medium text-fg">{integration.name}</div>
          <div className={`mt-0.5 text-xs transition-colors duration-200 ${connected ? "text-accent" : "text-muted"}`}>
            {connected ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>
      {/* ponytail: connect/disconnect flows aren't built (Strava OAuth is a Phase-4 stub;
          Apple Health is provisioned via direct SQL, not a UI flow) — status is read-only for now. */}
    </div>
  );
}

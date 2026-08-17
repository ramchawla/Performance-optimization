import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { combineLocal, todayLocal } from "@/lib/datetime";
import type { Database } from "@/lib/database.types";

export type Supplement = Database["public"]["Tables"]["supplements"]["Row"];
export type SupplementIntake = Database["public"]["Tables"]["supplement_intakes"]["Row"];

export const DOSE_UNITS = ["mg", "g", "mcg", "iu", "ml", "capsule", "tablet", "scoop", "serving"] as const;
export const FORMS = ["capsule", "tablet", "powder", "liquid", "gummy", "other"] as const;
export const TIMING_RULES = [
  "any",
  "morning",
  "with_food",
  "empty_stomach",
  "pre_workout",
  "post_workout",
  "pre_bed",
] as const;

export const TIMING_LABELS: Record<(typeof TIMING_RULES)[number], string> = {
  any: "Anytime",
  morning: "Morning",
  with_food: "With food",
  empty_stomach: "Empty stomach",
  pre_workout: "Pre-workout",
  post_workout: "Post-workout",
  pre_bed: "Before bed",
};

export function useSupplements(includeInactive = false) {
  return useQuery({
    queryKey: ["supplements", includeInactive],
    queryFn: async (): Promise<Supplement[]> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      let q = supabase.from("supplements").select("*").eq("user_id", userData.user.id).order("name");
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export interface SupplementInput {
  name: string;
  brand?: string | null;
  form?: string | null;
  doseAmount?: number | null;
  doseUnit?: string | null;
  purpose?: string | null;
  timingRule?: string | null;
  startedOn?: string | null;
  costPerServing?: number | null;
  notes?: string | null;
}

export function useCreateSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplementInput): Promise<Supplement> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("supplements")
        .insert({
          user_id: userData.user.id,
          name: input.name,
          brand: input.brand ?? null,
          form: input.form ?? null,
          dose_amount: input.doseAmount ?? null,
          dose_unit: input.doseUnit ?? null,
          purpose: input.purpose ?? null,
          timing_rule: input.timingRule ?? null,
          started_on: input.startedOn ?? todayLocal(),
          cost_per_serving: input.costPerServing ?? null,
          notes: input.notes ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements"] }),
  });
}

/** Retiring a supplement keeps its history — never delete, mark inactive. */
export function useSetSupplementActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("supplements")
        .update({
          active,
          ended_on: active ? null : todayLocal(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements"] }),
  });
}

export function useSupplementIntakes(logDate: string) {
  return useQuery({
    queryKey: ["supplement-intakes", logDate],
    queryFn: async (): Promise<SupplementIntake[]> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("supplement_intakes")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("log_date", logDate)
        .order("taken_at");
      if (error) throw error;
      return data;
    },
  });
}

export interface LogIntakeInput {
  supplement: Supplement;
  logDate?: string;
  time?: string;
  withFood?: boolean | null;
  skipped?: boolean;
  skipReason?: string | null;
  notes?: string | null;
}

/** Dose is snapshotted from the definition (CLAUDE.md rule 2). */
export function useLogSupplementIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogIntakeInput): Promise<SupplementIntake> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const logDate = input.logDate ?? todayLocal();
      const { data, error } = await supabase
        .from("supplement_intakes")
        .insert({
          user_id: userData.user.id,
          supplement_id: input.supplement.id,
          log_date: logDate,
          taken_at: input.time ? combineLocal(logDate, input.time) : new Date().toISOString(),
          dose_amount: input.supplement.dose_amount,
          dose_unit: input.supplement.dose_unit,
          with_food: input.withFood ?? null,
          skipped: input.skipped ?? false,
          skip_reason: input.skipReason ?? null,
          notes: input.notes ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplement-intakes"] }),
  });
}

export function useDeleteIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("supplement_intakes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplement-intakes"] }),
  });
}

/** Taken-vs-planned over a window, per supplement. */
export function useSupplementAdherence(days = 30) {
  return useQuery({
    queryKey: ["supplement-adherence", days],
    queryFn: async (): Promise<Record<string, number>> => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("supplement_intakes")
        .select("supplement_id, log_date, skipped")
        .eq("user_id", userData.user.id)
        .gte("log_date", since.toLocaleDateString("en-CA"));
      if (error) throw error;

      // Distinct days taken per supplement — two doses in a day is still one
      // day of adherence.
      const daysTaken = new Map<string, Set<string>>();
      for (const row of data) {
        if (row.skipped) continue;
        const set = daysTaken.get(row.supplement_id) ?? new Set<string>();
        set.add(row.log_date);
        daysTaken.set(row.supplement_id, set);
      }

      const out: Record<string, number> = {};
      for (const [id, set] of daysTaken) out[id] = Math.round((set.size / days) * 100);
      return out;
    },
  });
}

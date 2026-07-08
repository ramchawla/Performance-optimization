import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type Template = Database["public"]["Tables"]["workout_templates"]["Row"];
export type TemplateExercise = Database["public"]["Tables"]["template_exercises"]["Row"];
export type TemplateExercisePatch = Partial<
  Pick<
    Database["public"]["Tables"]["template_exercises"]["Update"],
    | "target_sets"
    | "target_reps_min"
    | "target_reps_max"
    | "target_weight_kg"
    | "target_rpe"
    | "rest_seconds"
    | "superset_group"
    | "notes"
  >
>;
export type TemplateExerciseWithName = TemplateExercise & { exercises: { name: string } | null };

const TEMPLATES_KEY = ["templates"] as const;
const templateKey = (id: string) => ["templates", id] as const;

export function useTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async (): Promise<Template[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workout_templates")
        .select("*")
        .is("archived_at", null)
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");
      const { data: last } = await supabase
        .from("workout_templates")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = (last?.[0]?.position ?? -10) + 10;
      const { data, error } = await supabase
        .from("workout_templates")
        .insert({ user_id: userData.user.id, name, position: nextPosition })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name?: string; description?: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.from("workout_templates").update({ name, description }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useArchiveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("workout_templates")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useReorderTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: Array<{ id: string; position: number }>) => {
      const supabase = createClient();
      for (const t of ordered) {
        const { error } = await supabase.from("workout_templates").update({ position: t.position }).eq("id", t.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useTemplateDetail(id: string) {
  return useQuery({
    queryKey: templateKey(id),
    queryFn: async (): Promise<{ template: Template; exercises: TemplateExerciseWithName[] }> => {
      const supabase = createClient();
      const { data: template, error: tErr } = await supabase
        .from("workout_templates")
        .select("*")
        .eq("id", id)
        .single();
      if (tErr) throw tErr;
      const { data: exercises, error: eErr } = await supabase
        .from("template_exercises")
        .select("*, exercises(name)")
        .eq("template_id", id)
        .order("position");
      if (eErr) throw eErr;
      return { template, exercises: exercises as unknown as TemplateExerciseWithName[] };
    },
  });
}

export function useAddTemplateExercise(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ exerciseId, position, restSeconds }: { exerciseId: string; position: number; restSeconds: number | null }) => {
      const supabase = createClient();
      const { error } = await supabase.from("template_exercises").insert({
        template_id: templateId,
        exercise_id: exerciseId,
        position,
        target_sets: 3,
        rest_seconds: restSeconds,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKey(templateId) }),
  });
}

export function useUpdateTemplateExercise(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TemplateExercisePatch }) => {
      const supabase = createClient();
      const { error } = await supabase.from("template_exercises").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKey(templateId) }),
  });
}

export function useRemoveTemplateExercise(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("template_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKey(templateId) }),
  });
}

export function useReorderTemplateExercises(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: Array<{ id: string; position: number }>) => {
      const supabase = createClient();
      for (const e of ordered) {
        const { error } = await supabase.from("template_exercises").update({ position: e.position }).eq("id", e.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKey(templateId) }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { enqueue } from "@/lib/sync/outbox";
import { useActiveSessionStore, type ActiveSessionExercise } from "@/stores/activeSession";
import type { TemplateExerciseWithName } from "@/lib/queries/templates";
import type { Database } from "@/lib/database.types";

type WorkoutSession = Database["public"]["Tables"]["workout_sessions"]["Row"];

export interface StartSessionInput {
  templateId: string;
  templateName: string;
  isDeload: boolean;
  templateExercises: TemplateExerciseWithName[];
}

/** Session-start snapshot: copies template targets into session_exercises per TECHNICAL-DESIGN §2 & CLAUDE.md rule 2. */
export function useStartSession() {
  const startStore = useActiveSessionStore((s) => s.startSession);

  return useMutation({
    mutationFn: async (input: StartSessionInput) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      const sessionId = crypto.randomUUID();
      const startedAt = new Date().toISOString();

      const activeExercises: ActiveSessionExercise[] = input.templateExercises.map((te) => ({
        clientId: crypto.randomUUID(),
        exerciseId: te.exercise_id,
        position: te.position,
        supersetGroup: te.superset_group,
        targetSets: te.target_sets,
        targetRepsMin: te.target_reps_min,
        targetRepsMax: te.target_reps_max,
        targetWeightKg: te.target_weight_kg,
        targetRpe: te.target_rpe,
        restSeconds: te.rest_seconds,
        sets: Array.from({ length: te.target_sets ?? 1 }, (_, i) => ({
          clientId: crypto.randomUUID(),
          setNumber: i + 1,
          isWarmup: false,
          actualReps: null,
          actualWeightKg: null,
          actualRpe: null,
          completedAt: null,
        })),
      }));

      await enqueue("workout_sessions", "upsert", {
        id: sessionId,
        client_id: sessionId,
        user_id: userData.user.id,
        template_id: input.templateId,
        template_name_snapshot: input.templateName,
        started_at: startedAt,
        is_deload: input.isDeload,
      });

      for (const ex of activeExercises) {
        await enqueue("session_exercises", "upsert", {
          id: ex.clientId,
          client_id: ex.clientId,
          session_id: sessionId,
          exercise_id: ex.exerciseId,
          position: ex.position,
          superset_group: ex.supersetGroup,
          target_sets: ex.targetSets,
          target_reps_min: ex.targetRepsMin,
          target_reps_max: ex.targetRepsMax,
          target_weight_kg: ex.targetWeightKg,
          target_rpe: ex.targetRpe,
          rest_seconds: ex.restSeconds,
        });
      }

      startStore({
        clientId: sessionId,
        templateId: input.templateId,
        templateNameSnapshot: input.templateName,
        isDeload: input.isDeload,
        exercises: activeExercises,
      });

      return sessionId;
    },
  });
}

export interface LastPerformanceSet {
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  isWarmup: boolean;
}

export interface LastPerformance {
  performedAt: string;
  sets: LastPerformanceSet[];
}

async function fetchLastPerformance(exerciseId: string): Promise<LastPerformance | null> {
  const supabase = createClient();
  const { data: matches, error } = await supabase
    .from("session_exercises")
    .select("id, workout_sessions!inner(started_at, completed_at, is_deload)")
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.is_deload", false)
    .not("workout_sessions.completed_at", "is", null)
    .order("started_at", { foreignTable: "workout_sessions", ascending: false })
    .limit(1);
  if (error) throw error;

  const match = matches?.[0] as unknown as { id: string; workout_sessions: { started_at: string } } | undefined;
  if (!match) return null;

  const { data: sets, error: setsErr } = await supabase
    .from("session_sets")
    .select("*")
    .eq("session_exercise_id", match.id)
    .order("set_number");
  if (setsErr) throw setsErr;

  return {
    performedAt: match.workout_sessions.started_at,
    sets: sets.map((s) => ({
      setNumber: s.set_number,
      reps: s.actual_reps,
      weightKg: s.actual_weight_kg,
      rpe: s.actual_rpe,
      isWarmup: s.is_warmup,
    })),
  };
}

export function useLastPerformance(exerciseId: string) {
  return useQuery({
    queryKey: ["last-performance", exerciseId],
    queryFn: () => fetchLastPerformance(exerciseId),
    staleTime: Infinity, // fetched once at session start and cached, per TECHNICAL-DESIGN §2
  });
}

export function useLogSet() {
  return useMutation({
    mutationFn: async (input: {
      setClientId: string;
      sessionExerciseClientId: string;
      setNumber: number;
      isWarmup: boolean;
      actualReps: number;
      actualWeightKg: number;
      actualRpe: number | null;
    }) => {
      await enqueue("session_sets", "upsert", {
        id: input.setClientId,
        client_id: input.setClientId,
        session_exercise_id: input.sessionExerciseClientId,
        set_number: input.setNumber,
        is_warmup: input.isWarmup,
        actual_reps: input.actualReps,
        actual_weight_kg: input.actualWeightKg,
        actual_rpe: input.actualRpe,
      });
    },
  });
}

export function useCompleteSession() {
  const endStore = useActiveSessionStore((s) => s.endSession);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      templateId: string | null;
      templateNameSnapshot: string | null;
      startedAt: string;
      isDeload: boolean;
      bodyweightKg: number | null;
    }) => {
      const supabase = createClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData.user) throw new Error("Not signed in");

      await enqueue("workout_sessions", "upsert", {
        id: input.clientId,
        client_id: input.clientId,
        user_id: userData.user.id,
        template_id: input.templateId,
        template_name_snapshot: input.templateNameSnapshot,
        started_at: input.startedAt,
        completed_at: new Date().toISOString(),
        is_deload: input.isDeload,
        bodyweight_kg: input.bodyweightKg,
      });

      endStore();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session-history"] }),
  });
}

const HISTORY_KEY = ["session-history"] as const;

export function useSessionHistory() {
  return useQuery({
    queryKey: HISTORY_KEY,
    queryFn: async (): Promise<WorkoutSession[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .not("completed_at", "is", null)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export interface SessionDetailExercise {
  id: string;
  exerciseName: string;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetRpe: number | null;
  sets: Array<{
    setNumber: number;
    isWarmup: boolean;
    actualReps: number | null;
    actualWeightKg: number | null;
    actualRpe: number | null;
  }>;
}

export function useSessionDetail(sessionId: string) {
  return useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: async (): Promise<{ session: WorkoutSession; exercises: SessionDetailExercise[] }> => {
      const supabase = createClient();
      const { data: session, error: sErr } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (sErr) throw sErr;

      const { data: exercises, error: eErr } = await supabase
        .from("session_exercises")
        .select("*, exercises(name), session_sets(*)")
        .eq("session_id", sessionId)
        .order("position");
      if (eErr) throw eErr;

      type Joined = Database["public"]["Tables"]["session_exercises"]["Row"] & {
        exercises: { name: string } | null;
        session_sets: Database["public"]["Tables"]["session_sets"]["Row"][];
      };

      return {
        session,
        exercises: (exercises as unknown as Joined[]).map((ex) => ({
          id: ex.id,
          exerciseName: ex.exercises?.name ?? "Unknown exercise",
          targetSets: ex.target_sets,
          targetRepsMin: ex.target_reps_min,
          targetRepsMax: ex.target_reps_max,
          targetWeightKg: ex.target_weight_kg,
          targetRpe: ex.target_rpe,
          sets: [...ex.session_sets]
            .sort((a, b) => a.set_number - b.set_number)
            .map((s) => ({
              setNumber: s.set_number,
              isWarmup: s.is_warmup,
              actualReps: s.actual_reps,
              actualWeightKg: s.actual_weight_kg,
              actualRpe: s.actual_rpe,
            })),
        })),
      };
    },
  });
}

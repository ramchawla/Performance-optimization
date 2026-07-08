/**
 * In-workout session store — the ONLY Zustand usage in this app (CLAUDE.md
 * structure rule). Holds the live session state while logging; components
 * write here on every set completion, the outbox/sync layer persists it.
 * Fields mirror workout_sessions / session_exercises / session_sets
 * (supabase/migrations/0001_init.sql) with client_ids pre-generated per the
 * snapshot + offline-write rules in TECHNICAL-DESIGN.md §2–3.
 */
import { create } from "zustand";

export interface ActiveSet {
  clientId: string;
  setNumber: number;
  isWarmup: boolean;
  actualReps: number | null;
  actualWeightKg: number | null;
  actualRpe: number | null;
  completedAt: string | null; // ISO timestamp, set on completion
}

export interface ActiveSessionExercise {
  clientId: string;
  exerciseId: string;
  position: number;
  supersetGroup: number | null;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
  sets: ActiveSet[];
}

export interface ActiveSession {
  clientId: string;
  templateId: string | null;
  templateNameSnapshot: string | null;
  startedAt: string;
  isDeload: boolean;
  bodyweightKg: number | null;
  exercises: ActiveSessionExercise[];
}

interface ActiveSessionState {
  session: ActiveSession | null;
  restTimerEndsAt: number | null; // epoch ms, null when no timer running

  startSession: (input: {
    clientId: string;
    templateId: string | null;
    templateNameSnapshot: string | null;
    isDeload: boolean;
    exercises: ActiveSessionExercise[];
  }) => void;
  endSession: () => void;

  completeSet: (
    exerciseClientId: string,
    setClientId: string,
    result: { actualReps: number; actualWeightKg: number; actualRpe: number | null }
  ) => void;

  addSet: (exerciseClientId: string) => ActiveSet;

  setDeload: (isDeload: boolean) => void;
  setBodyweight: (bodyweightKg: number | null) => void;

  startRestTimer: (durationSeconds: number) => void;
  clearRestTimer: () => void;
}

export const useActiveSessionStore = create<ActiveSessionState>((set) => ({
  session: null,
  restTimerEndsAt: null,

  startSession: ({ clientId, templateId, templateNameSnapshot, isDeload, exercises }) =>
    set({
      session: {
        clientId,
        templateId,
        templateNameSnapshot,
        startedAt: new Date().toISOString(),
        isDeload,
        bodyweightKg: null,
        exercises,
      },
      restTimerEndsAt: null,
    }),

  endSession: () => set({ session: null, restTimerEndsAt: null }),

  completeSet: (exerciseClientId, setClientId, result) =>
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          exercises: state.session.exercises.map((ex) =>
            ex.clientId !== exerciseClientId
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.clientId !== setClientId
                      ? s
                      : {
                          ...s,
                          actualReps: result.actualReps,
                          actualWeightKg: result.actualWeightKg,
                          actualRpe: result.actualRpe,
                          completedAt: new Date().toISOString(),
                        }
                  ),
                }
          ),
        },
      };
    }),

  addSet: (exerciseClientId) => {
    const newSet: ActiveSet = {
      clientId: crypto.randomUUID(),
      setNumber: 1,
      isWarmup: false,
      actualReps: null,
      actualWeightKg: null,
      actualRpe: null,
      completedAt: null,
    };
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          exercises: state.session.exercises.map((ex) => {
            if (ex.clientId !== exerciseClientId) return ex;
            newSet.setNumber = ex.sets.length + 1;
            return { ...ex, sets: [...ex.sets, newSet] };
          }),
        },
      };
    });
    return newSet;
  },

  setDeload: (isDeload) =>
    set((state) => (state.session ? { session: { ...state.session, isDeload } } : state)),

  setBodyweight: (bodyweightKg) =>
    set((state) => (state.session ? { session: { ...state.session, bodyweightKg } } : state)),

  startRestTimer: (durationSeconds) => set({ restTimerEndsAt: Date.now() + durationSeconds * 1000 }),
  clearRestTimer: () => set({ restTimerEndsAt: null }),
}));

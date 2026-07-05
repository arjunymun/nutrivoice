import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  CustomExercise,
  Exercise,
  Routine,
  RoutineItem,
  Workout,
  WorkoutSet,
} from '../lib/workoutTypes';
import { Stamp } from './useLogStore';

/**
 * Workouts, sets, routines, custom exercises — same offline-first pattern as
 * useLogStore (dirty flags, LWW mergeRemote, markPushed with updatedAt stamps).
 *
 * The ACTIVE workout is a normal synced workout row with durationS = null,
 * created on start; sets append as they're completed, so crash recovery is
 * free (zustand persist). Only truly ephemeral session state (rest timer
 * end-timestamp, per-exercise planned targets) lives in the non-synced slice.
 */

export interface PlannedExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number | null;
  targetWeightKg: number | null;
}

interface WorkoutState {
  workouts: Workout[];
  sets: WorkoutSet[];
  routines: Routine[];
  customExercises: CustomExercise[];

  // --- active session (ephemeral-but-persisted; not synced as-is) ---
  activeWorkoutId: string | null;
  /** Epoch ms when the rest period ends; timestamps, never counters. */
  restEndsAt: number | null;
  planned: PlannedExercise[];

  startWorkout: (name: string, planned?: PlannedExercise[]) => Workout;
  addSet: (input: {
    exerciseId: string;
    weightKg: number | null;
    reps: number | null;
    durationS?: number | null;
    rpe?: number | null;
    isWarmup?: boolean;
  }) => WorkoutSet | null;
  updateSet: (id: string, patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationS' | 'rpe' | 'isWarmup'>>) => void;
  removeSet: (id: string) => void;
  addPlanned: (exerciseId: string) => void;
  removePlanned: (exerciseId: string) => void;
  setRestEndsAt: (ts: number | null) => void;
  finishWorkout: (notes?: string) => Workout | null;
  discardActiveWorkout: () => void;

  addRoutine: (name: string, items: RoutineItem[]) => Routine;
  updateRoutine: (id: string, patch: Partial<Pick<Routine, 'name' | 'items'>>) => void;
  removeRoutine: (id: string) => void;

  addCustomExercise: (name: string, primaryMuscle: CustomExercise['primary_muscle']) => CustomExercise;

  deleteWorkout: (id: string) => void;

  mergeRemote: (data: {
    workouts?: Workout[];
    sets?: WorkoutSet[];
    routines?: Routine[];
    customExercises?: CustomExercise[];
  }) => void;
  markPushed: (pushed: { workouts: Stamp[]; sets: Stamp[]; routines: Stamp[]; customExercises: Stamp[] }) => void;
  reset: () => void;
}

const now = () => new Date().toISOString();

function mergeById<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const map = new Map(local.map((x) => [x.id, x]));
  for (const r of remote) {
    const l = map.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) map.set(r.id, r);
  }
  return [...map.values()];
}

function cleanStamped<T extends { id: string; updatedAt: string; dirty?: boolean }>(
  rows: T[],
  stamps: Stamp[],
): T[] {
  const m = new Map(stamps.map((s) => [s.id, s.updatedAt]));
  return rows.map((x) => (m.get(x.id) === x.updatedAt ? { ...x, dirty: false } : x));
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      workouts: [],
      sets: [],
      routines: [],
      customExercises: [],
      activeWorkoutId: null,
      restEndsAt: null,
      planned: [],

      startWorkout: (name, planned = []) => {
        const w: Workout = {
          id: randomUUID(),
          startedAt: now(),
          name: name.trim() || 'Workout',
          notes: null,
          durationS: null,
          updatedAt: now(),
          deleted: false,
          dirty: true,
        };
        set({ workouts: [...get().workouts, w], activeWorkoutId: w.id, planned, restEndsAt: null });
        return w;
      },

      addSet: (input) => {
        const workoutId = get().activeWorkoutId;
        if (!workoutId) return null;
        const existing = get().sets.filter(
          (s) => s.workoutId === workoutId && s.exerciseId === input.exerciseId && !s.deleted,
        );
        const s: WorkoutSet = {
          id: randomUUID(),
          workoutId,
          exerciseId: input.exerciseId,
          setNumber: existing.length + 1,
          weightKg: input.weightKg,
          reps: input.reps,
          durationS: input.durationS ?? null,
          rpe: input.rpe ?? null,
          isWarmup: input.isWarmup ?? false,
          updatedAt: now(),
          deleted: false,
          dirty: true,
        };
        set({ sets: [...get().sets, s] });
        return s;
      },

      updateSet: (id, patch) => {
        set({
          sets: get().sets.map((s) =>
            s.id === id ? { ...s, ...patch, updatedAt: now(), dirty: true } : s,
          ),
        });
      },

      removeSet: (id) => {
        set({
          sets: get().sets.map((s) =>
            s.id === id ? { ...s, deleted: true, updatedAt: now(), dirty: true } : s,
          ),
        });
      },

      addPlanned: (exerciseId) => {
        if (get().planned.some((p) => p.exerciseId === exerciseId)) return;
        set({
          planned: [
            ...get().planned,
            { exerciseId, targetSets: 3, targetReps: null, targetWeightKg: null },
          ],
        });
      },

      removePlanned: (exerciseId) => {
        set({ planned: get().planned.filter((p) => p.exerciseId !== exerciseId) });
      },

      setRestEndsAt: (restEndsAt) => set({ restEndsAt }),

      finishWorkout: (notes) => {
        const id = get().activeWorkoutId;
        if (!id) return null;
        const w = get().workouts.find((x) => x.id === id);
        if (!w) {
          set({ activeWorkoutId: null, planned: [], restEndsAt: null });
          return null;
        }
        const durationS = Math.max(
          60,
          Math.round((Date.now() - new Date(w.startedAt).getTime()) / 1000),
        );
        const finished: Workout = {
          ...w,
          durationS,
          notes: notes?.trim() || w.notes,
          updatedAt: now(),
          dirty: true,
        };
        set({
          workouts: get().workouts.map((x) => (x.id === id ? finished : x)),
          activeWorkoutId: null,
          planned: [],
          restEndsAt: null,
        });
        return finished;
      },

      discardActiveWorkout: () => {
        const id = get().activeWorkoutId;
        if (!id) return;
        set({
          workouts: get().workouts.map((w) =>
            w.id === id ? { ...w, deleted: true, updatedAt: now(), dirty: true } : w,
          ),
          sets: get().sets.map((s) =>
            s.workoutId === id ? { ...s, deleted: true, updatedAt: now(), dirty: true } : s,
          ),
          activeWorkoutId: null,
          planned: [],
          restEndsAt: null,
        });
      },

      addRoutine: (name, items) => {
        const r: Routine = {
          id: randomUUID(),
          name: name.trim() || 'Routine',
          items,
          updatedAt: now(),
          deleted: false,
          dirty: true,
        };
        set({ routines: [...get().routines, r] });
        return r;
      },

      updateRoutine: (id, patch) => {
        set({
          routines: get().routines.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: now(), dirty: true } : r,
          ),
        });
      },

      removeRoutine: (id) => {
        set({
          routines: get().routines.map((r) =>
            r.id === id ? { ...r, deleted: true, updatedAt: now(), dirty: true } : r,
          ),
        });
      },

      addCustomExercise: (name, primaryMuscle) => {
        const e: CustomExercise = {
          id: `custom-${randomUUID()}`,
          name: name.trim(),
          aliases: [],
          primary_muscle: primaryMuscle,
          secondary_muscles: [],
          equipment: 'other',
          category: 'custom',
          load_type: 'weight_reps',
          is_unilateral: false,
          met: 4,
          cue: '',
          updatedAt: now(),
          deleted: false,
          dirty: true,
        };
        set({ customExercises: [...get().customExercises, e] });
        return e;
      },

      deleteWorkout: (id) => {
        set({
          workouts: get().workouts.map((w) =>
            w.id === id ? { ...w, deleted: true, updatedAt: now(), dirty: true } : w,
          ),
        });
      },

      mergeRemote: (data) => {
        set({
          workouts: data.workouts ? mergeById(get().workouts, data.workouts) : get().workouts,
          sets: data.sets ? mergeById(get().sets, data.sets) : get().sets,
          routines: data.routines ? mergeById(get().routines, data.routines) : get().routines,
          customExercises: data.customExercises
            ? mergeById(get().customExercises, data.customExercises)
            : get().customExercises,
        });
      },

      markPushed: (pushed) => {
        set({
          workouts: cleanStamped(get().workouts, pushed.workouts),
          sets: cleanStamped(get().sets, pushed.sets),
          routines: cleanStamped(get().routines, pushed.routines),
          customExercises: cleanStamped(get().customExercises, pushed.customExercises),
        });
      },

      reset: () =>
        set({
          workouts: [],
          sets: [],
          routines: [],
          customExercises: [],
          activeWorkoutId: null,
          restEndsAt: null,
          planned: [],
        }),
    }),
    {
      name: 'nutrivoice-workouts',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** All known exercises: bundled catalog + user's custom ones. */
export function exercisePool(catalog: Exercise[], custom: CustomExercise[]): Exercise[] {
  return [...custom.filter((c) => !c.deleted), ...catalog];
}

export function setsForWorkout(sets: WorkoutSet[], workoutId: string): WorkoutSet[] {
  return sets
    .filter((s) => s.workoutId === workoutId && !s.deleted)
    .sort((a, b) => a.setNumber - b.setNumber);
}

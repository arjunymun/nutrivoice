import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useLogStore } from '../stores/useLogStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { supabase } from './supabase';
import { CustomFood, FoodLogEntry, Profile, WeightEntry } from './types';
import { CustomExercise, Routine, Workout, WorkoutSet } from './workoutTypes';

/**
 * Offline-first sync: push dirty local rows, then pull rows changed since the
 * last sync. Conflicts resolve last-write-wins on `updated_at`. Deletes are
 * soft (`deleted` flag) so they propagate across devices.
 */

interface SyncState {
  lastSyncedAt: string | null;
  /** User id this device's local data belongs to (null = never signed in). */
  lastUserId: string | null;
  status: 'idle' | 'syncing' | 'error';
  errorMessage: string | null;
  setStatus: (s: SyncState['status'], err?: string | null) => void;
  setLastSyncedAt: (iso: string) => void;
  setLastUserId: (id: string) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      lastSyncedAt: null,
      lastUserId: null,
      status: 'idle',
      errorMessage: null,
      setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setLastUserId: (lastUserId) => set({ lastUserId }),
      reset: () => set({ lastSyncedAt: null, lastUserId: null, status: 'idle', errorMessage: null }),
    }),
    {
      name: 'nutrivoice-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lastSyncedAt: s.lastSyncedAt, lastUserId: s.lastUserId }) as SyncState,
    },
  ),
);

/** Resolve once every persisted store has rehydrated (guards cold-start sync). */
function waitForHydration(): Promise<void> {
  const stores = [useProfileStore, useLogStore, useWorkoutStore, useSyncStore] as const;
  return Promise.all(
    stores.map(
      (s) =>
        new Promise<void>((resolve) => {
          if (s.persist.hasHydrated()) return resolve();
          const unsub = s.persist.onFinishHydration(() => {
            unsub();
            resolve();
          });
        }),
    ),
  ).then(() => {});
}

// ---- row mapping ----

const entryToRow = (e: FoodLogEntry, userId: string) => ({
  id: e.id,
  user_id: userId,
  logged_at: e.dateKey,
  meal: e.meal,
  food_id: e.foodId,
  name: e.name,
  grams: e.grams,
  kcal: e.kcal,
  protein_g: e.proteinG,
  carbs_g: e.carbsG,
  fat_g: e.fatG,
  source: e.source,
  created_at: e.createdAt,
  updated_at: e.updatedAt,
  deleted: e.deleted,
});

const rowToEntry = (r: any): FoodLogEntry => ({
  id: r.id,
  dateKey: r.logged_at,
  meal: r.meal,
  foodId: r.food_id,
  name: r.name,
  grams: Number(r.grams),
  kcal: Number(r.kcal),
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fat_g),
  source: r.source,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deleted: r.deleted,
  dirty: false,
});

const weightToRow = (w: WeightEntry, userId: string) => ({
  id: w.id,
  user_id: userId,
  logged_at: w.dateKey,
  weight_kg: w.weightKg,
  updated_at: w.updatedAt,
  deleted: w.deleted,
});

const rowToWeight = (r: any): WeightEntry => ({
  id: r.id,
  dateKey: r.logged_at,
  weightKg: Number(r.weight_kg),
  updatedAt: r.updated_at,
  deleted: r.deleted,
  dirty: false,
});

const customFoodToRow = (c: CustomFood, userId: string) => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  kcal_100g: c.kcal_100g,
  protein_100g: c.protein_100g,
  carbs_100g: c.carbs_100g,
  fat_100g: c.fat_100g,
  barcode: c.barcode,
  updated_at: c.updatedAt,
  deleted: c.deleted,
});

const rowToCustomFood = (r: any): CustomFood => ({
  id: r.id,
  name: r.name,
  aliases: [],
  category: 'custom',
  kcal_100g: Number(r.kcal_100g),
  protein_100g: Number(r.protein_100g),
  carbs_100g: Number(r.carbs_100g),
  fat_100g: Number(r.fat_100g),
  default_portion_g: 100,
  portion_label: '100 g',
  barcode: r.barcode,
  updatedAt: r.updated_at,
  deleted: r.deleted,
  dirty: false,
});

const workoutToRow = (w: Workout, userId: string) => ({
  id: w.id,
  user_id: userId,
  started_at: w.startedAt,
  name: w.name,
  notes: w.notes,
  duration_s: w.durationS,
  updated_at: w.updatedAt,
  deleted: w.deleted,
});

const rowToWorkout = (r: any): Workout => ({
  id: r.id,
  startedAt: r.started_at,
  name: r.name,
  notes: r.notes,
  durationS: r.duration_s == null ? null : Number(r.duration_s),
  updatedAt: r.updated_at,
  deleted: r.deleted,
  dirty: false,
});

const setToRow = (s: WorkoutSet, userId: string) => ({
  id: s.id,
  workout_id: s.workoutId,
  user_id: userId,
  exercise_id: s.exerciseId,
  set_number: s.setNumber,
  weight_kg: s.weightKg,
  reps: s.reps,
  duration_s: s.durationS,
  rpe: s.rpe,
  is_warmup: s.isWarmup,
  updated_at: s.updatedAt,
  deleted: s.deleted,
});

const rowToSet = (r: any): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  setNumber: Number(r.set_number),
  weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
  reps: r.reps == null ? null : Number(r.reps),
  durationS: r.duration_s == null ? null : Number(r.duration_s),
  rpe: r.rpe == null ? null : Number(r.rpe),
  isWarmup: r.is_warmup,
  updatedAt: r.updated_at,
  deleted: r.deleted,
  dirty: false,
});

const routineToRow = (r: Routine, userId: string) => ({
  id: r.id,
  user_id: userId,
  name: r.name,
  items: r.items,
  updated_at: r.updatedAt,
  deleted: r.deleted,
});

const rowToRoutine = (r: any): Routine => ({
  id: r.id,
  name: r.name,
  items: Array.isArray(r.items) ? r.items : [],
  updatedAt: r.updated_at,
  deleted: r.deleted,
  dirty: false,
});

const customExerciseToRow = (e: CustomExercise, userId: string) => ({
  id: e.id,
  user_id: userId,
  name: e.name,
  primary_muscle: e.primary_muscle,
  equipment: e.equipment,
  updated_at: e.updatedAt,
  deleted: e.deleted,
});

const rowToCustomExercise = (r: any): CustomExercise => ({
  id: r.id,
  name: r.name,
  aliases: [],
  primary_muscle: r.primary_muscle,
  secondary_muscles: [],
  equipment: r.equipment,
  category: 'custom',
  load_type: 'weight_reps',
  is_unilateral: false,
  met: 4,
  cue: '',
  updatedAt: r.updated_at,
  deleted: r.deleted,
  dirty: false,
});

const profileToRow = (p: Profile, userId: string) => ({
  user_id: userId,
  name: p.name,
  sex: p.sex,
  birth_year: p.birthYear,
  height_cm: p.heightCm,
  weight_kg: p.weightKg,
  activity_level: p.activityLevel,
  goal: p.goal,
  custom_targets: p.customTargets,
  target_kcal: p.targetKcal,
  target_protein_g: p.targetProteinG,
  target_carbs_g: p.targetCarbsG,
  target_fat_g: p.targetFatG,
  updated_at: p.updatedAt,
});

const rowToProfile = (r: any): Profile => ({
  name: r.name ?? '',
  sex: r.sex ?? 'male',
  birthYear: r.birth_year ?? 2000,
  heightCm: Number(r.height_cm ?? 170),
  weightKg: Number(r.weight_kg ?? 70),
  activityLevel: r.activity_level ?? 'moderate',
  goal: r.goal ?? 'maintain',
  customTargets: !!r.custom_targets,
  targetKcal: r.target_kcal ?? 2000,
  targetProteinG: r.target_protein_g ?? 140,
  targetCarbsG: r.target_carbs_g ?? 200,
  targetFatG: r.target_fat_g ?? 60,
  updatedAt: r.updated_at,
});

// ---- sync ----

export type SyncResult = { ok: true } | { ok: false; message: string };

let syncing = false;

export async function syncAll(): Promise<SyncResult> {
  if (syncing) return { ok: true };

  await waitForHydration();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return { ok: false, message: 'Sign in to sync your data.' };
  }
  const userId = sessionData.session.user.id;

  syncing = true;
  useSyncStore.getState().setStatus('syncing');
  try {
    // Different account than the one this device's data belongs to:
    // start clean instead of pushing someone else's log into this account.
    const { lastUserId } = useSyncStore.getState();
    if (lastUserId && lastUserId !== userId) {
      useLogStore.getState().reset();
      useWorkoutStore.getState().reset();
      useProfileStore.getState().reset();
      useSyncStore.getState().setLastSyncedAt('1970-01-01T00:00:00Z');
    }
    useSyncStore.getState().setLastUserId(userId);

    const log = useLogStore.getState();
    const gym = useWorkoutStore.getState();
    const profileStore = useProfileStore.getState();

    // -- push --
    const dirtyEntries = log.entries.filter((e) => e.dirty);
    const dirtyWeights = log.weights.filter((w) => w.dirty);
    const dirtyCustom = log.customFoods.filter((c) => c.dirty);
    const dirtyWorkouts = gym.workouts.filter((w) => w.dirty);
    const dirtySets = gym.sets.filter((s) => s.dirty);
    const dirtyRoutines = gym.routines.filter((r) => r.dirty);
    const dirtyCustomEx = gym.customExercises.filter((e) => e.dirty);

    if (dirtyEntries.length) {
      const { error } = await supabase
        .from('food_logs')
        .upsert(dirtyEntries.map((e) => entryToRow(e, userId)));
      if (error) throw new Error(`Pushing food logs failed: ${error.message}`);
    }
    if (dirtyWeights.length) {
      const { error } = await supabase
        .from('weight_logs')
        .upsert(dirtyWeights.map((w) => weightToRow(w, userId)));
      if (error) throw new Error(`Pushing weights failed: ${error.message}`);
    }
    if (dirtyCustom.length) {
      const { error } = await supabase
        .from('custom_foods')
        .upsert(dirtyCustom.map((c) => customFoodToRow(c, userId)));
      if (error) throw new Error(`Pushing custom foods failed: ${error.message}`);
    }
    useLogStore.getState().markPushed({
      entries: dirtyEntries.map((e) => ({ id: e.id, updatedAt: e.updatedAt })),
      weights: dirtyWeights.map((w) => ({ id: w.id, updatedAt: w.updatedAt })),
      customFoods: dirtyCustom.map((c) => ({ id: c.id, updatedAt: c.updatedAt })),
    });

    // gym: parents strictly before children (workout_sets FK → workouts)
    if (dirtyWorkouts.length) {
      const { error } = await supabase
        .from('workouts')
        .upsert(dirtyWorkouts.map((w) => workoutToRow(w, userId)));
      if (error) throw new Error(`Pushing workouts failed: ${error.message}`);
    }
    if (dirtySets.length) {
      const { error } = await supabase
        .from('workout_sets')
        .upsert(dirtySets.map((s) => setToRow(s, userId)));
      if (error) throw new Error(`Pushing workout sets failed: ${error.message}`);
    }
    if (dirtyRoutines.length) {
      const { error } = await supabase
        .from('routines')
        .upsert(dirtyRoutines.map((r) => routineToRow(r, userId)));
      if (error) throw new Error(`Pushing routines failed: ${error.message}`);
    }
    if (dirtyCustomEx.length) {
      const { error } = await supabase
        .from('custom_exercises')
        .upsert(dirtyCustomEx.map((e) => customExerciseToRow(e, userId)));
      if (error) throw new Error(`Pushing custom exercises failed: ${error.message}`);
    }
    useWorkoutStore.getState().markPushed({
      workouts: dirtyWorkouts.map((w) => ({ id: w.id, updatedAt: w.updatedAt })),
      sets: dirtySets.map((s) => ({ id: s.id, updatedAt: s.updatedAt })),
      routines: dirtyRoutines.map((r) => ({ id: r.id, updatedAt: r.updatedAt })),
      customExercises: dirtyCustomEx.map((e) => ({ id: e.id, updatedAt: e.updatedAt })),
    });

    if (profileStore.profile && profileStore.dirty) {
      const { error } = await supabase
        .from('profiles')
        .upsert(profileToRow(profileStore.profile, userId));
      if (error) throw new Error(`Pushing profile failed: ${error.message}`);
      useProfileStore.getState().markPushed(profileStore.profile.updatedAt);
    }

    // -- pull --
    const since = useSyncStore.getState().lastSyncedAt ?? '1970-01-01T00:00:00Z';

    const [entriesRes, weightsRes, customRes, profileRes, workoutsRes, setsRes, routinesRes, customExRes] =
      await Promise.all([
        supabase.from('food_logs').select('*').gt('updated_at', since),
        supabase.from('weight_logs').select('*').gt('updated_at', since),
        supabase.from('custom_foods').select('*').gt('updated_at', since),
        supabase.from('profiles').select('*').maybeSingle(),
        supabase.from('workouts').select('*').gt('updated_at', since),
        supabase.from('workout_sets').select('*').gt('updated_at', since),
        supabase.from('routines').select('*').gt('updated_at', since),
        supabase.from('custom_exercises').select('*').gt('updated_at', since),
      ]);
    for (const res of [entriesRes, weightsRes, customRes, profileRes, workoutsRes, setsRes, routinesRes, customExRes]) {
      if (res.error) throw new Error(`Pulling data failed: ${res.error.message}`);
    }

    useLogStore.getState().mergeRemote({
      entries: (entriesRes.data ?? []).map(rowToEntry),
      weights: (weightsRes.data ?? []).map(rowToWeight),
      customFoods: (customRes.data ?? []).map(rowToCustomFood),
    });
    useWorkoutStore.getState().mergeRemote({
      workouts: (workoutsRes.data ?? []).map(rowToWorkout),
      sets: (setsRes.data ?? []).map(rowToSet),
      routines: (routinesRes.data ?? []).map(rowToRoutine),
      customExercises: (customExRes.data ?? []).map(rowToCustomExercise),
    });

    // Orphan repair: the parallel pulls share one watermark, so another device
    // can commit workout W between our `workouts` and `workout_sets` queries —
    // we'd see W's sets (later updated_at) but never W itself once the
    // watermark advances past it. Fetch any missing parents by id now.
    {
      const state = useWorkoutStore.getState();
      const known = new Set(state.workouts.map((w) => w.id));
      const orphanIds = [...new Set(state.sets.filter((s) => !known.has(s.workoutId)).map((s) => s.workoutId))];
      if (orphanIds.length) {
        const { data, error } = await supabase.from('workouts').select('*').in('id', orphanIds);
        if (error) throw new Error(`Orphan repair failed: ${error.message}`);
        if (data?.length) useWorkoutStore.getState().mergeRemote({ workouts: data.map(rowToWorkout) });
      }
    }

    const localProfile = useProfileStore.getState().profile;
    if (profileRes.data) {
      const remote = rowToProfile(profileRes.data);
      if (!localProfile || remote.updatedAt > localProfile.updatedAt) {
        useProfileStore.getState().applyRemote(remote);
      }
    }

    // Advance the watermark only to timestamps the server actually returned —
    // using the local clock here would skip rows written by devices with
    // slightly ahead clocks.
    const seen = [
      since,
      ...(entriesRes.data ?? []).map((r: any) => r.updated_at as string),
      ...(weightsRes.data ?? []).map((r: any) => r.updated_at as string),
      ...(customRes.data ?? []).map((r: any) => r.updated_at as string),
      ...(workoutsRes.data ?? []).map((r: any) => r.updated_at as string),
      ...(setsRes.data ?? []).map((r: any) => r.updated_at as string),
      ...(routinesRes.data ?? []).map((r: any) => r.updated_at as string),
      ...(customExRes.data ?? []).map((r: any) => r.updated_at as string),
      ...dirtyEntries.map((e) => e.updatedAt),
      ...dirtyWeights.map((w) => w.updatedAt),
      ...dirtyCustom.map((c) => c.updatedAt),
      ...dirtyWorkouts.map((w) => w.updatedAt),
      ...dirtySets.map((s) => s.updatedAt),
      ...dirtyRoutines.map((r) => r.updatedAt),
      ...dirtyCustomEx.map((e) => e.updatedAt),
    ];
    useSyncStore.getState().setLastSyncedAt(seen.reduce((a, b) => (a > b ? a : b)));
    useSyncStore.getState().setStatus('idle');
    return { ok: true };
  } catch (err: any) {
    const message = err?.message ?? 'Sync failed.';
    useSyncStore.getState().setStatus('error', message);
    return { ok: false, message };
  } finally {
    syncing = false;
  }
}

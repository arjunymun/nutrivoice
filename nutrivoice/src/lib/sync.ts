import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useLogStore } from '../stores/useLogStore';
import { useProfileStore } from '../stores/useProfileStore';
import { supabase } from './supabase';
import { CustomFood, FoodLogEntry, Profile, WeightEntry } from './types';

/**
 * Offline-first sync: push dirty local rows, then pull rows changed since the
 * last sync. Conflicts resolve last-write-wins on `updated_at`. Deletes are
 * soft (`deleted` flag) so they propagate across devices.
 */

interface SyncState {
  lastSyncedAt: string | null;
  status: 'idle' | 'syncing' | 'error';
  errorMessage: string | null;
  setStatus: (s: SyncState['status'], err?: string | null) => void;
  setLastSyncedAt: (iso: string) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      lastSyncedAt: null,
      status: 'idle',
      errorMessage: null,
      setStatus: (status, errorMessage = null) => set({ status, errorMessage }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      reset: () => set({ lastSyncedAt: null, status: 'idle', errorMessage: null }),
    }),
    {
      name: 'nutrivoice-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lastSyncedAt: s.lastSyncedAt }) as SyncState,
    },
  ),
);

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
  const sync = useSyncStore.getState();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return { ok: false, message: 'Sign in to sync your data.' };
  }
  const userId = sessionData.session.user.id;

  syncing = true;
  sync.setStatus('syncing');
  try {
    const log = useLogStore.getState();
    const profileStore = useProfileStore.getState();

    // -- push --
    const dirtyEntries = log.entries.filter((e) => e.dirty);
    const dirtyWeights = log.weights.filter((w) => w.dirty);
    const dirtyCustom = log.customFoods.filter((c) => c.dirty);

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
      entryIds: dirtyEntries.map((e) => e.id),
      weightIds: dirtyWeights.map((w) => w.id),
      customFoodIds: dirtyCustom.map((c) => c.id),
    });

    if (profileStore.profile && profileStore.dirty) {
      const { error } = await supabase
        .from('profiles')
        .upsert(profileToRow(profileStore.profile, userId));
      if (error) throw new Error(`Pushing profile failed: ${error.message}`);
      profileStore.markPushed();
    }

    // -- pull --
    const since = sync.lastSyncedAt ?? '1970-01-01T00:00:00Z';

    const [entriesRes, weightsRes, customRes, profileRes] = await Promise.all([
      supabase.from('food_logs').select('*').gt('updated_at', since),
      supabase.from('weight_logs').select('*').gt('updated_at', since),
      supabase.from('custom_foods').select('*').gt('updated_at', since),
      supabase.from('profiles').select('*').maybeSingle(),
    ]);
    for (const res of [entriesRes, weightsRes, customRes, profileRes]) {
      if (res.error) throw new Error(`Pulling data failed: ${res.error.message}`);
    }

    useLogStore.getState().mergeRemote({
      entries: (entriesRes.data ?? []).map(rowToEntry),
      weights: (weightsRes.data ?? []).map(rowToWeight),
      customFoods: (customRes.data ?? []).map(rowToCustomFood),
    });

    const localProfile = useProfileStore.getState().profile;
    if (profileRes.data) {
      const remote = rowToProfile(profileRes.data);
      if (!localProfile || remote.updatedAt > localProfile.updatedAt) {
        useProfileStore.getState().applyRemote(remote);
      }
    }

    useSyncStore.getState().setLastSyncedAt(new Date().toISOString());
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { scaleFood, sumTotals } from '../lib/nutrition';
import { ParsedItem } from '../lib/parser';
import {
  CustomFood,
  Food,
  FoodLogEntry,
  LogSource,
  MacroTotals,
  Meal,
  WeightEntry,
} from '../lib/types';

interface AddEntryInput {
  dateKey: string;
  meal: Meal;
  food?: Food | null;
  name?: string;
  grams: number;
  /** Explicit macros (barcode/custom) — used when no `food` given. */
  macros?: MacroTotals;
  source: LogSource;
}

interface LogState {
  entries: FoodLogEntry[];
  weights: WeightEntry[];
  customFoods: CustomFood[];

  addEntry: (input: AddEntryInput) => FoodLogEntry | null;
  addParsedItems: (items: ParsedItem[], dateKey: string, meal: Meal, source: LogSource) => number;
  updateEntryGrams: (id: string, grams: number, food?: Food | null) => void;
  removeEntry: (id: string) => void;

  addWeight: (dateKey: string, weightKg: number) => void;
  removeWeight: (id: string) => void;

  addCustomFood: (f: Omit<CustomFood, 'id' | 'updatedAt' | 'deleted' | 'dirty' | 'aliases' | 'category' | 'default_portion_g' | 'portion_label'> & Partial<Pick<CustomFood, 'default_portion_g' | 'portion_label'>>) => CustomFood;

  /** Sync support. */
  mergeRemote: (data: { entries?: FoodLogEntry[]; weights?: WeightEntry[]; customFoods?: CustomFood[] }) => void;
  markPushed: (pushed: { entryIds: string[]; weightIds: string[]; customFoodIds: string[] }) => void;
  reset: () => void;
}

const now = () => new Date().toISOString();

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      entries: [],
      weights: [],
      customFoods: [],

      addEntry: (input) => {
        const grams = Math.round(input.grams * 10) / 10;
        if (!(grams > 0) || grams > 10000) return null;
        const macros = input.food ? scaleFood(input.food, grams) : input.macros;
        if (!macros) return null;
        const entry: FoodLogEntry = {
          id: randomUUID(),
          dateKey: input.dateKey,
          meal: input.meal,
          foodId: input.food?.id ?? null,
          name: input.food?.name ?? input.name ?? 'Food',
          grams,
          kcal: Math.round(macros.kcal),
          proteinG: macros.proteinG,
          carbsG: macros.carbsG,
          fatG: macros.fatG,
          source: input.source,
          createdAt: now(),
          updatedAt: now(),
          deleted: false,
          dirty: true,
        };
        set({ entries: [...get().entries, entry] });
        return entry;
      },

      addParsedItems: (items, dateKey, meal, source) => {
        let added = 0;
        for (const item of items) {
          if (!item.food) continue;
          if (get().addEntry({ dateKey, meal, food: item.food, grams: item.grams, source })) added++;
        }
        return added;
      },

      updateEntryGrams: (id, grams, food) => {
        if (!(grams > 0) || grams > 10000) return;
        set({
          entries: get().entries.map((e) => {
            if (e.id !== id) return e;
            // rescale linearly from stored per-entry macros when the source food is unknown
            const factor = grams / e.grams;
            const macros = food
              ? scaleFood(food, grams)
              : {
                  kcal: Math.round(e.kcal * factor),
                  proteinG: Math.round(e.proteinG * factor * 10) / 10,
                  carbsG: Math.round(e.carbsG * factor * 10) / 10,
                  fatG: Math.round(e.fatG * factor * 10) / 10,
                };
            return {
              ...e,
              grams,
              kcal: Math.round(macros.kcal),
              proteinG: macros.proteinG,
              carbsG: macros.carbsG,
              fatG: macros.fatG,
              updatedAt: now(),
              dirty: true,
            };
          }),
        });
      },

      removeEntry: (id) => {
        set({
          entries: get().entries.map((e) =>
            e.id === id ? { ...e, deleted: true, updatedAt: now(), dirty: true } : e,
          ),
        });
      },

      addWeight: (dateKey, weightKg) => {
        if (!(weightKg >= 20) || weightKg > 400) return;
        const existing = get().weights.find((w) => w.dateKey === dateKey && !w.deleted);
        if (existing) {
          set({
            weights: get().weights.map((w) =>
              w.id === existing.id ? { ...w, weightKg, updatedAt: now(), dirty: true } : w,
            ),
          });
        } else {
          set({
            weights: [
              ...get().weights,
              { id: randomUUID(), dateKey, weightKg, updatedAt: now(), deleted: false, dirty: true },
            ],
          });
        }
      },

      removeWeight: (id) => {
        set({
          weights: get().weights.map((w) =>
            w.id === id ? { ...w, deleted: true, updatedAt: now(), dirty: true } : w,
          ),
        });
      },

      addCustomFood: (f) => {
        const food: CustomFood = {
          id: randomUUID(),
          name: f.name,
          aliases: [],
          category: 'custom',
          kcal_100g: f.kcal_100g,
          protein_100g: f.protein_100g,
          carbs_100g: f.carbs_100g,
          fat_100g: f.fat_100g,
          default_portion_g: f.default_portion_g ?? 100,
          portion_label: f.portion_label ?? '100 g',
          barcode: f.barcode ?? null,
          updatedAt: now(),
          deleted: false,
          dirty: true,
        };
        set({ customFoods: [...get().customFoods, food] });
        return food;
      },

      mergeRemote: (data) => {
        const mergeById = <T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] => {
          const map = new Map(local.map((x) => [x.id, x]));
          for (const r of remote) {
            const l = map.get(r.id);
            if (!l || r.updatedAt > l.updatedAt) map.set(r.id, r);
          }
          return [...map.values()];
        };
        set({
          entries: data.entries ? mergeById(get().entries, data.entries) : get().entries,
          weights: data.weights ? mergeById(get().weights, data.weights) : get().weights,
          customFoods: data.customFoods ? mergeById(get().customFoods, data.customFoods) : get().customFoods,
        });
      },

      markPushed: ({ entryIds, weightIds, customFoodIds }) => {
        const e = new Set(entryIds);
        const w = new Set(weightIds);
        const c = new Set(customFoodIds);
        set({
          entries: get().entries.map((x) => (e.has(x.id) ? { ...x, dirty: false } : x)),
          weights: get().weights.map((x) => (w.has(x.id) ? { ...x, dirty: false } : x)),
          customFoods: get().customFoods.map((x) => (c.has(x.id) ? { ...x, dirty: false } : x)),
        });
      },

      reset: () => set({ entries: [], weights: [], customFoods: [] }),
    }),
    {
      name: 'nutrivoice-log',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Entries for one day (excluding soft-deleted), grouped helpers. */
export function entriesForDay(entries: FoodLogEntry[], dateKey: string): FoodLogEntry[] {
  return entries.filter((e) => e.dateKey === dateKey && !e.deleted);
}

export function dayTotals(entries: FoodLogEntry[], dateKey: string): MacroTotals {
  return sumTotals(entriesForDay(entries, dateKey).map((e) => ({
    kcal: e.kcal,
    proteinG: e.proteinG,
    carbsG: e.carbsG,
    fatG: e.fatG,
  })));
}

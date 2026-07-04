export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'cut' | 'maintain' | 'bulk';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type LogSource = 'voice' | 'search' | 'barcode' | 'manual' | 'ai';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Food {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  default_portion_g: number;
  portion_label: string;
}

export interface CustomFood extends Food {
  barcode: string | null;
  updatedAt: string;
  deleted: boolean;
  dirty?: boolean;
}

export interface Profile {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** When true, target* fields were set by hand and are not recomputed. */
  customTargets: boolean;
  targetKcal: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  updatedAt: string;
}

export interface FoodLogEntry {
  id: string;
  /** Local date key YYYY-MM-DD. */
  dateKey: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: LogSource;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  /** Not yet pushed to the server. */
  dirty?: boolean;
}

export interface WeightEntry {
  id: string;
  dateKey: string;
  weightKg: number;
  updatedAt: string;
  deleted: boolean;
  dirty?: boolean;
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** Local-timezone date key. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const d = dateKeyToDate(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

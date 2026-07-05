import { ActivityLevel, Food, Goal, MacroTotals, Profile, Sex } from './types';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk job, no exercise)',
  light: 'Light (1-3 workouts/week)',
  moderate: 'Moderate (3-5 workouts/week)',
  active: 'Active (6-7 workouts/week)',
  very_active: 'Very active (athlete / physical job)',
};

export const GOAL_LABELS: Record<Goal, string> = {
  cut: 'Cut (lose fat)',
  maintain: 'Maintain',
  bulk: 'Bulk (build muscle)',
};

const GOAL_KCAL_MULTIPLIER: Record<Goal, number> = {
  cut: 0.8,
  maintain: 1,
  bulk: 1.1,
};

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(value: number): string {
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Normal';
  if (value < 30) return 'Overweight';
  return 'Obese';
}

export function ageFromBirthYear(birthYear: number, now = new Date()): number {
  return Math.max(0, now.getFullYear() - birthYear);
}

/** Mifflin-St Jeor basal metabolic rate. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: ActivityLevel): number {
  return bmr(sex, weightKg, heightCm, age) * ACTIVITY_FACTORS[activity];
}

export interface Targets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Bodybuilding-oriented defaults: protein 2 g/kg, fat 25% of calories,
 * carbs fill the remainder. Goal shifts calories around TDEE.
 */
export function computeTargets(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'birthYear' | 'activityLevel' | 'goal'>): Targets {
  const age = ageFromBirthYear(p.birthYear);
  const kcal = Math.round(tdee(p.sex, p.weightKg, p.heightCm, age, p.activityLevel) * GOAL_KCAL_MULTIPLIER[p.goal]);
  const proteinG = Math.round(2 * p.weightKg);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal, proteinG, carbsG, fatG };
}

/**
 * Macro split for an explicit calorie number (adaptive-TDEE accept path):
 * protein 2 g/kg, fat 25% of calories, carbs the remainder — same split as
 * computeTargets but anchored to observed expenditure instead of the formula.
 */
export function targetsFromKcal(kcal: number, weightKg: number): Targets {
  const proteinG = Math.round(2 * weightKg);
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal: Math.round(kcal), proteinG, carbsG, fatG };
}

/** Macros for `grams` of a food defined per 100 g. */
export function scaleFood(food: Food, grams: number): MacroTotals {
  const f = grams / 100;
  return {
    kcal: Math.round(food.kcal_100g * f),
    proteinG: Math.round(food.protein_100g * f * 10) / 10,
    carbsG: Math.round(food.carbs_100g * f * 10) / 10,
    fatG: Math.round(food.fat_100g * f * 10) / 10,
  };
}

export function sumTotals(items: MacroTotals[]): MacroTotals {
  return items.reduce(
    (acc, t) => ({
      kcal: acc.kcal + t.kcal,
      proteinG: acc.proteinG + t.proteinG,
      carbsG: acc.carbsG + t.carbsG,
      fatG: acc.fatG + t.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

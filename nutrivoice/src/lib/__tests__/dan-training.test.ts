import exercises from '../../data/exercises.json';
import { estimateTdee } from '../adaptiveTdee';
import { parseGymText } from '../gymParser';
import { addDays } from '../types';
import { detectPrs, workoutVolume } from '../workoutMath';
import { Exercise, Workout, WorkoutSet } from '../workoutTypes';
import { FoodLogEntry, WeightEntry } from '../types';

/**
 * Dan v2 — 4-week synthetic bulk with KNOWN ground truth:
 * true TDEE 3200 kcal, eats 3450/day → +250 surplus → +0.0325 kg/day.
 * Trains 4x/week, squat/bench progress weekly, logged via the VOICE parser
 * (so this exercises gymParser → store-shaped data → math end to end).
 * Assertions: adaptive TDEE converges within ±7%, PRs detected in week 4,
 * weekly volume trends up.
 */

const DB = exercises as Exercise[];
const TODAY = '2026-07-05';
const TRUE_TDEE = 3200;
const INTAKE = 3450;
const KG_PER_DAY = (INTAKE - TRUE_TDEE) / 7700;

const noise = [0.31, -0.24, 0.18, -0.35, 0.09, -0.15, 0.27, 0.02, -0.09, 0.2, -0.28, 0.12, 0.38, -0.19, 0.05, 0.25, -0.33, 0.15, -0.07, 0.22, -0.11, 0.3, -0.26, 0.08, 0.17, -0.21, 0.04, 0.29];

describe('Dan v2 — four-week bulk simulation', () => {
  // build 28 days of data, day 27 ago .. day 0 (today)
  const entries: FoodLogEntry[] = [];
  const weights: WeightEntry[] = [];
  for (let ago = 27; ago >= 0; ago--) {
    const dateKey = addDays(TODAY, -ago);
    entries.push({
      id: `e${ago}`, dateKey, meal: 'lunch', foodId: null, name: 'day total',
      grams: 100, kcal: INTAKE, proteinG: 180, carbsG: 400, fatG: 95,
      source: 'manual', createdAt: dateKey, updatedAt: dateKey, deleted: false,
    });
    weights.push({
      id: `w${ago}`, dateKey,
      weightKg: 84 + (27 - ago) * KG_PER_DAY + noise[ago] * 0.4,
      updatedAt: dateKey, deleted: false,
    });
  }

  // workouts: Mon/Tue/Thu/Fri each week; squat +5 kg/week, bench +2.5 kg/week
  const workouts: Workout[] = [];
  const sets: WorkoutSet[] = [];
  let setN = 0;
  for (let week = 0; week < 4; week++) {
    const squatKg = 100 + week * 5;
    const benchKg = 70 + week * 2.5;
    const sessions = [
      `squats 5x5 ${squatKg}, rdl 3x10 80`,
      `bench press 5x5 at ${benchKg}, lat pulldown 3x12 55`,
      `squats 5x5 ${squatKg}, ohp 3x8 40`,
      `bench press 5x5 at ${benchKg}, barbell row 3x10 60`,
    ];
    sessions.forEach((line, i) => {
      const ago = (3 - week) * 7 + (6 - i * 2); // spread through the week
      const dateKey = addDays(TODAY, -ago);
      const w: Workout = {
        id: `wk${week}-${i}`, startedAt: `${dateKey}T18:00:00Z`, name: 'Session',
        notes: null, durationS: 3600, updatedAt: `${dateKey}T19:00:00Z`, deleted: false,
      };
      workouts.push(w);
      for (const g of parseGymText(line, DB)) {
        expect(g.exercise).not.toBeNull(); // voice lines must parse
        for (let s = 0; s < g.sets; s++) {
          sets.push({
            id: `s${++setN}`, workoutId: w.id, exerciseId: g.exercise!.id,
            setNumber: s + 1, weightKg: g.weightKg, reps: g.reps, durationS: null,
            rpe: null, isWarmup: false, setType: 'normal', updatedAt: w.updatedAt, deleted: false,
          });
        }
      }
    });
  }

  test('adaptive TDEE converges to ground truth within ±7%', () => {
    const est = estimateTdee({
      entries, weights,
      targetKcal: 3450, bmrKcal: 1900, priorTdeeKcal: 3100, today: TODAY,
    });
    expect(est.available).toBe(true);
    if (est.available) {
      expect(Math.abs(est.rawTdeeKcal - TRUE_TDEE) / TRUE_TDEE).toBeLessThan(0.07);
      expect(est.trendKgPerWeek).toBeGreaterThan(0.1);
      expect(est.trendKgPerWeek).toBeLessThan(0.4);
    }
  });

  test('final-week sessions register PRs on progressed lifts', () => {
    const lastSquat = workouts.find((w) => w.id === 'wk3-0')!;
    const prs = detectPrs(sets, workouts, lastSquat.id);
    expect(prs.some((p) => p.exerciseId === 'barbell-back-squat')).toBe(true);
  });

  test('weekly volume trends upward', () => {
    const weekVolume = (week: number) =>
      workouts
        .filter((w) => w.id.startsWith(`wk${week}-`))
        .reduce((sum, w) => sum + workoutVolume(sets.filter((s) => s.workoutId === w.id)), 0);
    expect(weekVolume(3)).toBeGreaterThan(weekVolume(0));
  });
});

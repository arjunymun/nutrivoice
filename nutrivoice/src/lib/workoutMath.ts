import { Exercise, Workout, WorkoutSet } from './workoutTypes';

/** Big lifts whose PRs get surfaced on the Stats tab (catalog ids). */
export const BIG_LIFTS: { id: string; label: string }[] = [
  { id: 'barbell-bench-press', label: 'Bench Press' },
  { id: 'barbell-back-squat', label: 'Back Squat' },
  { id: 'conventional-deadlift', label: 'Deadlift' },
  { id: 'overhead-press', label: 'Overhead Press' },
  { id: 'barbell-bent-over-row', label: 'Barbell Row' },
  { id: 'romanian-deadlift', label: 'RDL' },
];

/**
 * Epley estimated 1RM. Only meaningful for loaded rep work in the 1–12 rep
 * range; warmups excluded by callers.
 */
export function epley1Rm(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

const countableSet = (s: WorkoutSet) => !s.deleted && !s.isWarmup;

/** Tonnage of one set (kg). Bodyweight/duration sets contribute 0. */
export function setVolume(s: WorkoutSet): number {
  if (!countableSet(s) || s.weightKg == null || s.reps == null) return 0;
  return s.weightKg * s.reps;
}

export function workoutVolume(sets: WorkoutSet[]): number {
  return Math.round(sets.reduce((sum, s) => sum + setVolume(s), 0));
}

export function workoutSetCount(sets: WorkoutSet[]): number {
  return sets.filter(countableSet).length;
}

/** Best e1RM per exercise across a list of sets. */
export function bestE1RmByExercise(sets: WorkoutSet[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const s of sets) {
    if (!countableSet(s) || s.weightKg == null || s.reps == null) continue;
    const e = epley1Rm(s.weightKg, s.reps);
    if (e == null) continue;
    if (e > (best.get(s.exerciseId) ?? 0)) best.set(s.exerciseId, e);
  }
  return best;
}

export interface PrHit {
  exerciseId: string;
  newE1Rm: number;
  previousE1Rm: number | null;
}

/** PRs achieved in `workoutId` relative to all EARLIER sets. */
export function detectPrs(allSets: WorkoutSet[], workouts: Workout[], workoutId: string): PrHit[] {
  const workout = workouts.find((w) => w.id === workoutId);
  if (!workout) return [];
  const liveWorkoutIds = new Set(workouts.filter((w) => !w.deleted).map((w) => w.id));
  const before = allSets.filter(
    (s) =>
      s.workoutId !== workoutId &&
      liveWorkoutIds.has(s.workoutId) &&
      (workouts.find((w) => w.id === s.workoutId)?.startedAt ?? '') < workout.startedAt,
  );
  const during = allSets.filter((s) => s.workoutId === workoutId);
  const prevBest = bestE1RmByExercise(before);
  const nowBest = bestE1RmByExercise(during);
  const prs: PrHit[] = [];
  for (const [exerciseId, e1rm] of nowBest) {
    const prev = prevBest.get(exerciseId) ?? null;
    if (prev == null || e1rm > prev) prs.push({ exerciseId, newE1Rm: e1rm, previousE1Rm: prev });
  }
  return prs;
}

export interface ProgressionSuggestion {
  action: 'increase' | 'hold' | 'deload';
  weightKg: number;
  reason: string;
}

/**
 * Deterministic double progression:
 * - hit target reps on every working set in the last two sessions → +2.5 kg
 *   (+5 kg for lower-body barbell lifts);
 * - 3+ sessions at the same weight without progress → 10% deload;
 * - otherwise hold.
 */
export function suggestNextWeight(
  exercise: Exercise,
  sessionSets: WorkoutSet[][],
  targetReps: number,
): ProgressionSuggestion | null {
  const working = sessionSets
    .map((sets) => sets.filter((s) => countableSet(s) && s.weightKg != null && s.reps != null))
    .filter((sets) => sets.length > 0);
  if (working.length === 0) return null;

  const last = working[working.length - 1];
  const lastWeight = Math.max(...last.map((s) => s.weightKg!));
  const lowerBody = ['quads', 'hamstrings', 'glutes'].includes(exercise.primary_muscle);
  const increment = exercise.equipment === 'barbell' && lowerBody ? 5 : 2.5;

  const hitTarget = (sets: WorkoutSet[]) =>
    Math.max(...sets.map((s) => s.weightKg!)) >= lastWeight &&
    sets.every((s) => (s.reps ?? 0) >= targetReps);

  const recent = working.slice(-2);
  if (recent.length === 2 && recent.every(hitTarget)) {
    return {
      action: 'increase',
      weightKg: Math.round((lastWeight + increment) * 10) / 10,
      reason: `Hit ${targetReps}+ reps two sessions running — add ${increment} kg.`,
    };
  }

  const stalled = working.slice(-3);
  if (
    stalled.length === 3 &&
    stalled.every((sets) => Math.max(...sets.map((s) => s.weightKg!)) === lastWeight) &&
    stalled.every((sets) => !hitTarget(sets))
  ) {
    return {
      action: 'deload',
      weightKg: Math.round(lastWeight * 0.9 * 2) / 2,
      reason: 'Three stalled sessions — deload 10% and build back up.',
    };
  }

  return {
    action: 'hold',
    weightKg: lastWeight,
    reason: `Stay at ${lastWeight} kg until all sets reach ${targetReps} reps.`,
  };
}

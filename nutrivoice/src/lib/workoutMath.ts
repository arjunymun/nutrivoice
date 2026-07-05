import { Exercise, MuscleGroup, Workout, WorkoutSet } from './workoutTypes';

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

// ---------------- per-exercise records & history ----------------

export interface ExerciseSession {
  workoutId: string;
  startedAt: string;
  e1rm: number | null;
  volume: number;
  topWeightKg: number | null;
  topReps: number | null;
  sets: number;
}

export interface ExerciseRecords {
  sessions: ExerciseSession[]; // oldest → newest
  bestE1Rm: number | null;
  heaviestKg: number | null;
  bestSessionVolume: number;
  mostReps: number | null;
  totalSets: number;
  totalVolume: number;
}

/**
 * All-time records and per-session history for one exercise, across every live
 * (non-deleted) workout. Warmup/deleted sets are excluded. Sessions are ordered
 * oldest → newest so a chart can plot progress left-to-right.
 */
export function exerciseRecords(
  allSets: WorkoutSet[],
  workouts: Workout[],
  exerciseId: string,
): ExerciseRecords {
  const live = new Map(workouts.filter((w) => !w.deleted).map((w) => [w.id, w]));
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of allSets) {
    if (s.exerciseId !== exerciseId || !countableSet(s) || !live.has(s.workoutId)) continue;
    const arr = byWorkout.get(s.workoutId) ?? [];
    arr.push(s);
    byWorkout.set(s.workoutId, arr);
  }

  const sessions: ExerciseSession[] = [];
  for (const [workoutId, sets] of byWorkout) {
    const w = live.get(workoutId)!;
    let e1rm: number | null = null;
    let volume = 0;
    let topWeightKg: number | null = null;
    let topReps: number | null = null;
    for (const s of sets) {
      volume += setVolume(s);
      const e = s.weightKg != null && s.reps != null ? epley1Rm(s.weightKg, s.reps) : null;
      if (e != null && (e1rm == null || e > e1rm)) e1rm = e;
      if (s.weightKg != null && (topWeightKg == null || s.weightKg > topWeightKg)) {
        topWeightKg = s.weightKg;
      }
      if (s.reps != null && (topReps == null || s.reps > topReps)) topReps = s.reps;
    }
    sessions.push({
      workoutId,
      startedAt: w.startedAt,
      e1rm,
      volume: Math.round(volume),
      topWeightKg,
      topReps,
      sets: sets.length,
    });
  }
  sessions.sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));

  return {
    sessions,
    bestE1Rm: sessions.reduce<number | null>((m, s) => (s.e1rm != null && (m == null || s.e1rm > m) ? s.e1rm : m), null),
    heaviestKg: sessions.reduce<number | null>(
      (m, s) => (s.topWeightKg != null && (m == null || s.topWeightKg > m) ? s.topWeightKg : m),
      null,
    ),
    bestSessionVolume: sessions.reduce((m, s) => Math.max(m, s.volume), 0),
    mostReps: sessions.reduce<number | null>((m, s) => (s.topReps != null && (m == null || s.topReps > m) ? s.topReps : m), null),
    totalSets: sessions.reduce((n, s) => n + s.sets, 0),
    totalVolume: sessions.reduce((n, s) => n + s.volume, 0),
  };
}

// ---------------- weekly muscle-group volume ----------------

/**
 * Working sets per muscle group in the trailing window (default 7 days).
 * The primary muscle counts as a full set, each secondary muscle as a half set
 * (the standard way volume-per-muscle is apportioned). Warmups excluded.
 */
export function muscleWeeklyVolume(
  allSets: WorkoutSet[],
  workouts: Workout[],
  exercises: Map<string, Pick<Exercise, 'primary_muscle' | 'secondary_muscles'>>,
  opts: { sinceDays?: number; nowMs?: number } = {},
): Map<MuscleGroup, number> {
  const sinceDays = opts.sinceDays ?? 7;
  const nowMs = opts.nowMs ?? Date.now();
  const cutoff = nowMs - sinceDays * 86_400_000;
  const inWindow = new Set(
    workouts.filter((w) => !w.deleted && new Date(w.startedAt).getTime() >= cutoff).map((w) => w.id),
  );
  const out = new Map<MuscleGroup, number>();
  const add = (m: MuscleGroup, n: number) => out.set(m, (out.get(m) ?? 0) + n);
  for (const s of allSets) {
    if (!countableSet(s) || !inWindow.has(s.workoutId)) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    add(ex.primary_muscle, 1);
    for (const sec of ex.secondary_muscles) add(sec, 0.5);
  }
  return out;
}

// ---------------- plate calculator ----------------

export interface PlateLoad {
  barKg: number;
  /** Plates on ONE side, heaviest first. */
  perSide: number[];
  /** kg that couldn't be made with the available plates (per bar, both sides). */
  leftover: number;
}

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Greedy plates-per-side for a target barbell weight. */
export function plateBreakdown(
  totalKg: number,
  barKg = 20,
  available: number[] = KG_PLATES,
): PlateLoad {
  if (!(totalKg > 0) || totalKg < barKg) {
    return { barKg, perSide: [], leftover: Math.max(0, Math.round((totalKg - barKg) * 100) / 100) };
  }
  let perSideKg = (totalKg - barKg) / 2;
  const perSide: number[] = [];
  for (const p of [...available].sort((a, b) => b - a)) {
    while (perSideKg >= p - 1e-9) {
      perSide.push(p);
      perSideKg = Math.round((perSideKg - p) * 100) / 100;
    }
  }
  return { barKg, perSide, leftover: Math.round(perSideKg * 2 * 100) / 100 };
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

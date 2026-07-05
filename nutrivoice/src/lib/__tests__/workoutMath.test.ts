import exercises from '../../data/exercises.json';
import { bestE1RmByExercise, detectPrs, epley1Rm, suggestNextWeight, workoutVolume } from '../workoutMath';
import { Exercise, Workout, WorkoutSet } from '../workoutTypes';

const DB = exercises as Exercise[];
const bench = DB.find((e) => e.id === 'barbell-bench-press')!;
const squat = DB.find((e) => e.id === 'barbell-back-squat')!;

let n = 0;
const mkSet = (workoutId: string, exerciseId: string, weightKg: number | null, reps: number | null, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${++n}`,
  workoutId,
  exerciseId,
  setNumber: 1,
  weightKg,
  reps,
  durationS: null,
  rpe: null,
  isWarmup: false,
  setType: 'normal',
  updatedAt: '2026-01-01T00:00:00Z',
  deleted: false,
  ...extra,
});

const mkWorkout = (id: string, startedAt: string): Workout => ({
  id,
  startedAt,
  name: 'W',
  notes: null,
  durationS: 3600,
  updatedAt: startedAt,
  deleted: false,
});

describe('workoutMath', () => {
  test('epley: 1RM passthrough, formula, invalid ranges', () => {
    expect(epley1Rm(100, 1)).toBe(100);
    expect(epley1Rm(100, 5)).toBeCloseTo(116.7, 1);
    expect(epley1Rm(100, 13)).toBeNull();
    expect(epley1Rm(0, 5)).toBeNull();
  });

  test('volume ignores warmups, deleted, bodyweight', () => {
    const sets = [
      mkSet('w1', 'barbell-bench-press', 60, 10),
      mkSet('w1', 'barbell-bench-press', 40, 10, { isWarmup: true }),
      mkSet('w1', 'pull-up', null, 8),
      mkSet('w1', 'barbell-bench-press', 60, 8, { deleted: true }),
    ];
    expect(workoutVolume(sets)).toBe(600);
  });

  test('PR detection against earlier workouts only', () => {
    const workouts = [mkWorkout('w1', '2026-06-01T10:00:00Z'), mkWorkout('w2', '2026-06-08T10:00:00Z')];
    const sets = [
      mkSet('w1', 'barbell-bench-press', 80, 5), // e1RM 93.3
      mkSet('w2', 'barbell-bench-press', 85, 5), // e1RM 99.2 → PR
      mkSet('w2', 'barbell-back-squat', 100, 5), // first time → PR
    ];
    const prs = detectPrs(sets, workouts, 'w2');
    expect(prs).toHaveLength(2);
    const benchPr = prs.find((p) => p.exerciseId === 'barbell-bench-press')!;
    expect(benchPr.previousE1Rm).toBeCloseTo(93.3, 1);
    expect(benchPr.newE1Rm).toBeCloseTo(99.2, 1);
  });

  test('bestE1RmByExercise picks the top set', () => {
    const sets = [
      mkSet('w1', 'barbell-bench-press', 80, 5),
      mkSet('w1', 'barbell-bench-press', 90, 2),
    ];
    expect(bestE1RmByExercise(sets).get('barbell-bench-press')).toBeCloseTo(96, 0);
  });

  test('double progression: increase after two full sessions', () => {
    const s1 = [mkSet('w1', bench.id, 60, 8), mkSet('w1', bench.id, 60, 8)];
    const s2 = [mkSet('w2', bench.id, 60, 8), mkSet('w2', bench.id, 60, 9)];
    const sug = suggestNextWeight(bench, [s1, s2], 8)!;
    expect(sug.action).toBe('increase');
    expect(sug.weightKg).toBe(62.5);
  });

  test('lower-body barbell gets +5 kg', () => {
    const s1 = [mkSet('w1', squat.id, 100, 5)];
    const s2 = [mkSet('w2', squat.id, 100, 5)];
    const sug = suggestNextWeight(squat, [s1, s2], 5)!;
    expect(sug.action).toBe('increase');
    expect(sug.weightKg).toBe(105);
  });

  test('deload after three stalled sessions', () => {
    const stall = () => [mkSet('w', bench.id, 80, 5), mkSet('w', bench.id, 80, 4)];
    const sug = suggestNextWeight(bench, [stall(), stall(), stall()], 8)!;
    expect(sug.action).toBe('deload');
    expect(sug.weightKg).toBe(72);
  });

  test('hold otherwise', () => {
    const s1 = [mkSet('w1', bench.id, 60, 8)];
    const s2 = [mkSet('w2', bench.id, 60, 6)];
    const sug = suggestNextWeight(bench, [s1, s2], 8)!;
    expect(sug.action).toBe('hold');
  });
});

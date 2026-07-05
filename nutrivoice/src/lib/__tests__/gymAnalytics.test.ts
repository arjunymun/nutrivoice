import exercises from '../../data/exercises.json';
import { exerciseRecords, muscleWeeklyVolume, plateBreakdown } from '../workoutMath';
import { Exercise, Workout, WorkoutSet } from '../workoutTypes';

const DB = exercises as Exercise[];

let n = 0;
const set = (
  workoutId: string,
  exerciseId: string,
  weightKg: number | null,
  reps: number | null,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet => ({
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

const workout = (id: string, startedAt: string): Workout => ({
  id,
  startedAt,
  name: 'W',
  notes: null,
  durationS: 3600,
  updatedAt: startedAt,
  deleted: false,
});

describe('exerciseRecords', () => {
  const workouts = [
    workout('w1', '2026-06-01T18:00:00Z'),
    workout('w2', '2026-06-08T18:00:00Z'),
    workout('w3', '2026-06-15T18:00:00Z'),
  ];
  const sets = [
    set('w1', 'barbell-bench-press', 60, 5),
    set('w1', 'barbell-bench-press', 60, 5),
    set('w1', 'barbell-bench-press', 40, 10, { isWarmup: true, setType: 'warmup' }), // ignored
    set('w2', 'barbell-bench-press', 65, 5),
    set('w3', 'barbell-bench-press', 70, 3),
  ];

  it('orders sessions oldest → newest and excludes warmups', () => {
    const r = exerciseRecords(sets, workouts, 'barbell-bench-press');
    expect(r.sessions.map((s) => s.workoutId)).toEqual(['w1', 'w2', 'w3']);
    expect(r.sessions[0].volume).toBe(600); // 60*5 + 60*5, warmup excluded
    expect(r.sessions[0].sets).toBe(2);
  });

  it('tracks all-time records', () => {
    const r = exerciseRecords(sets, workouts, 'barbell-bench-press');
    expect(r.heaviestKg).toBe(70);
    expect(r.mostReps).toBe(5); // top non-warmup reps = 5 (the 10-rep set is a warmup)
    expect(r.bestE1Rm).toBe(epleyExpected(70, 3));
    expect(r.totalSets).toBe(4);
    expect(r.totalVolume).toBe(600 + 325 + 210);
  });

  it('ignores deleted workouts', () => {
    const r = exerciseRecords(sets, [workouts[0], workouts[1], { ...workouts[2], deleted: true }], 'barbell-bench-press');
    expect(r.sessions.map((s) => s.workoutId)).toEqual(['w1', 'w2']);
    expect(r.heaviestKg).toBe(65);
  });
});

function epleyExpected(w: number, reps: number) {
  return Math.round(w * (1 + reps / 30) * 10) / 10;
}

describe('muscleWeeklyVolume', () => {
  const index = new Map(DB.map((e) => [e.id, e]));
  const now = new Date('2026-06-15T12:00:00Z').getTime();

  it('counts primary as 1 set, secondary as 0.5, within the window', () => {
    const workouts = [
      workout('recent', '2026-06-14T18:00:00Z'),
      workout('old', '2026-06-01T18:00:00Z'), // outside 7-day window
    ];
    const bench = DB.find((e) => e.id === 'barbell-bench-press')!;
    const sets = [
      set('recent', 'barbell-bench-press', 60, 5),
      set('recent', 'barbell-bench-press', 60, 5),
      set('old', 'barbell-bench-press', 60, 5),
    ];
    const vol = muscleWeeklyVolume(sets, workouts, index, { nowMs: now, sinceDays: 7 });
    expect(vol.get('chest')).toBe(2); // two recent working sets on the primary
    // bench secondaries (e.g. triceps/shoulders) get 0.5 each × 2 recent sets = 1
    for (const sec of bench.secondary_muscles) expect(vol.get(sec)).toBe(1);
  });

  it('excludes warmups', () => {
    const workouts = [workout('recent', '2026-06-14T18:00:00Z')];
    const sets = [set('recent', 'barbell-bench-press', 60, 5, { isWarmup: true, setType: 'warmup' })];
    const vol = muscleWeeklyVolume(sets, workouts, index, { nowMs: now });
    expect(vol.get('chest')).toBeUndefined();
  });
});

describe('plateBreakdown', () => {
  it('loads a 20kg bar to 100kg = 40 per side (largest-first)', () => {
    const r = plateBreakdown(100, 20);
    expect(r.perSide).toEqual([25, 15]);
    expect(r.leftover).toBe(0);
  });

  it('mixes plate sizes', () => {
    const r = plateBreakdown(142.5, 20);
    // per side = 61.25 → 25,25,10,1.25
    expect(r.perSide).toEqual([25, 25, 10, 1.25]);
    expect(r.leftover).toBe(0);
  });

  it('reports unmakeable leftover', () => {
    const r = plateBreakdown(101, 20); // per side 40.5 → 40 loaded, 0.5 leftover ×2 = 1
    expect(r.perSide).toEqual([25, 15]);
    expect(r.leftover).toBe(1);
  });

  it('returns empty for sub-bar weights', () => {
    expect(plateBreakdown(15, 20).perSide).toEqual([]);
  });
});

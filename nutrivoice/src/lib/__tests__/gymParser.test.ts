import exercises from '../../data/exercises.json';
import { parseGymText } from '../gymParser';
import { Exercise } from '../workoutTypes';

const DB = exercises as Exercise[];
const parse = (t: string) => parseGymText(t, DB);

describe('parseGymText', () => {
  test('canonical: bench press 3 sets of 8 at 60 kg', () => {
    const [g] = parse('bench press 3 sets of 8 at 60 kg');
    expect(g.exercise?.id).toBe('barbell-bench-press');
    expect(g.sets).toBe(3);
    expect(g.reps).toBe(8);
    expect(g.weightKg).toBe(60);
  });

  test('NxM with trailing bare number = kg: squats 5x5 100', () => {
    const [g] = parse('squats 5x5 100');
    expect(g.exercise?.id).toBe('barbell-back-squat');
    expect(g.sets).toBe(5);
    expect(g.reps).toBe(5);
    expect(g.weightKg).toBe(100);
  });

  test('slang: rdl 3x10 80', () => {
    const [g] = parse('rdl 3x10 80');
    expect(g.exercise?.id).toBe('romanian-deadlift');
    expect(g.weightKg).toBe(80);
  });

  test('lbs conversion', () => {
    const [g] = parse('deadlift 5 reps at 315 lbs');
    expect(g.exercise?.id).toBe('conventional-deadlift');
    expect(g.reps).toBe(5);
    expect(g.weightKg).toBeCloseTo(142.9, 1);
  });

  test('rpe is keyword-gated: "at 8" is weight, "rpe 8" is rpe', () => {
    const [a] = parse('ohp 3x5 at 8');
    expect(a.weightKg).toBe(8);
    expect(a.rpe).toBeNull();

    const [b] = parse('ohp 3x5 at 40 rpe 8');
    expect(b.weightKg).toBe(40);
    expect(b.rpe).toBe(8);
  });

  test('bodyweight: pull ups 3x8 bodyweight', () => {
    const [g] = parse('pull ups 3x8 bodyweight');
    expect(g.exercise?.id).toBe('pull-up');
    expect(g.weightKg).toBeNull();
    expect(g.reps).toBe(8);
  });

  test('duration exercise: plank 60 seconds', () => {
    const [g] = parse('plank 60 seconds');
    expect(g.exercise?.load_type).toBe('duration');
    expect(g.durationS).toBe(60);
  });

  test('multi-exercise sentence splits', () => {
    const groups = parse('bench 5x5 80 then squats 3x8 at 100, lat pulldown 3x12 55');
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.exercise !== null)).toBe(true);
    expect(groups[1].weightKg).toBe(100);
    expect(groups[2].sets).toBe(3);
  });

  test('unknown exercise kept with null match', () => {
    const [g] = parse('flurbo blasts 3x10 50');
    expect(g.exercise).toBeNull();
    expect(g.sets).toBe(3);
  });

  test('junk input returns nothing', () => {
    expect(parse('')).toHaveLength(0);
    expect(parse('   ')).toHaveLength(0);
  });
});

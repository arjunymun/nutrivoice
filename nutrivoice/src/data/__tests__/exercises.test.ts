import exercises from '../exercises.json';
import { Exercise } from '../../lib/workoutTypes';

const DB = exercises as Exercise[];

const MUSCLES = new Set([
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quads',
  'hamstrings', 'glutes', 'calves', 'core', 'full_body', 'cardio',
]);
const EQUIPMENT = new Set(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other']);
const LOAD = new Set(['weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'duration']);

describe('exercise catalog', () => {
  test('has a substantial catalog', () => {
    expect(DB.length).toBeGreaterThanOrEqual(150);
  });

  test('ids unique + kebab-case; enums valid; met sane; aliases lowercase', () => {
    const ids = new Set<string>();
    for (const e of DB) {
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(MUSCLES.has(e.primary_muscle)).toBe(true);
      e.secondary_muscles.forEach((m) => expect(MUSCLES.has(m)).toBe(true));
      expect(EQUIPMENT.has(e.equipment)).toBe(true);
      expect(LOAD.has(e.load_type)).toBe(true);
      expect(e.met).toBeGreaterThanOrEqual(2);
      expect(e.met).toBeLessThanOrEqual(10);
      e.aliases.forEach((a) => expect(a).toBe(a.toLowerCase()));
    }
  });

  test('big lifts for PR tracking exist', () => {
    const ids = new Set(DB.map((e) => e.id));
    for (const id of [
      'barbell-bench-press', 'barbell-back-squat', 'conventional-deadlift',
      'overhead-press', 'barbell-bent-over-row', 'romanian-deadlift',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test('gym slang resolves: bench, ohp, rdl, lat pulldown', () => {
    const all = DB.flatMap((e) => [e.name.toLowerCase(), ...e.aliases]);
    for (const slang of ['bench', 'ohp', 'rdl', 'lat pulldown', 'pull up', 'squat']) {
      expect(all.some((a) => a.includes(slang))).toBe(true);
    }
  });
});

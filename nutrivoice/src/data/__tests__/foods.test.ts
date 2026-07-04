import foods from '../foods.json';
import { Food } from '../../lib/types';

const DB = foods as Food[];

describe('bundled food database', () => {
  test('has a substantial dataset', () => {
    expect(DB.length).toBeGreaterThanOrEqual(300);
  });

  test('ids are unique and kebab-case', () => {
    const ids = new Set<string>();
    for (const f of DB) {
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
    }
  });

  test('every entry passes schema and range checks', () => {
    for (const f of DB) {
      expect(typeof f.name).toBe('string');
      expect(f.name.length).toBeGreaterThan(0);
      expect(Array.isArray(f.aliases)).toBe(true);
      expect(f.kcal_100g).toBeGreaterThanOrEqual(0);
      expect(f.kcal_100g).toBeLessThanOrEqual(900);
      for (const m of [f.protein_100g, f.carbs_100g, f.fat_100g]) {
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(100);
      }
      expect(f.default_portion_g).toBeGreaterThanOrEqual(1);
      expect(f.default_portion_g).toBeLessThanOrEqual(1000);
      expect(typeof f.portion_label).toBe('string');
    }
  });

  test('calories are consistent with macros (Atwater, alcohol exempt)', () => {
    for (const f of DB) {
      if (/beer|wine|whisky|vodka|rum|spirit/i.test(f.name)) continue;
      const atwater = 4 * f.protein_100g + 4 * f.carbs_100g + 9 * f.fat_100g;
      const tolerance = Math.max(18, 0.2 * f.kcal_100g);
      expect(Math.abs(atwater - f.kcal_100g)).toBeLessThanOrEqual(tolerance);
    }
  });

  test('key Indian staples are present', () => {
    const names = DB.flatMap((f) => [f.name.toLowerCase(), ...f.aliases]).join(' ');
    for (const staple of ['roti', 'dahi', 'ghee', 'paneer', 'dal', 'rice', 'chicken breast', 'egg']) {
      expect(names).toContain(staple);
    }
  });
});

import { bmi, bmiCategory, bmr, computeTargets, scaleFood, tdee } from '../nutrition';
import { Food } from '../types';

describe('nutrition math', () => {
  test('BMI', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
    expect(bmiCategory(17)).toBe('Underweight');
    expect(bmiCategory(22)).toBe('Normal');
    expect(bmiCategory(27)).toBe('Overweight');
    expect(bmiCategory(32)).toBe('Obese');
  });

  test('Mifflin-St Jeor BMR — known fixtures', () => {
    // male, 70kg, 175cm, 25y: 10*70 + 6.25*175 - 5*25 + 5 = 1673.75
    expect(bmr('male', 70, 175, 25)).toBeCloseTo(1673.75, 2);
    // female, 60kg, 165cm, 30y: 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
    expect(bmr('female', 60, 165, 30)).toBeCloseTo(1320.25, 2);
  });

  test('TDEE applies activity factor', () => {
    expect(tdee('male', 70, 175, 25, 'sedentary')).toBeCloseTo(1673.75 * 1.2, 1);
    expect(tdee('male', 70, 175, 25, 'very_active')).toBeCloseTo(1673.75 * 1.9, 1);
  });

  test('computeTargets: protein 2g/kg, fat 25%, carbs remainder, goal shifts kcal', () => {
    const base = {
      sex: 'male' as const,
      weightKg: 80,
      heightCm: 180,
      birthYear: new Date().getFullYear() - 25,
      activityLevel: 'moderate' as const,
    };
    const maintain = computeTargets({ ...base, goal: 'maintain' });
    const cut = computeTargets({ ...base, goal: 'cut' });
    const bulk = computeTargets({ ...base, goal: 'bulk' });

    expect(maintain.proteinG).toBe(160);
    expect(cut.kcal).toBeLessThan(maintain.kcal);
    expect(bulk.kcal).toBeGreaterThan(maintain.kcal);
    // energy from macros should roughly reconstruct the kcal target
    const kcalFromMacros = maintain.proteinG * 4 + maintain.carbsG * 4 + maintain.fatG * 9;
    expect(Math.abs(kcalFromMacros - maintain.kcal)).toBeLessThan(20);
  });

  test('scaleFood scales per-100g linearly', () => {
    const food: Food = {
      id: 'x',
      name: 'x',
      aliases: [],
      category: 'test',
      kcal_100g: 165,
      protein_100g: 31,
      carbs_100g: 0,
      fat_100g: 3.6,
      default_portion_g: 100,
      portion_label: '100 g',
    };
    const m = scaleFood(food, 200);
    expect(m.kcal).toBe(330);
    expect(m.proteinG).toBe(62);
    expect(m.fatG).toBe(7.2);
  });
});

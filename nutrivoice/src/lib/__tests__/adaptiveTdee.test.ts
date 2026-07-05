import { estimateTdee, weightTrendSlope } from '../adaptiveTdee';
import { FoodLogEntry, WeightEntry, addDays } from '../types';

const TODAY = '2026-07-01';

function mkWeights(days: number[], weightFor: (dayAgo: number) => number): WeightEntry[] {
  return days.map((d, i) => ({
    id: `w${i}`,
    dateKey: addDays(TODAY, -d),
    weightKg: weightFor(d),
    updatedAt: '2026-07-01T00:00:00Z',
    deleted: false,
  }));
}

function mkIntake(daysAgo: number[], kcal: number): FoodLogEntry[] {
  return daysAgo.map((d, i) => ({
    id: `e${i}`,
    dateKey: addDays(TODAY, -d),
    meal: 'lunch' as const,
    foodId: null,
    name: 'synthetic day',
    grams: 100,
    kcal,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    source: 'manual' as const,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    deleted: false,
  }));
}

const BASE = { targetKcal: 2800, bmrKcal: 1800, priorTdeeKcal: 2800, today: TODAY };
const DAYS_21 = Array.from({ length: 21 }, (_, i) => i); // 0..20 days ago

describe('adaptiveTdee', () => {
  test('slope: flat weights → 0', () => {
    expect(weightTrendSlope([{ x: 0, y: 80 }, { x: 7, y: 80 }, { x: 14, y: 80 }])).toBe(0);
  });

  test('maintenance: stable weight, intake 2800 → TDEE ≈ 2800', () => {
    const est = estimateTdee({
      entries: mkIntake(DAYS_21, 2800),
      weights: mkWeights(DAYS_21, () => 80),
      ...BASE,
    });
    expect(est.available).toBe(true);
    if (est.available) {
      expect(est.tdeeKcal).toBeGreaterThan(2700);
      expect(est.tdeeKcal).toBeLessThan(2900);
      expect(est.trendKgPerWeek).toBeCloseTo(0, 1);
    }
  });

  test('cut: eating 2200, losing 0.35 kg/week → TDEE ≈ 2585 raw', () => {
    // weight falls linearly 0.05 kg/day going forward = -0.35/wk
    const est = estimateTdee({
      entries: mkIntake(DAYS_21, 2200),
      weights: mkWeights(DAYS_21, (dayAgo) => 80 + dayAgo * 0.05),
      ...BASE,
      priorTdeeKcal: 2600,
    });
    expect(est.available).toBe(true);
    if (est.available) {
      expect(est.rawTdeeKcal).toBeGreaterThan(2500);
      expect(est.rawTdeeKcal).toBeLessThan(2680);
      expect(est.trendKgPerWeek).toBeCloseTo(-0.35, 1);
    }
  });

  test('noisy bulk converges near truth', () => {
    // true TDEE 3000, eating 3250 → +0.032 kg/day; deterministic "noise"
    const noise = [0.4, -0.3, 0.2, -0.4, 0.1, -0.2, 0.3, 0, -0.1, 0.2, -0.3, 0.1, 0.4, -0.2, 0, 0.3, -0.4, 0.1, -0.1, 0.2, 0];
    const est = estimateTdee({
      entries: mkIntake(DAYS_21, 3250),
      weights: mkWeights(DAYS_21, (d) => 80 - d * 0.032 + noise[d % noise.length] * 0.5),
      ...BASE,
      targetKcal: 3300,
      priorTdeeKcal: 3100,
    });
    expect(est.available).toBe(true);
    if (est.available) {
      expect(Math.abs(est.rawTdeeKcal - 3000)).toBeLessThan(300);
    }
  });

  test('partial-log days are excluded from the average', () => {
    const full = mkIntake(DAYS_21, 2800);
    const partial = mkIntake([21, 22, 23], 400); // breakfast-only days — must not count
    const est = estimateTdee({
      entries: [...full, ...partial],
      weights: mkWeights(DAYS_21, () => 80),
      ...BASE,
    });
    expect(est.available).toBe(true);
    if (est.available) expect(est.avgIntakeKcal).toBe(2800);
  });

  test('insufficient weigh-ins → unavailable with reason', () => {
    const est = estimateTdee({
      entries: mkIntake(DAYS_21, 2800),
      weights: mkWeights([0, 1, 2], () => 80),
      ...BASE,
    });
    expect(est.available).toBe(false);
    if (!est.available) expect(est.reason).toContain('weigh-ins');
  });

  test('short weigh-in span → unavailable', () => {
    const est = estimateTdee({
      entries: mkIntake(DAYS_21, 2800),
      weights: mkWeights([0, 1, 2, 3, 4, 5, 6, 7], () => 80),
      ...BASE,
    });
    expect(est.available).toBe(false);
    if (!est.available) expect(est.reason).toContain('span');
  });

  test('too few full food days → unavailable', () => {
    const est = estimateTdee({
      entries: mkIntake([0, 1, 2, 3], 2800),
      weights: mkWeights(DAYS_21, () => 80),
      ...BASE,
    });
    expect(est.available).toBe(false);
    if (!est.available) expect(est.reason).toContain('logged days');
  });

  test('clamps insane raw estimates to [BMR, 2.5×BMR]', () => {
    // absurd: losing 2 kg/week while eating 1200 → raw ~3400, clamp then blend keeps sane
    const est = estimateTdee({
      entries: mkIntake(DAYS_21, 1200),
      weights: mkWeights(DAYS_21, (d) => 80 + d * 0.3), // -0.3 kg/day!
      ...BASE,
      targetKcal: 1800,
    });
    expect(est.available).toBe(true);
    if (est.available) {
      expect(est.tdeeKcal).toBeLessThanOrEqual(2.5 * BASE.bmrKcal);
      expect(est.tdeeKcal).toBeGreaterThanOrEqual(BASE.bmrKcal);
    }
  });
});

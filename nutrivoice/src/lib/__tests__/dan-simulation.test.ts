import foods from '../../data/foods.json';
import { computeTargets, scaleFood, sumTotals } from '../nutrition';
import { parseFoodText } from '../parser';
import { Food, MacroTotals } from '../types';

const DB = foods as Food[];

/**
 * Simulation: Dan, 24, 84 kg, 182 cm, trains 6x/week, bulking.
 * A varied real-world week — Indian + western + gym staples + foods that are
 * NOT in the catalog (those route to the AI path in the app; here we count
 * them as "unmatched" and assert the offline catalog alone still covers the
 * bulk of his diet).
 */

const DAN = {
  sex: 'male' as const,
  birthYear: new Date().getFullYear() - 24,
  heightCm: 182,
  weightKg: 84,
  activityLevel: 'active' as const,
  goal: 'bulk' as const,
};

const WEEK: Record<string, string[]> = {
  Mon: [
    '6 egg whites and 2 whole eggs with 2 slices of brown bread',
    '250 grams of grilled chicken breast with 250 grams of rice and mixed veg sabzi',
    'whey protein shake and a banana',
    '150 g paneer with 3 rotis and a bowl of dal tadka',
  ],
  Tue: [
    '100 g oats with 250 ml whole milk and 30 g peanut butter',
    '300 grams of chicken biryani with a glass of chaas',
    '2 scoops of whey protein and 50 g almonds',
    '200 g fish curry with 200 g rice and cucumber',
  ],
  Wed: [
    '4 boiled eggs and a glass of orange juice',
    '250 g mutton curry with 3 tandoori rotis',
    'a protein bar and a black coffee',
    '200 g grilled chicken breast with 150 g sweet potato and broccoli',
  ],
  Thu: [
    '100 g muesli with greek yogurt and a mango',
    '2 slices of pepperoni pizza and a diet coke',
    'whey protein shake with a banana and 20 g peanut butter',
    '200 g tandoori chicken with dal makhani and 2 naans',
  ],
  Fri: [
    '5 egg omelette with 2 slices of multigrain bread and ghee',
    '250 g chicken curry with 250 g jeera rice',
    '100 g roasted chana chaat',
    '150 g prawns with hakka noodles',
  ],
  Sat: [
    '100 g oats with whole milk, raisins and chia seeds',
    'sushi rolls and miso soup',
    '2 scoops whey and a handful of cashews',
    '300 g butter chicken with 3 rotis and salad',
  ],
  Sun: [
    '3 aloo parathas with dahi and butter',
    '200 g grilled salmon with quinoa',
    'a mango lassi and 2 besan ladoos',
    '200 g chicken breast with 200 g white rice and rajma',
  ],
};

describe('Dan bulking-week simulation', () => {
  const targets = computeTargets(DAN);

  test('targets are bodybuilding-sane for an 84 kg active bulker', () => {
    expect(targets.kcal).toBeGreaterThan(3000);
    expect(targets.kcal).toBeLessThan(4200);
    expect(targets.proteinG).toBe(168); // 2 g/kg
  });

  test('catalog alone covers most of a varied week; gaps are the AI path', () => {
    let totalSegments = 0;
    const unmatched: string[] = [];
    const dayReports: { day: string; totals: MacroTotals; matched: number; segments: number }[] = [];

    const dubious: string[] = [];
    for (const [day, meals] of Object.entries(WEEK)) {
      const dayItems = meals.flatMap((meal) => parseFoodText(meal, DB));
      const matched = dayItems.filter((i) => i.food);
      for (const i of matched) {
        if (i.confidence < 0.7) dubious.push(`"${i.raw}" → ${i.food!.name} (${i.confidence.toFixed(2)})`);
      }
      unmatched.push(...dayItems.filter((i) => !i.food).map((i) => i.raw));
      totalSegments += dayItems.length;
      dayReports.push({
        day,
        totals: sumTotals(matched.map((i) => scaleFood(i.food!, i.grams))),
        matched: matched.length,
        segments: dayItems.length,
      });
    }

    const matchRate = (totalSegments - unmatched.length) / totalSegments;
    const avgKcal = Math.round(dayReports.reduce((s, d) => s + d.totals.kcal, 0) / 7);
    const avgProtein = Math.round(dayReports.reduce((s, d) => s + d.totals.proteinG, 0) / 7);

    // eslint-disable-next-line no-console
    console.log('\n=== DAN SIMULATION ===');
    // eslint-disable-next-line no-console
    console.log(`targets: ${targets.kcal} kcal, P ${targets.proteinG} C ${targets.carbsG} F ${targets.fatG}`);
    for (const d of dayReports) {
      // eslint-disable-next-line no-console
      console.log(
        `${d.day}: ${Math.round(d.totals.kcal)} kcal | P ${Math.round(d.totals.proteinG)}g | matched ${d.matched}/${d.segments}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`match rate: ${(matchRate * 100).toFixed(1)}% | avg (matched-only): ${avgKcal} kcal, P ${avgProtein}g`);
    // eslint-disable-next-line no-console
    console.log('unmatched (AI path):', JSON.stringify(unmatched));
    // eslint-disable-next-line no-console
    console.log('low-confidence matches (<0.7, user sees "Not right?"):');
    // eslint-disable-next-line no-console
    dubious.forEach((d) => console.log('  ' + d));

    // Catalog must carry a varied diet largely on its own.
    expect(matchRate).toBeGreaterThanOrEqual(0.8);
    // Matched-only totals land in a plausible bulking band even before AI fills gaps.
    expect(avgKcal).toBeGreaterThan(2200);
    expect(avgKcal).toBeLessThan(4500);
    // Protein target must be *reachable* — matched food alone gets close to 168 g.
    expect(avgProtein).toBeGreaterThan(140);
  });
});

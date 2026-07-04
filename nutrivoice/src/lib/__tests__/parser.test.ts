import foods from '../../data/foods.json';
import { parseFoodText } from '../parser';
import { Food } from '../types';

const DB = foods as Food[];

const parse = (text: string) => parseFoodText(text, DB);

describe('parseFoodText', () => {
  test('parses the canonical example: 200g chicken breast with 200g rice', () => {
    const items = parse('I had 200 grams of chicken breast with 200 grams of rice');
    expect(items).toHaveLength(2);
    expect(items[0].food?.name.toLowerCase()).toContain('chicken breast');
    expect(items[0].grams).toBe(200);
    expect(items[1].food?.name.toLowerCase()).toContain('rice');
    expect(items[1].grams).toBe(200);
  });

  test('handles compact units: 200g', () => {
    const items = parse('200g paneer');
    expect(items).toHaveLength(1);
    expect(items[0].grams).toBe(200);
    expect(items[0].food?.name.toLowerCase()).toContain('paneer');
  });

  test('counts use default portions: 2 rotis', () => {
    const items = parse('2 rotis');
    expect(items).toHaveLength(1);
    expect(items[0].food).not.toBeNull();
    const roti = items[0].food!;
    expect(items[0].grams).toBeCloseTo(2 * roti.default_portion_g, 1);
  });

  test('word numbers: two eggs', () => {
    const items = parse('two eggs');
    expect(items).toHaveLength(1);
    expect(items[0].food).not.toBeNull();
    expect(items[0].grams).toBeCloseTo(2 * items[0].food!.default_portion_g, 1);
  });

  test('household measures: a bowl of dal', () => {
    const items = parse('a bowl of dal tadka');
    expect(items).toHaveLength(1);
    expect(items[0].grams).toBe(200); // bowl = 200 g
    expect(items[0].food?.id).toContain('dal');
  });

  test('kg conversion', () => {
    const items = parse('0.5 kg curd');
    expect(items).toHaveLength(1);
    expect(items[0].grams).toBe(500);
  });

  test('multi-item with and/commas', () => {
    const items = parse('1 banana, 30 g peanut butter and a glass of milk');
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.food !== null)).toBe(true);
    expect(items[1].grams).toBe(30);
    expect(items[2].grams).toBe(250); // glass = 250 g
  });

  test('hindi aliases: dahi matches curd/yogurt', () => {
    const items = parse('100 g dahi');
    expect(items).toHaveLength(1);
    expect(items[0].food).not.toBeNull();
  });

  test('misspelling: chikn breast still matches', () => {
    const items = parse('150 g chikn breast');
    expect(items).toHaveLength(1);
    expect(items[0].food?.name.toLowerCase()).toContain('chicken');
  });

  test('unmatched food is kept with null match, never dropped silently', () => {
    const items = parse('250 g of unobtainium stew');
    expect(items).toHaveLength(1);
    expect(items[0].food).toBeNull();
    expect(items[0].grams).toBe(250);
  });

  test('empty and junk input return no items', () => {
    expect(parse('')).toHaveLength(0);
    expect(parse('    ')).toHaveLength(0);
  });

  test('filler words are ignored', () => {
    const items = parse('today for lunch I ate about 100 grams of ghee rice');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].grams).toBe(100);
  });
});

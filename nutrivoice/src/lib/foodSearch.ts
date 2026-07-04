import foodsJson from '../data/foods.json';
import { matchFood } from './parser';
import { CustomFood, Food } from './types';

export const FOOD_DB: Food[] = foodsJson as Food[];

const byId = new Map<string, Food>(FOOD_DB.map((f) => [f.id, f]));

export function getFoodById(id: string, customFoods: CustomFood[] = []): Food | undefined {
  return byId.get(id) ?? customFoods.find((c) => c.id === id && !c.deleted);
}

/** Fuzzy search across bundled DB + user's custom foods. */
export function searchFoods(query: string, customFoods: CustomFood[] = [], limit = 20): Food[] {
  const q = query.trim().toLowerCase();
  const pool: Food[] = [...customFoods.filter((c) => !c.deleted), ...FOOD_DB];
  if (!q) return pool.slice(0, limit);
  return matchFood(q, pool, limit).map((m) => m.food);
}

/** Pool used by the voice parser (bundled + custom). */
export function parserPool(customFoods: CustomFood[] = []): Food[] {
  return [...customFoods.filter((c) => !c.deleted), ...FOOD_DB];
}

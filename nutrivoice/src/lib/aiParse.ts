import { matchFood, ParsedItem } from './parser';
import { supabase } from './supabase';
import { Food } from './types';

/**
 * AI-powered food parsing via the `parse-food` edge function (free-LLM
 * provider chain, keyless Pollinations fallback — no paid key needed).
 *
 * The AI returns per-100g macro estimates, so ANY food becomes loggable:
 * when the catalog has a strong match we prefer it (curated data beats an
 * estimate); otherwise we build an ad-hoc Food from the AI's numbers.
 *
 * Requires a signed-in user (function enforces JWT). Returns null on any
 * failure — callers fall back to the local parser result.
 */

interface AiItem {
  name: string;
  grams: number;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

const CATALOG_TRUST_THRESHOLD = 0.8;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function aiItemToFood(item: AiItem): Food {
  return {
    id: `ai-${slugify(item.name)}`,
    name: item.name.replace(/\b\w/g, (ch) => ch.toUpperCase()),
    aliases: [],
    category: 'ai',
    kcal_100g: item.kcal_100g,
    protein_100g: item.protein_100g,
    carbs_100g: item.carbs_100g,
    fat_100g: item.fat_100g,
    default_portion_g: Math.round(item.grams),
    portion_label: `${Math.round(item.grams)} g`,
  };
}

function toParsedItem(raw: AiItem, foods: Food[]): ParsedItem | null {
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  const grams = Number(raw?.grams);
  if (!name || !Number.isFinite(grams) || grams <= 0 || grams > 5000) return null;

  const matches = matchFood(name.toLowerCase(), foods);
  const strong = matches[0] && matches[0].score >= CATALOG_TRUST_THRESHOLD;
  const hasMacros =
    Number.isFinite(Number(raw.kcal_100g)) && Number(raw.kcal_100g) >= 0 && Number(raw.kcal_100g) <= 900;

  let food: Food | null;
  if (strong) {
    food = matches[0].food;
  } else if (hasMacros) {
    food = aiItemToFood({ ...raw, grams });
  } else {
    food = matches[0]?.food ?? null;
  }
  if (!food) return null;

  return {
    raw: name,
    grams: Math.round(grams * 10) / 10,
    food,
    candidates: strong || !hasMacros ? matches.map((m) => m.food) : [food, ...matches.map((m) => m.food)],
    confidence: strong ? matches[0].score : hasMacros ? 0.9 : (matches[0]?.score ?? 0),
    qtyDescription: `${Math.round(grams)} g (AI${strong ? ' → catalog' : ' estimate'})`,
  };
}

export async function aiParseFood(text: string, foods: Food[]): Promise<ParsedItem[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('parse-food', {
      body: { text },
    });
    if (error || !data || !Array.isArray(data.items)) return null;
    const items = (data.items as AiItem[])
      .map((raw) => toParsedItem(raw, foods))
      .filter((i): i is ParsedItem => i !== null);
    return items.length ? items : null;
  } catch {
    return null;
  }
}

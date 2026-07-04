import { matchFood } from './parser';
import { ParsedItem } from './parser';
import { supabase } from './supabase';
import { Food } from './types';

/**
 * Optional AI-powered parse via the `parse-food` Supabase edge function
 * (Claude). Requires a signed-in user and the ANTHROPIC_API_KEY secret to be
 * configured server-side. Falls back cleanly: callers should use the local
 * parser result when this returns null.
 */
export async function aiParseFood(text: string, foods: Food[]): Promise<ParsedItem[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('parse-food', {
      body: { text },
    });
    if (error || !data || !Array.isArray(data.items)) return null;

    const items: ParsedItem[] = [];
    for (const raw of data.items) {
      const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
      const grams = Number(raw?.grams);
      if (!name || !Number.isFinite(grams) || grams <= 0 || grams > 5000) continue;
      const matches = matchFood(name.toLowerCase(), foods);
      items.push({
        raw: name,
        grams: Math.round(grams * 10) / 10,
        food: matches[0]?.food ?? null,
        candidates: matches.map((m) => m.food),
        confidence: matches[0]?.score ?? 0,
        qtyDescription: `${Math.round(grams)} g (AI)`,
      });
    }
    return items.length ? items : null;
  } catch {
    return null;
  }
}

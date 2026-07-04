import { Food } from './types';

/**
 * Deterministic natural-language food parser.
 *
 * Handles input like:
 *   "I had 200 grams of chicken breast with 200 grams of rice"
 *   "2 rotis and a bowl of dal tadka"
 *   "one banana, 30g peanut butter and a glass of milk"
 *
 * Works fully offline against the bundled food database.
 */

export interface ParsedItem {
  /** The text segment this item was parsed from. */
  raw: string;
  /** Resolved weight in grams (or ml treated as grams for liquids). */
  grams: number;
  /** Best food match, null when nothing scored above the threshold. */
  food: Food | null;
  /** Alternative matches for the user to pick from. */
  candidates: Food[];
  /** 0..1 — match quality of the chosen food. */
  confidence: number;
  /** Human description of how the quantity was read, e.g. "2 × 1 roti (80 g)". */
  qtyDescription: string;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, half: 0.5,
  quarter: 0.25, couple: 2, few: 3, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  thousand: 1000,
};

/** Units that map directly to grams (value = grams per unit). */
const WEIGHT_UNITS: Record<string, number> = {
  g: 1, gm: 1, gms: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  mg: 0.001,
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6,
};

/** Household measures approximated in grams. */
const MEASURE_UNITS: Record<string, number> = {
  cup: 240, cups: 240,
  glass: 250, glasses: 250,
  bowl: 200, bowls: 200,
  katori: 150, katoris: 150,
  plate: 300, plates: 300,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  scoop: 30, scoops: 30,
  shot: 30, shots: 30,
  mug: 300, mugs: 300,
};

/** Units meaning "N default portions of the food". */
const PORTION_UNITS = new Set([
  'piece', 'pieces', 'pc', 'pcs', 'slice', 'slices', 'serving', 'servings',
  'portion', 'portions', 'unit', 'units', 'plate', 'roti', 'rotis',
]);

const FILLER_WORDS = new Set([
  'i', 'had', 'ate', 'have', 'having', 'eat', 'eaten', 'took', 'me', 'my',
  'some', 'of', 'for', 'the', 'today', 'yesterday', 'this', 'morning',
  'breakfast', 'lunch', 'dinner', 'snack', 'at', 'in', 'just', 'about',
  'around', 'roughly', 'like', 'then', 'also', 'log', 'add', 'please',
]);

const SPLIT_REGEX = /\s*(?:,|;|\band\b|\bwith\b|\bplus\b|\balong with\b|&)\s*/gi;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2') // digit grouping: "1,000" -> "1000"
    .replace(/[^\w\s.,;%-]/g, ' ') // keep , and ; — they are item separators
    .replace(/(\d)(g|gm|gms|kg|ml|l|mg|oz|lb|lbs)\b/g, '$1 $2') // "200g" -> "200 g"
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPlural(word: string): string {
  if (word.length > 3 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 2 && word.endsWith('es') && !word.endsWith('ees')) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Similarity 0..1 between a query string and one food name/alias. */
function similarity(query: string, target: string): number {
  if (query === target) return 1;
  const q = stripPlural(query);
  const t = stripPlural(target);
  if (q === t) return 0.98;
  if (t.startsWith(q) || q.startsWith(t)) {
    return 0.9 * (Math.min(q.length, t.length) / Math.max(q.length, t.length)) + 0.05;
  }
  if (t.includes(q) || q.includes(t)) {
    return 0.8 * (Math.min(q.length, t.length) / Math.max(q.length, t.length));
  }
  const dist = levenshtein(q, t);
  const maxLen = Math.max(q.length, t.length);
  const sim = 1 - dist / maxLen;
  return sim > 0.6 ? sim * 0.85 : 0;
}

/** Token-aware score of query words against a food (name + aliases). */
export function scoreFood(queryWords: string[], food: Food): number {
  const query = queryWords.join(' ');
  const targets = [food.name.toLowerCase(), ...food.aliases.map((a) => a.toLowerCase())];
  let best = 0;
  for (const target of targets) {
    let s = similarity(query, target);
    if (s < 1) {
      // token overlap: how much of the target is covered by query words and vice versa
      const targetWords = target.split(' ');
      let hits = 0;
      for (const tw of targetWords) {
        if (queryWords.some((qw) => similarity(qw, tw) > 0.85)) hits++;
      }
      const coverage = hits / targetWords.length;
      const precision = queryWords.length ? hits / queryWords.length : 0;
      const tokenScore = coverage * 0.65 + precision * 0.3;
      s = Math.max(s, tokenScore);
    }
    best = Math.max(best, s);
  }
  return best;
}

export function matchFood(query: string, foods: Food[], limit = 5): { food: Food; score: number }[] {
  const words = query.split(' ').filter((w) => w && !FILLER_WORDS.has(w));
  if (!words.length) return [];
  return foods
    .map((food) => ({ food, score: scoreFood(words, food) }))
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

interface Quantity {
  /** Multiplier count, e.g. 2 in "2 rotis". */
  count: number;
  /** Absolute grams when an explicit weight/measure was given, else null. */
  grams: number | null;
  description: string;
}

/** Pull a quantity out of a token list; returns remaining food words. */
function extractQuantity(tokens: string[]): { qty: Quantity; foodWords: string[] } {
  let count = 1;
  let grams: number | null = null;
  let description = '';
  const foodWords: string[] = [];
  let i = 0;

  const readNumber = (): number | null => {
    const tok = tokens[i];
    if (tok == null) return null;
    const numeric = Number(tok);
    if (!Number.isNaN(numeric) && tok !== '') {
      i++;
      // "1 and a half" style handled crudely: "1.5" already numeric
      return numeric;
    }
    if (NUMBER_WORDS[tok] != null) {
      let value = NUMBER_WORDS[tok];
      i++;
      // "two hundred" / "one hundred fifty"
      if (tokens[i] === 'hundred') {
        value *= 100;
        i++;
      } else if (tokens[i] === 'thousand') {
        value *= 1000;
        i++;
      }
      if (NUMBER_WORDS[tokens[i]] != null && NUMBER_WORDS[tokens[i]] < 100 && value >= 100) {
        value += NUMBER_WORDS[tokens[i]];
        i++;
      }
      return value;
    }
    return null;
  };

  while (i < tokens.length) {
    const start = i;
    const num = readNumber();
    if (num != null) {
      const unit = tokens[i];
      if (unit && WEIGHT_UNITS[unit] != null) {
        grams = num * WEIGHT_UNITS[unit];
        description = `${num} ${unit}`;
        i++;
      } else if (unit && MEASURE_UNITS[unit] != null) {
        grams = num * MEASURE_UNITS[unit];
        description = `${num} ${unit} (~${Math.round(grams)} g)`;
        i++;
      } else if (unit && PORTION_UNITS.has(unit)) {
        count = num;
        description = `${num} ${unit}`;
        i++;
        // keep the unit word if it's also a food word (e.g. "2 rotis")
        if (unit.startsWith('roti')) foodWords.push('roti');
      } else {
        count = num;
        description = `${num}`;
      }
      continue;
    }
    const tok = tokens[i];
    if (WEIGHT_UNITS[tok] != null && grams == null && start === 0) {
      // bare unit without number ("kg of rice" is odd; skip token)
      i++;
      continue;
    }
    if (MEASURE_UNITS[tok] != null && grams == null) {
      grams = MEASURE_UNITS[tok];
      description = `1 ${tok} (~${Math.round(grams)} g)`;
      i++;
      continue;
    }
    if (!FILLER_WORDS.has(tok)) foodWords.push(tok);
    i++;
  }

  return { qty: { count, grams, description }, foodWords };
}

export function parseSegment(segment: string, foods: Food[]): ParsedItem | null {
  const tokens = normalize(segment).split(' ').filter(Boolean);
  if (!tokens.length) return null;
  const { qty, foodWords } = extractQuantity(tokens);
  if (!foodWords.length) return null;

  const matches = matchFood(foodWords.join(' '), foods);
  const food = matches[0]?.food ?? null;
  const confidence = matches[0]?.score ?? 0;

  let grams: number;
  let qtyDescription: string;
  if (qty.grams != null) {
    grams = qty.grams * (qty.count !== 1 && qty.description.startsWith(`${qty.count}`) ? 1 : qty.count);
    qtyDescription = qty.description || `${Math.round(grams)} g`;
  } else if (food) {
    grams = qty.count * food.default_portion_g;
    qtyDescription =
      qty.count === 1
        ? `${food.portion_label} (${food.default_portion_g} g)`
        : `${qty.count} × ${food.portion_label} (${Math.round(grams)} g)`;
  } else {
    grams = qty.count * 100;
    qtyDescription = `${Math.round(grams)} g (assumed)`;
  }

  grams = Math.round(grams * 10) / 10;
  if (!(grams > 0) || grams > 5000) grams = Math.min(Math.max(grams, 1), 5000);

  return {
    raw: segment.trim(),
    grams,
    food,
    candidates: matches.map((m) => m.food),
    confidence,
    qtyDescription,
  };
}

/** Parse a full utterance into food items. Never throws. */
export function parseFoodText(text: string, foods: Food[]): ParsedItem[] {
  if (!text || !text.trim()) return [];
  const segments = normalize(text)
    .split(SPLIT_REGEX)
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  const items: ParsedItem[] = [];
  for (const seg of segments) {
    const item = parseSegment(seg, foods);
    if (item) items.push(item);
  }
  return items;
}

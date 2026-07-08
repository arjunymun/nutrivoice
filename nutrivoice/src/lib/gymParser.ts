import { matchFood, normalize } from './parser';
import { Exercise } from './workoutTypes';

/**
 * Deterministic set-logging parser for spoken/typed gym phrases.
 *
 *   "bench press 3 sets of 8 at 60 kg"
 *   "squats 5x5 100"            (trailing bare number = kg; app is kg-native)
 *   "deadlift 8 reps at 140, rdl 3x10 80"
 *   "weighted pull ups 3x8 at 20 kg rpe 8"
 *   "plank 60 seconds"
 *
 * Deliberately separate from the food parser: "kg" there means grams of food,
 * and gym grammar ("5x5", "rpe 8") means nothing in a meal sentence.
 */

export interface ParsedSetGroup {
  raw: string;
  exercise: Exercise | null;
  candidates: Exercise[];
  confidence: number;
  sets: number;
  /** null when the phrase gave no reps (UI prompts). */
  reps: number | null;
  /** null = bodyweight / not stated. */
  weightKg: number | null;
  /** For duration exercises (plank, cardio). */
  durationS: number | null;
  rpe: number | null;
}

const LB_TO_KG = 0.453592;

const SPLIT = /\s*(?:,|;|\bthen\b|\band then\b|\band\b|\n)\s*/gi;

const FILLER = new Set([
  'i', 'did', 'do', 'just', 'a', 'an', 'the', 'of', 'for', 'with', 'my', 'some',
  'today', 'set', 'sets', 'rep', 'reps', 'at', 'each', 'per', 'side', 'kg', 'kgs',
  'kilo', 'kilos', 'kilograms', 'lb', 'lbs', 'pounds', 'x', 'by', 'times', 'rpe',
  'seconds', 'secs', 'sec', 'minutes', 'mins', 'min', 'bodyweight', 'bw', 'weighted',
]);

function toSeconds(value: number, unit: string): number {
  return /min/.test(unit) ? Math.round(value * 60) : Math.round(value);
}

export interface ParseOptions {
  /** Unit assumed for BARE numbers ("bench 3x8 at 185"). Explicit "kg"/"lbs" always win. */
  defaultUnit?: 'kg' | 'lb';
}

export function parseGymSegment(
  segment: string,
  exercises: Exercise[],
  opts: ParseOptions = {},
): ParsedSetGroup | null {
  const bareToKg = (n: number) =>
    opts.defaultUnit === 'lb' ? Math.round(n * LB_TO_KG * 10) / 10 : n;
  let text = ` ${normalize(segment)} `;
  if (!text.trim()) return null;

  let sets = 1;
  let reps: number | null = null;
  let weightKg: number | null = null;
  let durationS: number | null = null;
  let rpe: number | null = null;
  let bodyweight = false;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void): void => {
    const m = text.match(re);
    if (m) {
      fn(m);
      text = text.replace(re, ' ');
    }
  };

  // rpe FIRST — keyword-gated so "at 8" stays a weight
  take(/\b(?:at\s+)?rpe\s+(\d+(?:\.\d+)?)\b/i, (m) => {
    const v = Number(m[1]);
    if (v >= 1 && v <= 10) rpe = v;
  });

  // duration: "60 seconds", "2 min", "1.5 minutes"
  take(/\b(\d+(?:\.\d+)?)\s*(seconds|secs|sec|s\b|minutes|mins|min)\b/i, (m) => {
    durationS = toSeconds(Number(m[1]), m[2]);
  });

  // "3x8", "3 x 8", "5×5" (optionally followed by weight, captured later)
  take(/\b(\d+)\s*[x×]\s*(\d+)\b/i, (m) => {
    sets = Number(m[1]);
    reps = Number(m[2]);
  });

  // "3 sets of 8", "3 sets x 8", "3 sets 8 reps"
  take(/\b(\d+)\s+sets?\s+(?:of\s+|x\s+)?(\d+)\s*(?:reps?)?\b/i, (m) => {
    sets = Number(m[1]);
    reps = Number(m[2]);
  });

  // "8 reps"
  if (reps == null) {
    take(/\b(\d+)\s+reps?\b/i, (m) => {
      reps = Number(m[1]);
    });
  }

  // explicit weight w/ unit: "at 60 kg", "60kg", "135 lbs", "@ 100 kilos"
  take(/(?:\bat\s+|@\s*)?\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|kilograms)\b/i, (m) => {
    weightKg = Number(m[1]);
  });
  if (weightKg == null) {
    take(/(?:\bat\s+|@\s*)?\b(\d+(?:\.\d+)?)\s*(lb|lbs|pounds)\b/i, (m) => {
      weightKg = Math.round(Number(m[1]) * LB_TO_KG * 10) / 10;
    });
  }

  // bodyweight marker
  take(/\b(?:bodyweight|bw)\b/i, () => {
    bodyweight = true;
  });

  // "at 100" / trailing bare number → the user's display unit (kg unless set to lb)
  if (weightKg == null && !bodyweight) {
    take(/\bat\s+(\d+(?:\.\d+)?)\b/i, (m) => {
      weightKg = bareToKg(Number(m[1]));
    });
  }
  if (weightKg == null && !bodyweight) {
    // last remaining standalone number, if any, is a weight
    const nums = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)];
    if (nums.length === 1) {
      weightKg = bareToKg(Number(nums[0][1]));
      text = text.replace(nums[0][0], ' ');
    }
  }

  // sanity clamps
  if (sets < 1 || sets > 20) sets = Math.min(Math.max(sets, 1), 20);
  if (reps != null && (reps < 1 || reps > 100)) reps = Math.min(Math.max(reps, 1), 100);
  if (weightKg != null && (weightKg <= 0 || weightKg > 600)) weightKg = null;

  const words = text.split(' ').filter((w) => w && !FILLER.has(w) && !/^\d+(\.\d+)?$/.test(w));
  if (!words.length) return null;

  const matches = matchFood(words.join(' '), exercises);
  const exercise = matches[0]?.food ?? null;

  // exercise-type driven fixups
  if (exercise) {
    if (exercise.load_type === 'duration' && durationS == null && reps != null) {
      // "plank 3x60" style already handled; "plank 60" landed in weight slot
      if (weightKg != null && reps == null) {
        durationS = Math.round(weightKg);
        weightKg = null;
      }
    }
    if (exercise.load_type === 'duration' && weightKg != null && durationS == null) {
      durationS = Math.round(weightKg);
      weightKg = null;
    }
    if (exercise.load_type === 'bodyweight_reps' && weightKg != null && weightKg <= 5) {
      // "push ups 3x20" leaves no stray number; small residual numbers are noise
      weightKg = null;
    }
  }

  return {
    raw: segment.trim(),
    exercise,
    candidates: matches.map((m) => m.food),
    confidence: matches[0]?.score ?? 0,
    sets,
    reps,
    weightKg: bodyweight ? null : weightKg,
    durationS,
    rpe,
  };
}

/** Parse a full utterance into set groups. Never throws. */
export function parseGymText(
  text: string,
  exercises: Exercise[],
  opts: ParseOptions = {},
): ParsedSetGroup[] {
  if (!text || !text.trim()) return [];
  const segments = text
    .split(SPLIT)
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  const out: ParsedSetGroup[] = [];
  for (const seg of segments) {
    const g = parseGymSegment(seg, exercises, opts);
    if (g) out.push(g);
  }
  return out;
}

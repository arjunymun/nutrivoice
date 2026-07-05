import { matchFood } from './parser';
import { supabase } from './supabase';
import { Exercise, RoutineItem } from './workoutTypes';

/**
 * AI routine generation via the `coach` edge function (free provider chain).
 * The LLM returns exercise NAMES; we map them onto real catalog ids with the
 * fuzzy matcher and drop anything we can't place (reported as `unmatched`).
 * On any failure a sane template routine is returned instead — the feature
 * never dead-ends.
 */

export interface GeneratedRoutine {
  name: string;
  items: RoutineItem[];
  unmatched: string[];
}

export interface CoachResult {
  routines: GeneratedRoutine[];
  provider: string | null;
  fallback: boolean;
}

const MATCH_FLOOR = 0.6;

export const TEMPLATE_ROUTINES: { name: string; items: [string, number, number][] }[] = [
  {
    name: 'Full Body A',
    items: [
      ['barbell-back-squat', 3, 8],
      ['barbell-bench-press', 3, 8],
      ['barbell-bent-over-row', 3, 10],
      ['overhead-press', 2, 10],
      ['romanian-deadlift', 3, 10],
      ['plank', 3, 12],
    ],
  },
  {
    name: 'Full Body B',
    items: [
      ['conventional-deadlift', 3, 5],
      ['incline-dumbbell-bench-press', 3, 10],
      ['lat-pulldown', 3, 10],
      ['dumbbell-shoulder-press', 3, 10],
      ['leg-press', 3, 12],
      ['dumbbell-curl', 3, 12],
    ],
  },
];

function templateFallback(exercises: Exercise[]): GeneratedRoutine[] {
  const known = new Set(exercises.map((e) => e.id));
  return TEMPLATE_ROUTINES.map((t) => ({
    name: t.name,
    items: t.items
      .filter(([id]) => known.has(id))
      .map(([exerciseId, sets, reps]) => ({ exerciseId, sets, reps, weightKg: null })),
    unmatched: [],
  })).filter((r) => r.items.length >= 3);
}

export async function generateRoutines(goal: string, exercises: Exercise[]): Promise<CoachResult> {
  try {
    const { data, error } = await supabase.functions.invoke('coach', { body: { goal } });
    if (error || !data || !Array.isArray(data.routines)) {
      return { routines: templateFallback(exercises), provider: null, fallback: true };
    }

    const routines: GeneratedRoutine[] = [];
    for (const r of data.routines) {
      if (typeof r?.name !== 'string' || !Array.isArray(r?.items)) continue;
      const items: RoutineItem[] = [];
      const unmatched: string[] = [];
      for (const raw of r.items) {
        const name = typeof raw?.exercise === 'string' ? raw.exercise : '';
        const sets = Math.min(Math.max(Math.round(Number(raw?.sets) || 3), 1), 10);
        const reps = Math.min(Math.max(Math.round(Number(raw?.reps) || 10), 1), 30);
        if (!name) continue;
        const match = matchFood(name.toLowerCase(), exercises)[0];
        if (match && match.score >= MATCH_FLOOR) {
          if (!items.some((i) => i.exerciseId === match.food.id)) {
            items.push({ exerciseId: match.food.id, sets, reps, weightKg: null });
          }
        } else {
          unmatched.push(name);
        }
      }
      if (items.length >= 3) routines.push({ name: r.name, items, unmatched });
    }

    if (!routines.length) {
      return { routines: templateFallback(exercises), provider: null, fallback: true };
    }
    return { routines, provider: data.provider ?? null, fallback: false };
  } catch {
    return { routines: templateFallback(exercises), provider: null, fallback: true };
  }
}

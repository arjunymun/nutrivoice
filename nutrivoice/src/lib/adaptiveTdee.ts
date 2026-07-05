import { FoodLogEntry, WeightEntry, addDays, dateKeyToDate, todayKey } from './types';

/**
 * Adaptive TDEE — MacroFactor-style expenditure estimation from observed data:
 * energy balance says TDEE = average intake − daily weight-change energy.
 *
 * Guardrails (each one exists because it broke in review):
 * - weight trend from least-squares regression over ALL weigh-ins in the
 *   window, never first-minus-last (water noise swamps real trends);
 * - a food day only counts when kcal ≥ max(800, 0.6×target) — a
 *   breakfast-only day poisons the average far worse than a missing day;
 * - needs ≥10 counted food days and ≥7 weigh-ins spanning ≥10 days;
 * - result clamped to [BMR, 2.5×BMR] and blended with the formula prior by
 *   data quantity;
 * - returns a SUGGESTION — never applies itself. The accept path must go
 *   through setCustomTargets so auto-recompute can't clobber it later.
 */

const KCAL_PER_KG = 7700;
const WINDOW_DAYS = 28;
const MIN_FOOD_DAYS = 10;
const MIN_WEIGH_INS = 7;
const MIN_SPAN_DAYS = 10;

export type TdeeEstimate =
  | {
      available: true;
      tdeeKcal: number;
      rawTdeeKcal: number;
      avgIntakeKcal: number;
      trendKgPerWeek: number;
      foodDays: number;
      weighIns: number;
      /** 0..1 — weight given to observed data vs the formula prior. */
      confidence: number;
    }
  | { available: false; reason: string };

function dayIndex(dateKey: string, origin: string): number {
  return Math.round(
    (dateKeyToDate(dateKey).getTime() - dateKeyToDate(origin).getTime()) / 86_400_000,
  );
}

/** Least-squares slope (kg/day) over (dayIndex, weight) points. */
export function weightTrendSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) * (p.x - meanX);
  }
  return den === 0 ? 0 : num / den;
}

export function estimateTdee(input: {
  entries: FoodLogEntry[];
  weights: WeightEntry[];
  targetKcal: number;
  bmrKcal: number;
  priorTdeeKcal: number;
  today?: string;
}): TdeeEstimate {
  const today = input.today ?? todayKey();
  const windowStart = addDays(today, -(WINDOW_DAYS - 1));

  // -- weight trend --
  const weighIns = input.weights
    .filter((w) => !w.deleted && w.dateKey >= windowStart && w.dateKey <= today)
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  if (weighIns.length < MIN_WEIGH_INS) {
    return { available: false, reason: `Need ${MIN_WEIGH_INS}+ weigh-ins in the last ${WINDOW_DAYS} days (have ${weighIns.length}). Log your weight on the Stats tab.` };
  }
  const span = dayIndex(weighIns[weighIns.length - 1].dateKey, weighIns[0].dateKey);
  if (span < MIN_SPAN_DAYS) {
    return { available: false, reason: `Weigh-ins need to span ${MIN_SPAN_DAYS}+ days (currently ${span}). Keep logging.` };
  }
  const slopeKgPerDay = weightTrendSlope(
    weighIns.map((w) => ({ x: dayIndex(w.dateKey, windowStart), y: w.weightKg })),
  );

  // -- intake --
  const kcalByDay = new Map<string, number>();
  for (const e of input.entries) {
    if (e.deleted || e.dateKey < windowStart || e.dateKey > today) continue;
    kcalByDay.set(e.dateKey, (kcalByDay.get(e.dateKey) ?? 0) + e.kcal);
  }
  const completeness = Math.max(800, 0.6 * input.targetKcal);
  const fullDays = [...kcalByDay.values()].filter((kcal) => kcal >= completeness);
  if (fullDays.length < MIN_FOOD_DAYS) {
    return { available: false, reason: `Need ${MIN_FOOD_DAYS}+ fully-logged days (have ${fullDays.length}). A day counts once it reaches ~${Math.round(completeness)} kcal logged.` };
  }
  const avgIntake = fullDays.reduce((s, k) => s + k, 0) / fullDays.length;

  // -- energy balance --
  const raw = avgIntake - slopeKgPerDay * KCAL_PER_KG;
  const clamped = Math.min(Math.max(raw, input.bmrKcal), 2.5 * input.bmrKcal);
  const confidence = Math.min(1, fullDays.length / WINDOW_DAYS);
  const blended = confidence * clamped + (1 - confidence) * input.priorTdeeKcal;

  return {
    available: true,
    tdeeKcal: Math.round(blended),
    rawTdeeKcal: Math.round(raw),
    avgIntakeKcal: Math.round(avgIntake),
    trendKgPerWeek: Math.round(slopeKgPerDay * 7 * 100) / 100,
    foodDays: fullDays.length,
    weighIns: weighIns.length,
    confidence: Math.round(confidence * 100) / 100,
  };
}

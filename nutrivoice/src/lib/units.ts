import { WeightUnit } from '../stores/useGymSettingsStore';

/**
 * Weight-unit conversion at the display/input boundary. Storage and all math
 * (volume, e1RM, PRs, sync) stay kg; only what the user SEES and TYPES is in
 * their chosen unit.
 */
export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Convert a stored kg value to the display unit, rounded to 1 decimal. */
export function displayWeight(kg: number, unit: WeightUnit): number {
  const v = unit === 'lb' ? kgToLb(kg) : kg;
  return Math.round(v * 10) / 10;
}

/** "62.5 kg" / "137.8 lb"; trims trailing .0. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${displayWeight(kg, unit)} ${unit}`;
}

/** Volume totals read better whole: "2,440 kg" / "5,379 lb". */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = unit === 'lb' ? kgToLb(kg) : kg;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}

/** A number the user typed in their unit → stored kg (2dp; keeps round-trips stable). */
export function inputToKg(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? lbToKg(value) : value;
  return Math.round(kg * 100) / 100;
}

/** Kg value as an editable input string in the display unit ('' for null). */
export function weightInputText(kg: number | null, unit: WeightUnit): string {
  return kg != null ? String(displayWeight(kg, unit)) : '';
}

import exercises from '../../data/exercises.json';
import { parseGymText } from '../gymParser';
import { displayWeight, formatVolume, formatWeight, inputToKg, kgToLb, lbToKg, weightInputText } from '../units';
import { Exercise } from '../workoutTypes';

const DB = exercises as Exercise[];

describe('unit conversion', () => {
  it('round-trips kg↔lb', () => {
    expect(kgToLb(20)).toBeCloseTo(44.09, 2);
    expect(lbToKg(kgToLb(100))).toBeCloseTo(100, 6);
  });

  it('displays in the chosen unit, 1 decimal', () => {
    expect(displayWeight(60, 'kg')).toBe(60);
    expect(displayWeight(60, 'lb')).toBe(132.3);
    expect(formatWeight(62.5, 'kg')).toBe('62.5 kg');
    expect(formatWeight(62.5, 'lb')).toBe('137.8 lb');
  });

  it('volume rounds whole with separators', () => {
    expect(formatVolume(2440, 'kg')).toBe('2,440 kg');
    expect(formatVolume(2440, 'lb')).toBe('5,379 lb');
  });

  it('typed input converts to stored kg', () => {
    expect(inputToKg(100, 'kg')).toBe(100);
    expect(inputToKg(135, 'lb')).toBeCloseTo(61.23, 2);
  });

  it('input text round-trip is stable for lb users', () => {
    // type 135 lb → store kg → re-display must be 135 again, not 134.9
    const kg = inputToKg(135, 'lb');
    expect(weightInputText(kg, 'lb')).toBe('135');
  });
});

describe('gymParser defaultUnit', () => {
  it('bare numbers use the display unit', () => {
    const kg = parseGymText('bench 3x8 at 100', DB)[0];
    expect(kg.weightKg).toBe(100);
    const lb = parseGymText('bench 3x8 at 135', DB, { defaultUnit: 'lb' })[0];
    expect(lb.weightKg).toBeCloseTo(61.2, 1);
  });

  it('explicit units always win over the default', () => {
    const g = parseGymText('bench 3x8 at 100 kg', DB, { defaultUnit: 'lb' })[0];
    expect(g.weightKg).toBe(100);
    const g2 = parseGymText('bench 3x8 at 225 lbs', DB)[0];
    expect(g2.weightKg).toBeCloseTo(102.1, 1);
  });
});

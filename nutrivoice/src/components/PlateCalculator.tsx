import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { displayWeight } from '../lib/units';
import { plateBreakdown } from '../lib/workoutMath';
import { useGymSettingsStore, WeightUnit } from '../stores/useGymSettingsStore';
import { colors, font, radius, spacing } from '../theme';
import { BottomSheet } from './BottomSheet';

/** Bars and plate sets native to each unit — a US gym racks 45s, not 20.4s. */
const BARS: Record<WeightUnit, number[]> = { kg: [20, 15, 10, 0], lb: [45, 35, 25, 0] };
const PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

/**
 * Barbell plate calculator — given a target weight and bar, show the plates to
 * load on each side. A staple of every serious lifting app; ours is free.
 */
export function PlateCalculator({
  visible,
  initialKg,
  onClose,
}: {
  visible: boolean;
  initialKg?: number | null;
  onClose: () => void;
}) {
  const unit = useGymSettingsStore((s) => s.weightUnit);
  const [weight, setWeight] = useState(
    initialKg != null ? String(displayWeight(initialKg, unit)) : '',
  );
  const [bar, setBar] = useState(BARS[unit][0]);

  // The component stays mounted with the sheet closed, so a mount-time
  // initializer alone would show a stale (or empty) prefill forever. Re-seed
  // from the caller's current weight every time the sheet opens.
  const prevVisible = useRef(visible);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setWeight(initialKg != null ? String(displayWeight(initialKg, unit)) : '');
    }
    prevVisible.current = visible;
  }, [visible, initialKg, unit]);

  // Unit switch mid-session: jump to that unit's standard bar.
  useEffect(() => {
    setBar(BARS[unit][0]);
  }, [unit]);

  // plateBreakdown is unit-agnostic math — feed it numbers in the display unit.
  const total = Number(weight);
  const load = total > 0 ? plateBreakdown(total, bar, PLATES[unit]) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Plate calculator</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholder={`total ${unit}`}
              placeholderTextColor={colors.textFaint}
              autoFocus
            />
            <Text style={styles.unit}>{unit} total</Text>
          </View>

          <View style={styles.barRow}>
            {BARS[unit].map((b) => (
              <Pressable
                key={b}
                onPress={() => setBar(b)}
                style={[styles.barChip, bar === b && styles.barChipOn]}
              >
                <Text style={[styles.barChipText, bar === b && styles.barChipTextOn]}>
                  {b === 0 ? 'No bar' : `${b}${unit} bar`}
                </Text>
              </Pressable>
            ))}
          </View>

          {load && (
            <View style={styles.result}>
              {load.perSide.length > 0 ? (
                <>
                  <Text style={styles.perSideLabel}>Per side</Text>
                  <View style={styles.plates}>
                    {load.perSide.map((p, i) => (
                      <View key={i} style={styles.plate}>
                        <Text style={styles.plateText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.note}>Below bar weight — nothing to load.</Text>
              )}
              {load.leftover > 0 && (
                <Text style={styles.note}>+{load.leftover} {unit} can’t be made with standard plates.</Text>
              )}
            </View>
          )}

      <Pressable style={styles.done} onPress={onClose}>
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: font.extrabold, fontSize: 20, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3.5),
  },
  input: { flex: 1, color: colors.text, fontFamily: font.bold, fontSize: 22, paddingVertical: spacing(3), textAlign: 'center' },
  unit: { color: colors.textFaint, fontFamily: font.regular, fontSize: 13 },
  barRow: { flexDirection: 'row', gap: spacing(2), justifyContent: 'center', flexWrap: 'wrap' },
  barChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  barChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  barChipText: { color: colors.textMuted, fontFamily: font.semibold, fontSize: 12 },
  barChipTextOn: { color: colors.onAccent },
  result: { alignItems: 'center', gap: spacing(2.5) },
  perSideLabel: { color: colors.textMuted, fontFamily: font.medium, fontSize: 12 },
  plates: { flexDirection: 'row', gap: spacing(1.5), flexWrap: 'wrap', justifyContent: 'center' },
  plate: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
    minWidth: 40,
    alignItems: 'center',
  },
  plateText: { color: colors.text, fontFamily: font.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  note: { color: colors.textMuted, fontFamily: font.regular, fontSize: 12, textAlign: 'center' },
  done: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  doneText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 15 },
});

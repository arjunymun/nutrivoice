import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { tapHaptic } from '../lib/haptics';
import { useGymSettingsStore, WeightUnit } from '../stores/useGymSettingsStore';
import { colors, font, radius, spacing } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './motion';
import { Muted } from './ui';

const REST_CHOICES: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2m', value: 120 },
  { label: '3m', value: 180 },
];

/** Hevy-style training preferences: units, rest timer, haptics. Device-local. */
export function GymSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const weightUnit = useGymSettingsStore((s) => s.weightUnit);
  const defaultRestS = useGymSettingsStore((s) => s.defaultRestS);
  const hapticsEnabled = useGymSettingsStore((s) => s.hapticsEnabled);
  const setWeightUnit = useGymSettingsStore((s) => s.setWeightUnit);
  const setDefaultRestS = useGymSettingsStore((s) => s.setDefaultRestS);
  const setHapticsEnabled = useGymSettingsStore((s) => s.setHapticsEnabled);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Training settings</Text>

      <View style={styles.section}>
        <Text style={styles.label}>WEIGHT UNIT</Text>
        <View style={styles.segment}>
          {(['kg', 'lb'] as WeightUnit[]).map((u) => (
            <PressableScale
              key={u}
              onPress={() => {
                tapHaptic();
                setWeightUnit(u);
              }}
              style={[styles.segmentItem, weightUnit === u && styles.segmentItemOn]}
              scaleTo={0.97}
            >
              <Text style={[styles.segmentText, weightUnit === u && styles.segmentTextOn]}>
                {u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'}
              </Text>
            </PressableScale>
          ))}
        </View>
        <Muted style={{ fontSize: 11 }}>
          Changes how weights display and what you type — history is converted automatically.
        </Muted>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>REST TIMER AFTER EACH SET</Text>
        <View style={styles.chipRow}>
          {REST_CHOICES.map((c) => (
            <PressableScale
              key={c.value}
              onPress={() => {
                tapHaptic();
                setDefaultRestS(c.value);
              }}
              style={[styles.chip, defaultRestS === c.value && styles.chipOn]}
              scaleTo={0.94}
            >
              <Text style={[styles.chipText, defaultRestS === c.value && styles.chipTextOn]}>
                {c.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={[styles.section, styles.switchRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>HAPTIC FEEDBACK</Text>
          <Muted style={{ fontSize: 11 }}>Vibration on taps and completed sets (phones only).</Muted>
        </View>
        <Switch
          value={hapticsEnabled}
          onValueChange={setHapticsEnabled}
          trackColor={{ false: colors.border, true: colors.accentDim }}
          thumbColor={hapticsEnabled ? colors.accent : colors.textFaint}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: font.extrabold, fontSize: 20, textAlign: 'center' },
  section: { gap: spacing(2) },
  label: {
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1),
    gap: spacing(1),
  },
  segmentItem: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  segmentItemOn: { backgroundColor: colors.accent },
  segmentText: { color: colors.textMuted, fontFamily: font.semibold, fontSize: 13 },
  segmentTextOn: { color: colors.onAccent },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontFamily: font.semibold, fontSize: 13 },
  chipTextOn: { color: colors.onAccent },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
});

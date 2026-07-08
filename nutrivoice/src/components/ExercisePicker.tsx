import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { matchFood } from '../lib/parser';
import { Exercise, MuscleGroup } from '../lib/workoutTypes';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { colors, font, spacing } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Chip, LabeledInput, Muted, PrimaryButton, SectionTitle } from './ui';

const QUICK_MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'core'];

export function ExercisePicker({
  visible,
  pool,
  onPick,
  onClose,
}: {
  visible: boolean;
  pool: Exercise[];
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);
  const [query, setQuery] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool.slice(0, 25);
    return matchFood(q, pool, 25).map((m) => m.food);
  }, [query, pool]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <SectionTitle>Add exercise</SectionTitle>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <LabeledInput
        label={`Search ${pool.length} exercises`}
        placeholder="bench, rdl, lat pulldown…"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoFocus
      />
      <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
        {results.map((e) => (
          <Pressable
            key={e.id}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            onPress={() => onPick(e)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{e.name}</Text>
              <Text style={styles.sub}>
                {e.primary_muscle.replace('_', ' ')} · {e.equipment}
              </Text>
            </View>
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
          </Pressable>
        ))}
        {results.length === 0 && <Muted>No match — create it below.</Muted>}
      </ScrollView>

      <Pressable onPress={() => setShowCustom(!showCustom)}>
        <Text style={styles.link}>{showCustom ? 'Hide custom exercise' : '+ Custom exercise'}</Text>
      </Pressable>
      {showCustom && (
        <View style={{ gap: spacing(3) }}>
          <LabeledInput label="Name" value={customName} onChangeText={setCustomName} placeholder="Cable Y-Raise" />
          <View style={styles.chips}>
            {QUICK_MUSCLES.map((m) => (
              <Chip key={m} label={m} active={customMuscle === m} onPress={() => setCustomMuscle(m)} />
            ))}
          </View>
          <PrimaryButton
            title="Create & add"
            disabled={!customName.trim()}
            onPress={() => {
              const e = addCustomExercise(customName, customMuscle);
              onPick(e);
            }}
          />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  sub: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: 1,
  },
  link: {
    color: colors.carbs,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
});

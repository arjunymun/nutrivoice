import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Equipment, MuscleGroup } from '../lib/workoutTypes';
import { colors, radius } from '../theme';

/**
 * Visual identity for an exercise: muscle group sets the color, equipment
 * sets the glyph. Gives every exercise list the designed, at-a-glance look
 * of a real training app instead of bare text rows.
 */
const MUSCLE_COLOR: Record<MuscleGroup, string> = {
  chest: colors.protein,
  back: colors.carbs,
  shoulders: colors.fat,
  biceps: '#B48EF5',
  triceps: '#B48EF5',
  forearms: '#B48EF5',
  quads: colors.accent,
  hamstrings: colors.accent,
  glutes: colors.accent,
  calves: colors.accent,
  core: colors.success,
  full_body: colors.textMuted,
  cardio: colors.danger,
};

const EQUIPMENT_ICON: Record<Equipment, keyof typeof Ionicons.glyphMap> = {
  barbell: 'barbell',
  dumbbell: 'barbell',
  machine: 'cog',
  cable: 'swap-vertical',
  bodyweight: 'body',
  kettlebell: 'fitness',
  band: 'link',
  other: 'fitness',
};

export function ExerciseAvatar({
  muscle,
  equipment,
  size = 36,
}: {
  muscle: MuscleGroup;
  equipment: Equipment;
  size?: number;
}) {
  const color = MUSCLE_COLOR[muscle] ?? colors.textMuted;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, backgroundColor: `${color}22`, borderColor: `${color}55` },
      ]}
    >
      <Ionicons name={EQUIPMENT_ICON[equipment] ?? 'fitness'} size={size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodLogEntry, Meal } from '../lib/types';
import { colors, font, radius, spacing } from '../theme';

const MEAL_META: Record<Meal, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline' },
  lunch: { label: 'Lunch', icon: 'restaurant-outline' },
  dinner: { label: 'Dinner', icon: 'moon-outline' },
  snack: { label: 'Snacks', icon: 'cafe-outline' },
};

export function MealSection({
  meal,
  entries,
  onAdd,
  onEntryPress,
}: {
  meal: Meal;
  entries: FoodLogEntry[];
  onAdd: () => void;
  onEntryPress: (entry: FoodLogEntry) => void;
}) {
  const meta = MEAL_META[meal];
  const kcal = Math.round(entries.reduce((sum, e) => sum + e.kcal, 0));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={meta.icon} size={16} color={colors.accent} />
          <Text style={styles.title}>{meta.label}</Text>
        </View>
        <View style={styles.headerRight}>
          {kcal > 0 && <Text style={styles.kcal}>{kcal} kcal</Text>}
          <Pressable onPress={onAdd} hitSlop={8} style={styles.addBtn}>
            <Ionicons name="add" size={18} color={colors.onAccent} />
          </Pressable>
        </View>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.empty}>Nothing logged</Text>
      ) : (
        entries.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => onEntryPress(e)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={styles.grams}>
                {e.grams} g · P {e.proteinG} · C {e.carbsG} · F {e.fatG}
              </Text>
            </View>
            <Text style={styles.rowKcal}>{Math.round(e.kcal)}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2.5),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  title: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 15,
  },
  kcal: {
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(1.5),
  },
  name: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
  },
  grams: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: 1,
  },
  rowKcal: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 14,
  },
});

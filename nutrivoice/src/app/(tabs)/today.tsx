import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalorieRing } from '@/components/CalorieRing';
import { EntryEditModal } from '@/components/EntryEditModal';
import { MacroBar } from '@/components/MacroBar';
import { MealSection } from '@/components/MealSection';
import { Card } from '@/components/ui';
import { addDays, FoodLogEntry, Meal, MEALS, todayKey, dateKeyToDate } from '@/lib/types';
import { dayTotals, entriesForDay, useLogStore } from '@/stores/useLogStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { colors, font, macroColor, spacing } from '@/theme';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Today() {
  const profile = useProfileStore((s) => s.profile);
  const entries = useLogStore((s) => s.entries);
  const [dateKey, setDateKey] = useState(todayKey());
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);

  const dayEntries = useMemo(() => entriesForDay(entries, dateKey), [entries, dateKey]);
  const totals = useMemo(() => dayTotals(entries, dateKey), [entries, dateKey]);

  const targetKcal = profile?.targetKcal ?? 2000;
  const week = useMemo(() => {
    const today = todayKey();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  }, []);

  const byMeal = (meal: Meal) => dayEntries.filter((e) => e.meal === meal);
  const isToday = dateKey === todayKey();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>
              {isToday ? `Hi ${profile?.name ?? 'there'}` : 'Looking back'}
            </Text>
            <Text style={styles.date}>
              {dateKeyToDate(dateKey).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
        </View>

        <View style={styles.weekRow}>
          {week.map((key) => {
            const d = dateKeyToDate(key);
            const active = key === dateKey;
            const logged = entriesForDay(entries, key).length > 0;
            return (
              <Pressable
                key={key}
                onPress={() => setDateKey(key)}
                style={[styles.dayChip, active && styles.dayChipActive]}
              >
                <Text style={[styles.dayLetter, active && { color: colors.onAccent }]}>
                  {DAY_LETTERS[d.getDay()]}
                </Text>
                <Text style={[styles.dayNum, active && { color: colors.onAccent }]}>
                  {d.getDate()}
                </Text>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: logged ? (active ? colors.onAccent : colors.accent) : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <Card style={{ alignItems: 'center', gap: spacing(4) }}>
          <CalorieRing consumed={totals.kcal} target={targetKcal} />
          <View style={styles.macroRow}>
            <MacroBar
              label="Protein"
              value={totals.proteinG}
              target={profile?.targetProteinG ?? 140}
              color={macroColor.protein}
            />
            <MacroBar
              label="Carbs"
              value={totals.carbsG}
              target={profile?.targetCarbsG ?? 220}
              color={macroColor.carbs}
            />
            <MacroBar
              label="Fat"
              value={totals.fatG}
              target={profile?.targetFatG ?? 60}
              color={macroColor.fat}
            />
          </View>
        </Card>

        {MEALS.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={byMeal(meal)}
            onAdd={() => router.push({ pathname: '/log', params: { meal, date: dateKey } })}
            onEntryPress={setEditing}
          />
        ))}
      </ScrollView>
      {editing && <EntryEditModal entry={editing} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing(4),
    gap: spacing(3.5),
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing(10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(1),
  },
  hello: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 24,
  },
  date: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    marginTop: 2,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(1.5),
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing(2.5),
    gap: 2,
  },
  dayChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayLetter: {
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: 11,
  },
  dayNum: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 15,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing(4),
    alignSelf: 'stretch',
  },
});

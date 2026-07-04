import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeekBars, WeightLine } from '@/components/charts';
import { Card, LabeledInput, Muted, PrimaryButton, SectionTitle, StatTile } from '@/components/ui';
import { ageFromBirthYear, bmi, bmiCategory, bmr, tdee } from '@/lib/nutrition';
import { addDays, dateKeyToDate, todayKey } from '@/lib/types';
import { dayTotals, useLogStore } from '@/stores/useLogStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { colors, font, spacing } from '@/theme';

export default function Stats() {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const entries = useLogStore((s) => s.entries);
  const weights = useLogStore((s) => s.weights);
  const addWeight = useLogStore((s) => s.addWeight);
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width, 560) - spacing(4) * 2 - spacing(4) * 2;

  const [weightInput, setWeightInput] = useState('');

  const week = useMemo(() => {
    const today = todayKey();
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i - 6);
      const totals = dayTotals(entries, key);
      return {
        key,
        label: dateKeyToDate(key).toLocaleDateString(undefined, { weekday: 'narrow' }),
        totals,
      };
    });
  }, [entries]);

  const loggedDays = week.filter((d) => d.totals.kcal > 0);
  const avg = (sel: (t: { kcal: number; proteinG: number; carbsG: number; fatG: number }) => number) =>
    loggedDays.length
      ? Math.round(loggedDays.reduce((sum, d) => sum + sel(d.totals), 0) / loggedDays.length)
      : 0;

  const weightPoints = useMemo(
    () =>
      weights
        .filter((w) => !w.deleted)
        .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1))
        .slice(-30)
        .map((w) => ({ label: w.dateKey, value: w.weightKg })),
    [weights],
  );

  const latestWeight = weightPoints.length ? weightPoints[weightPoints.length - 1].value : profile?.weightKg;
  const bmiValue = profile && latestWeight ? bmi(latestWeight, profile.heightCm) : null;
  const age = profile ? ageFromBirthYear(profile.birthYear) : null;
  const bmrValue =
    profile && age != null ? Math.round(bmr(profile.sex, latestWeight ?? profile.weightKg, profile.heightCm, age)) : null;
  const tdeeValue =
    profile && age != null
      ? Math.round(tdee(profile.sex, latestWeight ?? profile.weightKg, profile.heightCm, age, profile.activityLevel))
      : null;

  const logWeight = () => {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w < 20 || w > 400) return;
    addWeight(todayKey(), w);
    // keep profile weight (used for BMR/targets) in step with the scale
    updateProfile({ weightKg: w });
    setWeightInput('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Stats</Text>

        <Card style={{ gap: spacing(3) }}>
          <SectionTitle>Last 7 days</SectionTitle>
          <WeekBars
            data={week.map((d) => ({ label: d.label, value: d.totals.kcal }))}
            target={profile?.targetKcal ?? 0}
            width={chartWidth}
          />
          <Muted>Dashed line = your {profile?.targetKcal ?? '—'} kcal target</Muted>
        </Card>

        <View style={styles.tileRow}>
          <StatTile label="Avg kcal" value={loggedDays.length ? String(avg((t) => t.kcal)) : '—'} sub={`${loggedDays.length} day(s) logged`} />
          <StatTile label="Avg protein" value={loggedDays.length ? `${avg((t) => t.proteinG)} g` : '—'} sub={`target ${profile?.targetProteinG ?? '—'} g`} />
        </View>

        <Card style={{ gap: spacing(3) }}>
          <SectionTitle>Body</SectionTitle>
          <View style={styles.tileRow}>
            <StatTile
              label="BMI"
              value={bmiValue ? bmiValue.toFixed(1) : '—'}
              sub={bmiValue ? bmiCategory(bmiValue) : 'set up profile'}
            />
            <StatTile label="BMR" value={bmrValue ? `${bmrValue}` : '—'} sub="kcal at rest" />
            <StatTile label="TDEE" value={tdeeValue ? `${tdeeValue}` : '—'} sub="kcal maintenance" />
          </View>
        </Card>

        <Card style={{ gap: spacing(3) }}>
          <SectionTitle>Weight</SectionTitle>
          <WeightLine points={weightPoints} width={chartWidth} />
          <View style={styles.weightRow}>
            <View style={{ flex: 1 }}>
              <LabeledInput
                label="Today’s weight (kg)"
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="numeric"
                placeholder={latestWeight ? String(latestWeight) : '70'}
              />
            </View>
            <PrimaryButton
              title="Log"
              onPress={logWeight}
              disabled={!(Number(weightInput) >= 20 && Number(weightInput) <= 400)}
              style={{ paddingHorizontal: spacing(6), alignSelf: 'flex-end' }}
            />
          </View>
        </Card>
      </ScrollView>
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
  title: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 24,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing(3),
  },
  weightRow: {
    flexDirection: 'row',
    gap: spacing(3),
    alignItems: 'flex-end',
  },
});

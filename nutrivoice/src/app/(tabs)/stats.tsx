import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeekBars, WeightLine } from '@/components/charts';
import { TdeeCard } from '@/components/TdeeCard';
import { Card, LabeledInput, Muted, PrimaryButton, SectionTitle, StatTile } from '@/components/ui';
import exercisesJson from '@/data/exercises.json';
import { ageFromBirthYear, bmi, bmiCategory, bmr, tdee } from '@/lib/nutrition';
import { addDays, dateKeyToDate, toDateKey, todayKey } from '@/lib/types';
import { formatWeight } from '@/lib/units';
import { useGymSettingsStore } from '@/stores/useGymSettingsStore';
import { BIG_LIFTS, bestE1RmByExercise, muscleWeeklyVolume, workoutVolume } from '@/lib/workoutMath';
import { Exercise } from '@/lib/workoutTypes';
import { dayTotals, useLogStore } from '@/stores/useLogStore';
import { exercisePool, setsForWorkout, useWorkoutStore } from '@/stores/useWorkoutStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { colors, font, spacing } from '@/theme';

const EXERCISE_DB = exercisesJson as Exercise[];

export default function Stats() {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const entries = useLogStore((s) => s.entries);
  const weights = useLogStore((s) => s.weights);
  const addWeight = useLogStore((s) => s.addWeight);
  const workouts = useWorkoutStore((s) => s.workouts);
  const allSets = useWorkoutStore((s) => s.sets);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const weightUnit = useGymSettingsStore((s) => s.weightUnit);
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

  const training = useMemo(() => {
    const finished = workouts.filter((w) => !w.deleted && w.durationS != null);
    const today = todayKey();
    const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const volumeByDay = new Map(weekKeys.map((k) => [k, 0]));
    let weekWorkouts = 0;
    for (const w of finished) {
      const key = toDateKey(new Date(w.startedAt));
      if (volumeByDay.has(key)) {
        volumeByDay.set(key, volumeByDay.get(key)! + workoutVolume(setsForWorkout(allSets, w.id)));
        weekWorkouts++;
      }
    }
    const liveWorkoutIds = new Set(finished.map((w) => w.id));
    const best = bestE1RmByExercise(allSets.filter((s) => liveWorkoutIds.has(s.workoutId)));
    const prs = BIG_LIFTS.map((l) => ({ ...l, e1rm: best.get(l.id) })).filter((l) => l.e1rm != null);
    return {
      bars: weekKeys.map((k) => ({
        label: dateKeyToDate(k).toLocaleDateString(undefined, { weekday: 'narrow' }),
        value: volumeByDay.get(k)!,
      })),
      weekWorkouts,
      prs,
      hasAny: finished.length > 0,
    };
  }, [workouts, allSets]);

  const muscleVol = useMemo(() => {
    const index = new Map(exercisePool(EXERCISE_DB, customExercises).map((e) => [e.id, e]));
    return [...muscleWeeklyVolume(allSets, workouts, index, { sinceDays: 7 }).entries()].sort(
      (a, b) => b[1] - a[1],
    );
  }, [allSets, workouts, customExercises]);
  const muscleMax = muscleVol.length ? muscleVol[0][1] : 1;

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

        <TdeeCard />

        {training.hasAny && (
          <Card style={{ gap: spacing(3) }}>
            <SectionTitle>Training — last 7 days</SectionTitle>
            <WeekBars data={training.bars} target={0} width={chartWidth} />
            <Muted>
              {training.weekWorkouts} workout{training.weekWorkouts === 1 ? '' : 's'} this week ·
              bars = volume ({weightUnit})
            </Muted>
            {training.prs.length > 0 && (
              <View style={styles.tileRow}>
                {training.prs.slice(0, 3).map((p) => (
                  <StatTile key={p.id} label={p.label} value={formatWeight(Math.round(p.e1rm!), weightUnit)} sub="est. 1RM" />
                ))}
              </View>
            )}
          </Card>
        )}

        {muscleVol.length > 0 && (
          <Card style={{ gap: spacing(2.5) }}>
            <SectionTitle>Muscle volume — last 7 days</SectionTitle>
            {muscleVol.map(([m, v]) => (
              <View key={m} style={styles.muscleRow}>
                <Text style={styles.muscleLabel}>{m.replace('_', ' ')}</Text>
                <View style={styles.muscleTrack}>
                  <View style={[styles.muscleFill, { width: `${Math.max(6, (v / muscleMax) * 100)}%` }]} />
                </View>
                <Text style={styles.muscleVal}>{Number.isInteger(v) ? v : v.toFixed(1)}</Text>
              </View>
            ))}
            <Muted style={{ fontSize: 11 }}>
              Working sets per muscle (primary = 1, secondary = ½). Hevy locks this behind Pro.
            </Muted>
          </Card>
        )}

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
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  muscleLabel: {
    width: 76,
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  muscleTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 5,
    overflow: 'hidden',
  },
  muscleFill: { height: 10, backgroundColor: colors.accent, borderRadius: 5 },
  muscleVal: {
    width: 28,
    textAlign: 'right',
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});

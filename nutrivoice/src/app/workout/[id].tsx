import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, GhostButton, Muted, PrimaryButton, SectionTitle } from '@/components/ui';
import exercisesJson from '@/data/exercises.json';
import { toDateKey } from '@/lib/types';
import { detectPrs, workoutSetCount, workoutVolume } from '@/lib/workoutMath';
import { Exercise } from '@/lib/workoutTypes';
import { exercisePool, setsForWorkout, useWorkoutStore } from '@/stores/useWorkoutStore';
import { colors, font, spacing } from '@/theme';

const EXERCISE_DB = exercisesJson as Exercise[];

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useWorkoutStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const workout = store.workouts.find((w) => w.id === id && !w.deleted);
  const sets = useMemo(() => (workout ? setsForWorkout(store.sets, workout.id) : []), [store.sets, workout]);
  const pool = useMemo(() => exercisePool(EXERCISE_DB, store.customExercises), [store.customExercises]);
  const prs = useMemo(
    () => (workout ? detectPrs(store.sets, store.workouts, workout.id) : []),
    [store.sets, store.workouts, workout],
  );

  if (!workout) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Muted>Workout not found.</Muted>
          <GhostButton title="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
  }
  const prIds = new Set(prs.map((p) => p.exerciseId));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{workout.name}</Text>
        </View>
        <Muted>
          {toDateKey(new Date(workout.startedAt))} · {Math.round((workout.durationS ?? 0) / 60)} min ·{' '}
          {workoutSetCount(sets)} sets · {workoutVolume(sets).toLocaleString()} kg total
          {prs.length > 0 ? ` · 🏆 ${prs.length} PR${prs.length > 1 ? 's' : ''}` : ''}
        </Muted>

        {[...byExercise.entries()].map(([exerciseId, exSets]) => {
          const ex = pool.find((e) => e.id === exerciseId);
          return (
            <Card key={exerciseId} style={{ gap: spacing(2) }}>
              <SectionTitle>
                {ex?.name ?? exerciseId}
                {prIds.has(exerciseId) ? ' 🏆' : ''}
              </SectionTitle>
              {exSets.map((s) => (
                <Text key={s.id} style={styles.setText}>
                  {s.setNumber}.{' '}
                  {s.durationS != null
                    ? `${s.durationS} s`
                    : `${s.weightKg != null ? `${s.weightKg} kg` : 'bodyweight'} × ${s.reps}`}
                  {s.isWarmup ? '  (warmup)' : ''}
                  {s.rpe != null ? `  @rpe ${s.rpe}` : ''}
                </Text>
              ))}
            </Card>
          );
        })}

        {confirmDelete ? (
          <Card style={{ gap: spacing(3), borderColor: colors.danger }}>
            <Muted>Delete this workout everywhere? This syncs to all devices.</Muted>
            <PrimaryButton
              title="Yes, delete"
              style={{ backgroundColor: colors.danger }}
              onPress={() => {
                store.deleteWorkout(workout.id);
                router.back();
              }}
            />
            <GhostButton title="Cancel" onPress={() => setConfirmDelete(false)} />
          </Card>
        ) : (
          <GhostButton title="Delete workout" danger onPress={() => setConfirmDelete(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(3) },
  container: {
    padding: spacing(4),
    gap: spacing(3.5),
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing(10),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  title: { color: colors.text, fontFamily: font.extrabold, fontSize: 22 },
  setText: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});

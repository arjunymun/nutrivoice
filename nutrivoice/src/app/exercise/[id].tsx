import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Card, GhostButton, Muted, SectionTitle } from '@/components/ui';
import exercisesJson from '@/data/exercises.json';
import { toDateKey } from '@/lib/types';
import { exerciseRecords } from '@/lib/workoutMath';
import { Exercise } from '@/lib/workoutTypes';
import { exercisePool, useWorkoutStore } from '@/stores/useWorkoutStore';
import { colors, font, radius, spacing } from '@/theme';

const EXERCISE_DB = exercisesJson as Exercise[];

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Selectors, not `useWorkoutStore()` — whole-store subscription goes stale
  // under the React Compiler (see Train()).
  const workouts = useWorkoutStore((s) => s.workouts);
  const allSets = useWorkoutStore((s) => s.sets);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const pool = useMemo(() => exercisePool(EXERCISE_DB, customExercises), [customExercises]);
  const exercise = pool.find((e) => e.id === id);
  const records = useMemo(
    () => (id ? exerciseRecords(allSets, workouts, id) : null),
    [allSets, workouts, id],
  );

  if (!exercise || !records) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Muted>Exercise not found.</Muted>
          <GhostButton title="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const sessionsDesc = [...records.sessions].reverse();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{exercise.name}</Text>
            <Muted style={{ fontSize: 12, textTransform: 'capitalize' }}>
              {exercise.primary_muscle.replace('_', ' ')} · {exercise.equipment}
            </Muted>
          </View>
        </View>

        {records.sessions.length === 0 ? (
          <Card>
            <Muted>No sets logged yet. Log this exercise in a workout and your records appear here.</Muted>
            {!!exercise.cue && <Muted style={{ fontSize: 13, marginTop: spacing(2) }}>💡 {exercise.cue}</Muted>}
          </Card>
        ) : (
          <>
            <View style={styles.recordGrid}>
              <Record label="Best e1RM" value={records.bestE1Rm != null ? `${records.bestE1Rm} kg` : '—'} highlight />
              <Record label="Heaviest" value={records.heaviestKg != null ? `${records.heaviestKg} kg` : '—'} />
              <Record label="Best volume" value={`${records.bestSessionVolume.toLocaleString()} kg`} />
              <Record label="Most reps" value={records.mostReps != null ? String(records.mostReps) : '—'} />
              <Record label="Total sets" value={String(records.totalSets)} />
              <Record label="Total volume" value={`${records.totalVolume.toLocaleString()} kg`} />
            </View>

            <E1rmChart sessions={records.sessions} />

            <Card style={{ gap: spacing(2.5) }}>
              <SectionTitle>History</SectionTitle>
              {sessionsDesc.map((s) => (
                <View key={s.workoutId} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histTop}>
                      {s.topWeightKg != null ? `${s.topWeightKg} kg` : 'bodyweight'}
                      {s.topReps != null ? ` × ${s.topReps}` : ''}
                    </Text>
                    <Muted style={{ fontSize: 12 }}>
                      {toDateKey(new Date(s.startedAt))} · {s.sets} sets · {s.volume.toLocaleString()} kg
                    </Muted>
                  </View>
                  {s.e1rm != null && <Text style={styles.histE1rm}>{s.e1rm}</Text>}
                </View>
              ))}
            </Card>

            {!!exercise.cue && (
              <Card>
                <Muted style={{ fontSize: 13 }}>💡 {exercise.cue}</Muted>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Record({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.record, highlight && { borderColor: colors.accent }]}>
      <Text style={[styles.recordValue, highlight && { color: colors.accent }]}>{value}</Text>
      <Muted style={{ fontSize: 11 }}>{label}</Muted>
    </View>
  );
}

/** Minimal e1RM-over-time line chart (sessions with a computable e1RM). */
function E1rmChart({ sessions }: { sessions: { e1rm: number | null }[] }) {
  const pts = sessions.map((s) => s.e1rm).filter((v): v is number => v != null);
  if (pts.length < 2) return null;

  const W = 300;
  const H = 90;
  const pad = 8;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((v - min) / span) * (H - 2 * pad);
    return { x, y };
  });
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <Card style={{ gap: spacing(2) }}>
      <SectionTitle>Estimated 1RM trend</SectionTitle>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={polyline} fill="none" stroke={colors.accent} strokeWidth={2} />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={2.5} fill={colors.accent} />
        ))}
      </Svg>
      <View style={styles.chartLegend}>
        <Muted style={{ fontSize: 11 }}>{min} kg</Muted>
        <Muted style={{ fontSize: 11 }}>{max} kg</Muted>
      </View>
    </Card>
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
  recordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2.5) },
  record: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(2),
    alignItems: 'center',
    gap: spacing(1),
  },
  recordValue: { color: colors.text, fontFamily: font.extrabold, fontSize: 17, fontVariant: ['tabular-nums'] },
  chartLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  histTop: { color: colors.text, fontFamily: font.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
  histE1rm: { color: colors.accent, fontFamily: font.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
});

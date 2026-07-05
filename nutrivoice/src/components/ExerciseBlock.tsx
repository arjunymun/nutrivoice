import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { suggestNextWeight } from '../lib/workoutMath';
import { Exercise, WorkoutSet } from '../lib/workoutTypes';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { colors, font, radius, spacing } from '../theme';
import { Muted } from './ui';

const DEFAULT_REST_S = 90;

/**
 * One exercise inside the active workout: logged sets, quick-log inputs
 * prefilled from the previous set / last session, deterministic progression
 * hint, per-set delete.
 */
export function ExerciseBlock({
  exercise,
  sets,
  lastSessionSets,
  historySessions,
}: {
  exercise: Exercise;
  sets: WorkoutSet[];
  lastSessionSets: WorkoutSet[];
  historySessions: WorkoutSet[][];
}) {
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removePlanned = useWorkoutStore((s) => s.removePlanned);
  const setRestEndsAt = useWorkoutStore((s) => s.setRestEndsAt);

  const isDuration = exercise.load_type === 'duration';
  const isBodyweight = exercise.load_type === 'bodyweight_reps';

  const lastLogged = sets[sets.length - 1];
  const lastPrev = lastSessionSets[lastSessionSets.length - 1];
  const seedWeight = lastLogged?.weightKg ?? lastPrev?.weightKg ?? null;
  const seedReps = lastLogged?.reps ?? lastPrev?.reps ?? null;
  const seedDuration = lastLogged?.durationS ?? lastPrev?.durationS ?? null;

  const [weight, setWeight] = useState(seedWeight != null ? String(seedWeight) : '');
  const [reps, setReps] = useState(seedReps != null ? String(seedReps) : '');
  const [duration, setDuration] = useState(seedDuration != null ? String(seedDuration) : '');

  const suggestion =
    !isDuration && !isBodyweight && historySessions.length >= 1 && seedReps != null
      ? suggestNextWeight(exercise, historySessions, seedReps)
      : null;

  const w = Number(weight);
  const r = Number(reps);
  const d = Number(duration);
  const valid = isDuration
    ? d > 0 && d <= 7200
    : (isBodyweight ? true : w > 0 && w <= 600) && r > 0 && r <= 100;

  const logSet = () => {
    if (!valid) return;
    addSet({
      exerciseId: exercise.id,
      weightKg: isDuration || isBodyweight ? null : w,
      reps: isDuration ? null : r,
      durationS: isDuration ? Math.round(d) : null,
    });
    setRestEndsAt(Date.now() + DEFAULT_REST_S * 1000);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{exercise.name}</Text>
          {lastPrev && (
            <Muted style={{ fontSize: 12 }}>
              last time:{' '}
              {lastSessionSets
                .slice(0, 4)
                .map((s) =>
                  s.durationS != null ? `${s.durationS}s` : `${s.weightKg ?? 'bw'}×${s.reps}`,
                )
                .join(', ')}
            </Muted>
          )}
        </View>
        {sets.length === 0 && (
          <Pressable onPress={() => removePlanned(exercise.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      </View>

      {suggestion && sets.length === 0 && (
        <Text style={styles.hint}>
          {suggestion.action === 'increase' ? '↑' : suggestion.action === 'deload' ? '↓' : '→'}{' '}
          {suggestion.reason}
        </Text>
      )}

      {sets.map((s) => (
        <View key={s.id} style={styles.setRow}>
          <Text style={styles.setNum}>{s.setNumber}</Text>
          <Text style={styles.setText}>
            {s.durationS != null
              ? `${s.durationS} s`
              : `${s.weightKg != null ? `${s.weightKg} kg` : 'bodyweight'} × ${s.reps}`}
            {s.rpe != null ? `  @rpe ${s.rpe}` : ''}
          </Text>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Pressable onPress={() => removeSet(s.id)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textFaint} />
          </Pressable>
        </View>
      ))}

      <View style={styles.inputRow}>
        {isDuration ? (
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="60"
              placeholderTextColor={colors.textFaint}
            />
            <Text style={styles.unit}>s</Text>
          </View>
        ) : (
          <>
            {!isBodyweight && (
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  placeholder="kg"
                  placeholderTextColor={colors.textFaint}
                />
                <Text style={styles.unit}>kg</Text>
              </View>
            )}
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                value={reps}
                onChangeText={setReps}
                keyboardType="numeric"
                placeholder="reps"
                placeholderTextColor={colors.textFaint}
              />
              <Text style={styles.unit}>reps</Text>
            </View>
          </>
        )}
        <Pressable
          onPress={logSet}
          style={[styles.logBtn, !valid && { opacity: 0.4 }]}
          disabled={!valid}
        >
          <Ionicons name="add" size={18} color={colors.onAccent} />
          <Text style={styles.logBtnText}>Log set</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2.5),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  name: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 16,
  },
  hint: {
    color: colors.fat,
    fontFamily: font.medium,
    fontSize: 12,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
  },
  setNum: {
    color: colors.textFaint,
    fontFamily: font.bold,
    fontSize: 13,
    width: 18,
    textAlign: 'center',
  },
  setText: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2.5),
    flex: 1,
  },
  input: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
    paddingVertical: spacing(2),
    flex: 1,
    textAlign: 'center',
  },
  unit: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 12,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  logBtnText: {
    color: colors.onAccent,
    fontFamily: font.bold,
    fontSize: 13,
  },
});

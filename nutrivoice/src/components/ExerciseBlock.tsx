import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { suggestNextWeight } from '../lib/workoutMath';
import { Exercise, SetType, WorkoutSet } from '../lib/workoutTypes';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { colors, font, radius, spacing } from '../theme';
import { Muted } from './ui';
import { PlateCalculator } from './PlateCalculator';

const DEFAULT_REST_S = 90;

const TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const TYPE_BADGE: Record<Exclude<SetType, 'normal'>, { label: string; color: string }> = {
  warmup: { label: 'W', color: colors.fat },
  drop: { label: 'D', color: colors.carbs },
  failure: { label: 'F', color: colors.danger },
};

/**
 * One exercise inside the active workout: an editable grid of sets (weight,
 * reps, RPE, set type), per-row previous-session ghosts, a deterministic
 * progression hint, plate calculator, and a reorder/replace/remove menu.
 */
export function ExerciseBlock({
  exercise,
  sets,
  lastSessionSets,
  historySessions,
  canMoveUp,
  canMoveDown,
  onReplace,
}: {
  exercise: Exercise;
  sets: WorkoutSet[];
  lastSessionSets: WorkoutSet[];
  historySessions: WorkoutSet[][];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onReplace: () => void;
}) {
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removePlanned = useWorkoutStore((s) => s.removePlanned);
  const moveExercise = useWorkoutStore((s) => s.moveExercise);
  const setRestEndsAt = useWorkoutStore((s) => s.setRestEndsAt);

  const [menuOpen, setMenuOpen] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);

  const isDuration = exercise.load_type === 'duration';
  const isBodyweight = exercise.load_type === 'bodyweight_reps';

  const lastLogged = sets[sets.length - 1];
  const lastPrev = lastSessionSets[lastSessionSets.length - 1];

  const suggestion =
    !isDuration && !isBodyweight && historySessions.length >= 1 && lastPrev?.reps != null
      ? suggestNextWeight(exercise, historySessions, lastPrev.reps)
      : null;

  const addAnotherSet = () => {
    const seedW = lastLogged?.weightKg ?? lastPrev?.weightKg ?? suggestion?.weightKg ?? null;
    const seedR = lastLogged?.reps ?? lastPrev?.reps ?? null;
    const seedD = lastLogged?.durationS ?? lastPrev?.durationS ?? null;
    addSet({
      exerciseId: exercise.id,
      weightKg: isDuration || isBodyweight ? null : seedW,
      reps: isDuration ? null : seedR,
      durationS: isDuration ? seedD : null,
    });
    setRestEndsAt(Date.now() + DEFAULT_REST_S * 1000);
  };

  const menuAction = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => router.push(`/exercise/${exercise.id}` as Parameters<typeof router.push>[0])}
        >
          <Text style={styles.name}>{exercise.name}</Text>
          <Muted style={{ fontSize: 11, textTransform: 'capitalize' }}>
            {exercise.primary_muscle.replace('_', ' ')} · {exercise.equipment}
          </Muted>
        </Pressable>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {suggestion && sets.length === 0 && (
        <Text style={styles.hint}>
          {suggestion.action === 'increase' ? '↑' : suggestion.action === 'deload' ? '↓' : '→'}{' '}
          {suggestion.reason}
        </Text>
      )}

      {/* column headers */}
      <View style={styles.gridHead}>
        <Text style={[styles.hSet]}>Set</Text>
        <Text style={[styles.hPrev]}>Prev</Text>
        {isDuration ? (
          <Text style={styles.hCol}>Secs</Text>
        ) : (
          <>
            {!isBodyweight && <Text style={styles.hCol}>kg</Text>}
            <Text style={styles.hCol}>Reps</Text>
          </>
        )}
        <Text style={styles.hRpe}>RPE</Text>
        <View style={{ width: 22 }} />
      </View>

      {sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          ordinal={i + 1}
          prev={lastSessionSets[i]}
          isDuration={isDuration}
          isBodyweight={isBodyweight}
          onUpdate={(patch) => updateSet(s.id, patch)}
          onRemove={() => removeSet(s.id)}
        />
      ))}

      <View style={styles.actions}>
        <Pressable onPress={addAnotherSet} style={styles.addSet}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.addSetText}>Add set</Text>
        </Pressable>
        {!isDuration && !isBodyweight && (
          <Pressable onPress={() => setPlateOpen(true)} style={styles.plateBtn}>
            <Text style={styles.plateBtnText}>🏋 Plates</Text>
          </Pressable>
        )}
      </View>

      <PlateCalculator
        visible={plateOpen}
        initialKg={lastLogged?.weightKg ?? lastPrev?.weightKg ?? null}
        onClose={() => setPlateOpen(false)}
      />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <MenuItem
              icon="stats-chart-outline"
              label="View history & records"
              onPress={() =>
                menuAction(() =>
                  router.push(`/exercise/${exercise.id}` as Parameters<typeof router.push>[0]),
                )
              }
            />
            {canMoveUp && (
              <MenuItem icon="arrow-up-outline" label="Move up" onPress={() => menuAction(() => moveExercise(exercise.id, -1))} />
            )}
            {canMoveDown && (
              <MenuItem icon="arrow-down-outline" label="Move down" onPress={() => menuAction(() => moveExercise(exercise.id, 1))} />
            )}
            <MenuItem icon="swap-horizontal-outline" label="Replace exercise" onPress={() => menuAction(onReplace)} />
            {!isDuration && !isBodyweight && (
              <MenuItem icon="calculator-outline" label="Plate calculator" onPress={() => menuAction(() => setPlateOpen(true))} />
            )}
            <MenuItem
              icon="trash-outline"
              label="Remove exercise"
              danger
              onPress={() =>
                menuAction(() => {
                  for (const s of sets) removeSet(s.id);
                  removePlanned(exercise.id);
                })
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.menuItemText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function SetRow({
  set,
  ordinal,
  prev,
  isDuration,
  isBodyweight,
  onUpdate,
  onRemove,
}: {
  set: WorkoutSet;
  ordinal: number;
  prev?: WorkoutSet;
  isDuration: boolean;
  isBodyweight: boolean;
  onUpdate: (patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationS' | 'rpe' | 'setType'>>) => void;
  onRemove: () => void;
}) {
  const [weight, setWeight] = useState(set.weightKg != null ? String(set.weightKg) : '');
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '');
  const [rpe, setRpe] = useState(set.rpe != null ? String(set.rpe) : '');
  const [duration, setDuration] = useState(set.durationS != null ? String(set.durationS) : '');

  const cycleType = () => {
    const next = TYPE_CYCLE[(TYPE_CYCLE.indexOf(set.setType) + 1) % TYPE_CYCLE.length];
    onUpdate({ setType: next });
  };

  const commitWeight = () => {
    const n = Number(weight);
    onUpdate({ weightKg: weight.trim() === '' || !(n >= 0) ? null : n });
  };
  const commitReps = () => {
    const n = Math.round(Number(reps));
    onUpdate({ reps: reps.trim() === '' || !(n >= 0) ? null : n });
  };
  const commitRpe = () => {
    const n = Number(rpe);
    onUpdate({ rpe: rpe.trim() === '' || !(n >= 1 && n <= 10) ? null : n });
  };
  const commitDuration = () => {
    const n = Math.round(Number(duration));
    onUpdate({ durationS: duration.trim() === '' || !(n >= 0) ? null : n });
  };

  const badge = set.setType === 'normal' ? null : TYPE_BADGE[set.setType];
  const prevText = prev
    ? prev.durationS != null
      ? `${prev.durationS}s`
      : `${prev.weightKg ?? 'bw'}×${prev.reps ?? '-'}`
    : '–';

  return (
    <View style={styles.row}>
      <Pressable onPress={cycleType} style={styles.setCell} hitSlop={6}>
        <Text style={[styles.setNum, badge && { color: badge.color }]}>{badge ? badge.label : ordinal}</Text>
      </Pressable>
      <Text style={styles.prevCell} numberOfLines={1}>
        {prevText}
      </Text>

      {isDuration ? (
        <Cell value={duration} onChangeText={setDuration} onBlur={commitDuration} placeholder="60" />
      ) : (
        <>
          {!isBodyweight && (
            <Cell value={weight} onChangeText={setWeight} onBlur={commitWeight} placeholder="–" />
          )}
          <Cell value={reps} onChangeText={setReps} onBlur={commitReps} placeholder="–" />
        </>
      )}
      <Cell value={rpe} onChangeText={setRpe} onBlur={commitRpe} placeholder="–" narrow />

      <Pressable onPress={onRemove} hitSlop={6} style={{ width: 22, alignItems: 'center' }}>
        <Ionicons name="close" size={15} color={colors.textFaint} />
      </Pressable>
    </View>
  );
}

function Cell({
  value,
  onChangeText,
  onBlur,
  placeholder,
  narrow,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onBlur: () => void;
  placeholder: string;
  narrow?: boolean;
}) {
  return (
    <TextInput
      style={[styles.cell, narrow && styles.cellNarrow]}
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onBlur}
      onBlur={onBlur}
      keyboardType="numeric"
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      selectTextOnFocus
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  name: { color: colors.text, fontFamily: font.bold, fontSize: 16 },
  menuBtn: { padding: spacing(1) },
  hint: { color: colors.fat, fontFamily: font.medium, fontSize: 12 },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(1) },
  hSet: { width: 30, color: colors.textFaint, fontFamily: font.semibold, fontSize: 11 },
  hPrev: { width: 52, color: colors.textFaint, fontFamily: font.semibold, fontSize: 11 },
  hCol: { flex: 1, textAlign: 'center', color: colors.textFaint, fontFamily: font.semibold, fontSize: 11 },
  hRpe: { width: 44, textAlign: 'center', color: colors.textFaint, fontFamily: font.semibold, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  setCell: { width: 30, alignItems: 'center' },
  setNum: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  prevCell: { width: 52, color: colors.textFaint, fontFamily: font.regular, fontSize: 11, fontVariant: ['tabular-nums'] },
  cell: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
    paddingVertical: spacing(2),
    textAlign: 'center',
  },
  cellNarrow: { width: 44, flex: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5), marginTop: spacing(1) },
  addSet: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2.5),
  },
  addSetText: { color: colors.accent, fontFamily: font.bold, fontSize: 13 },
  plateBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  plateBtnText: { color: colors.textMuted, fontFamily: font.semibold, fontSize: 13 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing(6) },
  menuSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3.5),
    borderRadius: radius.md,
  },
  menuItemText: { color: colors.text, fontFamily: font.semibold, fontSize: 15 },
});

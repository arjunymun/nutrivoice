import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { setDoneHaptic, tapHaptic } from '../lib/haptics';
import { suggestNextWeight } from '../lib/workoutMath';
import { Exercise, SetType, WorkoutSet } from '../lib/workoutTypes';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { colors, font, radius, spacing } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './motion';
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
 * A set row the user hasn't completed yet. Lives only in component state —
 * checking it off is what creates the real (synced) WorkoutSet, so the store
 * never sees half-finished rows and crash recovery stays trivial.
 */
interface PendingRow {
  key: string;
  weight: string;
  reps: string;
  rpe: string;
  duration: string;
  setType: SetType;
}

let pendingKey = 0;
const newPending = (setType: SetType = 'normal'): PendingRow => ({
  key: `p${++pendingKey}`,
  weight: '',
  reps: '',
  rpe: '',
  duration: '',
  setType,
});

/**
 * One exercise inside the active workout, Hevy-flow: planned sets appear as
 * unchecked rows prefilled from last session (ghost placeholders — checking a
 * row with empty inputs adopts them); the check button logs the set, tints the
 * row green, fires the rest timer. Tapping a green check un-logs back to pending.
 */
export function ExerciseBlock({
  exercise,
  sets,
  lastSessionSets,
  historySessions,
  targetSets,
  targetReps,
  targetWeightKg,
  canMoveUp,
  canMoveDown,
  onReplace,
}: {
  exercise: Exercise;
  sets: WorkoutSet[];
  lastSessionSets: WorkoutSet[];
  historySessions: WorkoutSet[][];
  targetSets: number;
  targetReps: number | null;
  targetWeightKg: number | null;
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

  // Seed pending rows once: whatever the plan still owes beyond already-logged sets.
  const [pending, setPending] = useState<PendingRow[]>(() =>
    Array.from({ length: Math.max(targetSets - sets.length, sets.length === 0 ? 1 : 0) }, () =>
      newPending(),
    ),
  );

  // Sets can also be created outside checkRow (voice/typed logging in the
  // session header). Consume untouched pending rows for those external adds so
  // the plan doesn't keep showing work that's already been logged.
  const prevSetsLen = useRef(sets.length);
  const checkAdds = useRef(0);
  useEffect(() => {
    const delta = sets.length - prevSetsLen.current;
    prevSetsLen.current = sets.length;
    const external = delta - checkAdds.current;
    checkAdds.current = 0;
    if (external <= 0) return;
    setPending((p) => {
      let toDrop = external;
      const out: PendingRow[] = [];
      for (const row of p) {
        const untouched =
          !row.weight && !row.reps && !row.rpe && !row.duration && row.setType === 'normal';
        if (toDrop > 0 && untouched) {
          toDrop--;
          continue;
        }
        out.push(row);
      }
      return out;
    });
  }, [sets.length]);

  const lastLogged = sets[sets.length - 1];
  const lastPrev = lastSessionSets[lastSessionSets.length - 1];

  const suggestion =
    !isDuration && !isBodyweight && historySessions.length >= 1 && (lastPrev?.reps ?? targetReps) != null
      ? suggestNextWeight(exercise, historySessions, (lastPrev?.reps ?? targetReps)!)
      : null;

  /** Ghost values a pending row adopts when checked with empty inputs. */
  const ghostFor = (rowIndex: number) => {
    const prev = lastSessionSets[rowIndex] ?? lastPrev;
    return {
      weight:
        lastLogged?.weightKg ??
        prev?.weightKg ??
        suggestion?.weightKg ??
        targetWeightKg ??
        null,
      reps: lastLogged?.reps ?? prev?.reps ?? targetReps ?? null,
      duration: lastLogged?.durationS ?? prev?.durationS ?? 60,
    };
  };

  const checkRow = (row: PendingRow, rowIndex: number) => {
    const ghost = ghostFor(sets.length + rowIndex);
    const w = row.weight.trim() !== '' ? Number(row.weight) : ghost.weight;
    const r = row.reps.trim() !== '' ? Math.round(Number(row.reps)) : ghost.reps;
    const d = row.duration.trim() !== '' ? Math.round(Number(row.duration)) : ghost.duration;
    const rpe = row.rpe.trim() !== '' ? Number(row.rpe) : null;

    if (isDuration) {
      if (!(d != null && d > 0 && d <= 7200)) return;
    } else {
      if (!(r != null && r > 0 && r <= 100)) return;
      if (!isBodyweight && !(w != null && w > 0 && w <= 600)) return;
    }

    checkAdds.current++;
    addSet({
      exerciseId: exercise.id,
      weightKg: isDuration || isBodyweight ? null : w,
      reps: isDuration ? null : r,
      durationS: isDuration ? d : null,
      rpe: rpe != null && rpe >= 1 && rpe <= 10 ? rpe : null,
      setType: row.setType,
    });
    setPending((p) => p.filter((x) => x.key !== row.key));
    setDoneHaptic();
    setRestEndsAt(Date.now() + DEFAULT_REST_S * 1000, DEFAULT_REST_S);
  };

  const uncheckSet = (s: WorkoutSet) => {
    removeSet(s.id);
    // put its values back as an editable pending row at the front of the queue
    setPending((p) => [
      {
        key: `p${++pendingKey}`,
        weight: s.weightKg != null ? String(s.weightKg) : '',
        reps: s.reps != null ? String(s.reps) : '',
        rpe: s.rpe != null ? String(s.rpe) : '',
        duration: s.durationS != null ? String(s.durationS) : '',
        setType: s.setType,
      },
      ...p,
    ]);
    tapHaptic();
  };

  const menuAction = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  // For actions that unmount this block (remove) or present another Modal
  // (plate calc): wait out the menu sheet's exit animation first — otherwise
  // the sheet is torn down in one frame / iOS drops the second Modal.
  const menuActionAfterExit = (fn: () => void) => {
    setMenuOpen(false);
    setTimeout(fn, 260);
  };

  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.card}>
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
        <PressableScale onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.menuBtn} haptic>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </PressableScale>
      </View>

      {suggestion && sets.length === 0 && (
        <Text style={styles.hint}>
          {suggestion.action === 'increase' ? '↑' : suggestion.action === 'deload' ? '↓' : '→'}{' '}
          {suggestion.reason}
        </Text>
      )}

      {/* column headers */}
      <View style={styles.gridHead}>
        <Text style={styles.hSet}>Set</Text>
        <Text style={styles.hPrev}>Prev</Text>
        {isDuration ? (
          <Text style={styles.hCol}>Secs</Text>
        ) : (
          <>
            {!isBodyweight && <Text style={styles.hCol}>kg</Text>}
            <Text style={styles.hCol}>Reps</Text>
          </>
        )}
        <Text style={styles.hRpe}>RPE</Text>
        <View style={{ width: 34 }} />
      </View>

      {sets.map((s, i) => (
        <LoggedRow
          key={s.id}
          set={s}
          ordinal={i + 1}
          prev={lastSessionSets[i]}
          isDuration={isDuration}
          isBodyweight={isBodyweight}
          onUpdate={(patch) => updateSet(s.id, patch)}
          onUncheck={() => uncheckSet(s)}
        />
      ))}

      {pending.map((row, i) => {
        const ghost = ghostFor(sets.length + i);
        return (
          <PendingRowView
            key={row.key}
            row={row}
            ordinal={sets.length + i + 1}
            prev={lastSessionSets[sets.length + i]}
            ghost={ghost}
            isDuration={isDuration}
            isBodyweight={isBodyweight}
            onChange={(patch) =>
              setPending((p) => p.map((x) => (x.key === row.key ? { ...x, ...patch } : x)))
            }
            onCycleType={() => {
              tapHaptic();
              setPending((p) =>
                p.map((x) =>
                  x.key === row.key
                    ? { ...x, setType: TYPE_CYCLE[(TYPE_CYCLE.indexOf(x.setType) + 1) % TYPE_CYCLE.length] }
                    : x,
                ),
              );
            }}
            onCheck={() => checkRow(row, i)}
            onRemove={() => setPending((p) => p.filter((x) => x.key !== row.key))}
          />
        );
      })}

      <View style={styles.actions}>
        <PressableScale onPress={() => setPending((p) => [...p, newPending()])} style={styles.addSet}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.addSetText}>Add set</Text>
        </PressableScale>
        {!isDuration && !isBodyweight && (
          <PressableScale onPress={() => setPlateOpen(true)} style={styles.plateBtn}>
            <Text style={styles.plateBtnText}>🏋 Plates</Text>
          </PressableScale>
        )}
      </View>

      <PlateCalculator
        visible={plateOpen}
        initialKg={lastLogged?.weightKg ?? lastPrev?.weightKg ?? null}
        onClose={() => setPlateOpen(false)}
      />

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Text style={styles.menuTitle}>{exercise.name}</Text>
        <MenuItem
          icon="stats-chart-outline"
          label="History & records"
          onPress={() =>
            menuAction(() => router.push(`/exercise/${exercise.id}` as Parameters<typeof router.push>[0]))
          }
        />
        {canMoveUp && (
          <MenuItem icon="arrow-up-outline" label="Move up" onPress={() => menuAction(() => moveExercise(exercise.id, -1))} />
        )}
        {canMoveDown && (
          <MenuItem icon="arrow-down-outline" label="Move down" onPress={() => menuAction(() => moveExercise(exercise.id, 1))} />
        )}
        {sets.length === 0 && (
          // Replace = swap a planned slot. Once sets are logged the old
          // exercise would just reappear (it has data) — hide instead.
          <MenuItem icon="swap-horizontal-outline" label="Replace exercise" onPress={() => menuAction(onReplace)} />
        )}
        {!isDuration && !isBodyweight && (
          <MenuItem icon="calculator-outline" label="Plate calculator" onPress={() => menuActionAfterExit(() => setPlateOpen(true))} />
        )}
        <MenuItem
          icon="trash-outline"
          label="Remove exercise"
          danger
          onPress={() =>
            menuActionAfterExit(() => {
              for (const s of sets) removeSet(s.id);
              removePlanned(exercise.id);
            })
          }
        />
      </BottomSheet>
    </Animated.View>
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
    <PressableScale style={styles.menuItem} onPress={onPress} scaleTo={0.98}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.menuItemText, danger && { color: colors.danger }]}>{label}</Text>
    </PressableScale>
  );
}

/** A completed (logged, synced) set: green check, still editable inline. */
function LoggedRow({
  set,
  ordinal,
  prev,
  isDuration,
  isBodyweight,
  onUpdate,
  onUncheck,
}: {
  set: WorkoutSet;
  ordinal: number;
  prev?: WorkoutSet;
  isDuration: boolean;
  isBodyweight: boolean;
  onUpdate: (patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationS' | 'rpe' | 'setType'>>) => void;
  onUncheck: () => void;
}) {
  const [weight, setWeight] = useState(set.weightKg != null ? String(set.weightKg) : '');
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '');
  const [rpe, setRpe] = useState(set.rpe != null ? String(set.rpe) : '');
  const [duration, setDuration] = useState(set.durationS != null ? String(set.durationS) : '');

  const cycleType = () => {
    tapHaptic();
    onUpdate({ setType: TYPE_CYCLE[(TYPE_CYCLE.indexOf(set.setType) + 1) % TYPE_CYCLE.length] });
  };

  const badge = set.setType === 'normal' ? null : TYPE_BADGE[set.setType];
  const prevText = prev
    ? prev.durationS != null
      ? `${prev.durationS}s`
      : `${prev.weightKg ?? 'bw'}×${prev.reps ?? '-'}`
    : '–';

  return (
    <Animated.View entering={FadeInDown.duration(180)} style={[styles.row, styles.rowDone]}>
      <Pressable onPress={cycleType} style={styles.setCell} hitSlop={6}>
        <Text style={[styles.setNum, badge && { color: badge.color }]}>{badge ? badge.label : ordinal}</Text>
      </Pressable>
      <Text style={styles.prevCell} numberOfLines={1}>
        {prevText}
      </Text>

      {/* Inline edits use checkRow's bounds; empty/invalid input reverts to the
          stored value rather than writing 0 or garbage into volume/PR math. */}
      {isDuration ? (
        <Cell
          value={duration}
          onChangeText={setDuration}
          onBlur={() => {
            const n = Math.round(Number(duration));
            if (duration.trim() === '' || !(n > 0 && n <= 7200)) {
              setDuration(set.durationS != null ? String(set.durationS) : '');
              return;
            }
            onUpdate({ durationS: n });
          }}
          placeholder="60"
        />
      ) : (
        <>
          {!isBodyweight && (
            <Cell
              value={weight}
              onChangeText={setWeight}
              onBlur={() => {
                const n = Number(weight);
                if (weight.trim() === '' || !(n > 0 && n <= 600)) {
                  setWeight(set.weightKg != null ? String(set.weightKg) : '');
                  return;
                }
                onUpdate({ weightKg: n });
              }}
              placeholder="–"
            />
          )}
          <Cell
            value={reps}
            onChangeText={setReps}
            onBlur={() => {
              const n = Math.round(Number(reps));
              if (reps.trim() === '' || !(n > 0 && n <= 100)) {
                setReps(set.reps != null ? String(set.reps) : '');
                return;
              }
              onUpdate({ reps: n });
            }}
            placeholder="–"
          />
        </>
      )}
      <Cell
        value={rpe}
        onChangeText={setRpe}
        onBlur={() => {
          if (rpe.trim() === '') {
            onUpdate({ rpe: null }); // RPE is optional — clearing it is valid
            return;
          }
          const n = Number(rpe);
          if (!(n >= 1 && n <= 10)) {
            setRpe(set.rpe != null ? String(set.rpe) : '');
            return;
          }
          onUpdate({ rpe: n });
        }}
        placeholder="–"
        narrow
      />

      <PressableScale onPress={onUncheck} hitSlop={4} style={[styles.check, styles.checkDone]} scaleTo={0.85}>
        <Ionicons name="checkmark" size={16} color={colors.onAccent} />
      </PressableScale>
    </Animated.View>
  );
}

/** A planned-but-not-done set: ghost placeholders, hollow check to complete. */
function PendingRowView({
  row,
  ordinal,
  prev,
  ghost,
  isDuration,
  isBodyweight,
  onChange,
  onCycleType,
  onCheck,
  onRemove,
}: {
  row: PendingRow;
  ordinal: number;
  prev?: WorkoutSet;
  ghost: { weight: number | null; reps: number | null; duration: number | null };
  isDuration: boolean;
  isBodyweight: boolean;
  onChange: (patch: Partial<PendingRow>) => void;
  onCycleType: () => void;
  onCheck: () => void;
  onRemove: () => void;
}) {
  const badge = row.setType === 'normal' ? null : TYPE_BADGE[row.setType];
  const prevText = prev
    ? prev.durationS != null
      ? `${prev.durationS}s`
      : `${prev.weightKg ?? 'bw'}×${prev.reps ?? '-'}`
    : '–';

  // Checking with empty inputs adopts the ghost — but only if the ghost can
  // actually make a valid set; otherwise the check stays disabled.
  const checkable = isDuration
    ? row.duration.trim() !== '' || ghost.duration != null
    : (row.reps.trim() !== '' || ghost.reps != null) &&
      (isBodyweight || row.weight.trim() !== '' || ghost.weight != null);

  return (
    <Animated.View entering={FadeInDown.duration(180)} style={styles.row}>
      <Pressable onPress={onCycleType} style={styles.setCell} hitSlop={6}>
        <Text style={[styles.setNum, { color: badge ? badge.color : colors.textFaint }]}>
          {badge ? badge.label : ordinal}
        </Text>
      </Pressable>
      <Text style={styles.prevCell} numberOfLines={1}>
        {prevText}
      </Text>

      {isDuration ? (
        <Cell
          value={row.duration}
          onChangeText={(t) => onChange({ duration: t })}
          placeholder={ghost.duration != null ? String(ghost.duration) : '60'}
        />
      ) : (
        <>
          {!isBodyweight && (
            <Cell
              value={row.weight}
              onChangeText={(t) => onChange({ weight: t })}
              placeholder={ghost.weight != null ? String(ghost.weight) : '–'}
            />
          )}
          <Cell
            value={row.reps}
            onChangeText={(t) => onChange({ reps: t })}
            placeholder={ghost.reps != null ? String(ghost.reps) : '–'}
          />
        </>
      )}
      <Cell value={row.rpe} onChangeText={(t) => onChange({ rpe: t })} placeholder="–" narrow />

      <View style={styles.trailing}>
        <PressableScale
          onPress={onCheck}
          hitSlop={4}
          style={[styles.check, !checkable && { opacity: 0.3 }]}
          scaleTo={0.85}
          disabled={!checkable}
        >
          <Ionicons name="checkmark" size={16} color={colors.textMuted} />
        </PressableScale>
        <Pressable onPress={onRemove} hitSlop={6}>
          <Ionicons name="close" size={13} color={colors.textFaint} />
        </Pressable>
      </View>
    </Animated.View>
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
  onBlur?: () => void;
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
  hPrev: { width: 50, color: colors.textFaint, fontFamily: font.semibold, fontSize: 11 },
  hCol: { flex: 1, textAlign: 'center', color: colors.textFaint, fontFamily: font.semibold, fontSize: 11 },
  hRpe: { width: 40, textAlign: 'center', color: colors.textFaint, fontFamily: font.semibold, fontSize: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    borderRadius: radius.sm,
    marginHorizontal: -spacing(1),
    paddingHorizontal: spacing(1),
    paddingVertical: 1,
  },
  rowDone: { backgroundColor: 'rgba(62, 213, 152, 0.07)' },
  setCell: { width: 30, alignItems: 'center' },
  setNum: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  prevCell: { width: 50, color: colors.textFaint, fontFamily: font.regular, fontSize: 11, fontVariant: ['tabular-nums'] },
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
  cellNarrow: { width: 40, flex: 0 },
  trailing: { width: 34, flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
    marginLeft: spacing(1),
  },
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
  menuTitle: { color: colors.text, fontFamily: font.bold, fontSize: 17, marginBottom: spacing(1) },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(3),
    borderRadius: radius.md,
  },
  menuItemText: { color: colors.text, fontFamily: font.semibold, fontSize: 15 },
});

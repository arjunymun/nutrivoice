import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { ExerciseBlock } from '@/components/ExerciseBlock';
import { ExercisePicker } from '@/components/ExercisePicker';
import { GymSettingsSheet } from '@/components/GymSettingsSheet';
import { PressableScale } from '@/components/motion';
import { RestTimer } from '@/components/RestTimer';
import { Card, GhostButton, Muted, PrimaryButton, SectionTitle } from '@/components/ui';
import { VoiceButton } from '@/components/VoiceButton';
import { successHaptic } from '@/lib/haptics';
import exercisesJson from '@/data/exercises.json';
import { generateRoutines, GeneratedRoutine } from '@/lib/coach';
import { parseGymText } from '@/lib/gymParser';
import { isSpeechAvailable, SpeechSession, startListening } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { toDateKey } from '@/lib/types';
import { formatVolume } from '@/lib/units';
import { detectPrs, workoutSetCount, workoutVolume } from '@/lib/workoutMath';
import { Exercise, Routine, WorkoutSet } from '@/lib/workoutTypes';
import { useGymSettingsStore } from '@/stores/useGymSettingsStore';
import { exercisePool, setsForWorkout, useWorkoutStore } from '@/stores/useWorkoutStore';
import { colors, font, radius, spacing } from '@/theme';

const EXERCISE_DB = exercisesJson as Exercise[];

function useElapsed(startedAt: string | null): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return '0:00';
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return `${Math.floor(m / 60) > 0 ? `${Math.floor(m / 60)}:` : ''}${String(m % 60).padStart(Math.floor(m / 60) > 0 ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Train() {
  // Selector-per-field, NOT `useWorkoutStore()`: the selector-less whole-store
  // subscription goes stale under the React Compiler (store updates stop
  // re-rendering this tree) — bitten in production, do not regress.
  const workouts = useWorkoutStore((s) => s.workouts);
  const allSets = useWorkoutStore((s) => s.sets);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const activeWorkoutId = useWorkoutStore((s) => s.activeWorkoutId);
  const plannedList = useWorkoutStore((s) => s.planned);
  const addPlannedFn = useWorkoutStore((s) => s.addPlanned);
  const replaceExerciseFn = useWorkoutStore((s) => s.replaceExercise);
  const startWorkoutFn = useWorkoutStore((s) => s.startWorkout);
  const finishWorkoutFn = useWorkoutStore((s) => s.finishWorkout);
  const discardActiveWorkoutFn = useWorkoutStore((s) => s.discardActiveWorkout);

  const pool = useMemo(() => exercisePool(EXERCISE_DB, customExercises), [customExercises]);

  const active = activeWorkoutId
    ? workouts.find((w) => w.id === activeWorkoutId && !w.deleted) ?? null
    : null;
  const activeSets = active ? setsForWorkout(allSets, active.id) : [];
  const elapsed = useElapsed(active?.startedAt ?? null);

  const weightUnit = useGymSettingsStore((s) => s.weightUnit);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  // `summary` is never nulled on close — the sheet's 220ms exit animation
  // still renders it, and nulling would collapse the stats to zeros mid-exit.
  // `summaryOpen` alone drives visibility; `finishCount` seeds confetti so
  // each burst's particle layout differs.
  const [summary, setSummary] = useState<{ volume: number; sets: number; prs: number } | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const finishCount = useRef(0);
  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = (msg: string) => {
    setBanner(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 3000);
  };
  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  // stale in-progress workout from a previous day → offer resume/discard.
  // `resumedId` lets the user override staleness and jump back into the session.
  const [resumedId, setResumedId] = useState<string | null>(null);
  const staleActive =
    active != null &&
    active.id !== resumedId &&
    Date.now() - new Date(active.startedAt).getTime() > 12 * 3600 * 1000;

  // exercises shown: planned ∪ ones that already have sets
  const blockExerciseIds = useMemo(() => {
    const ids = plannedList.map((p) => p.exerciseId);
    for (const s of activeSets) if (!ids.includes(s.exerciseId)) ids.push(s.exerciseId);
    return ids;
  }, [plannedList, activeSets]);

  const finishedWorkouts = useMemo(
    () =>
      workouts
        .filter((w) => !w.deleted && w.durationS != null)
        .sort((a, b) => (a.startedAt > b.startedAt ? -1 : 1)),
    [workouts],
  );

  const sessionsFor = (exerciseId: string) =>
    finishedWorkouts
      .map((w) => setsForWorkout(allSets, w.id).filter((s) => s.exerciseId === exerciseId && !s.isWarmup))
      .filter((sets) => sets.length > 0)
      .reverse(); // oldest → newest for progression logic

  const finish = () => {
    if (!active) return;
    const volume = workoutVolume(activeSets);
    const sets = workoutSetCount(activeSets);
    const prs = detectPrs(allSets, workouts, active.id).length;
    finishWorkoutFn();
    finishCount.current++;
    setSummary({ volume, sets, prs });
    setSummaryOpen(true);
    successHaptic();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {banner && (
          <View style={styles.banner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.onAccent} />
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        )}

        {active && !staleActive ? (
          <ActiveWorkout
            elapsed={elapsed}
            name={active.name}
            blocks={blockExerciseIds
              .map((id) => pool.find((e) => e.id === id))
              .filter((e): e is Exercise => !!e)}
            activeSets={activeSets}
            sessionsFor={sessionsFor}
            pool={pool}
            onAddExercise={() => {
              setReplaceTargetId(null);
              setPickerOpen(true);
            }}
            onReplaceExercise={(id) => {
              setReplaceTargetId(id);
              setPickerOpen(true);
            }}
            onFinish={finish}
            onDiscard={() => discardActiveWorkoutFn()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          <IdleView
            pool={pool}
            staleActive={staleActive}
            onResumeStale={() => {
              setResumedId(active?.id ?? null);
              showBanner('Resumed workout');
            }}
            onDiscardStale={() => discardActiveWorkoutFn()}
            finishedWorkouts={finishedWorkouts}
            showBanner={showBanner}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </ScrollView>

      <View style={styles.timerDock} pointerEvents="box-none">
        <RestTimer />
      </View>

      <ExercisePicker
        visible={pickerOpen}
        pool={pool}
        onClose={() => {
          setPickerOpen(false);
          setReplaceTargetId(null);
        }}
        onPick={(e) => {
          if (replaceTargetId) replaceExerciseFn(replaceTargetId, e.id);
          else addPlannedFn(e.id);
          setPickerOpen(false);
          setReplaceTargetId(null);
        }}
      />

      <BottomSheet visible={summaryOpen} onClose={() => setSummaryOpen(false)}>
        {/* NOTE: no `entering` animations in sheet content — reanimated entering
            presets never fire inside a web portal (Modal), leaving elements
            frozen at their invisible from-state. The sheet's own spring is the
            entrance; confetti animates via shared values, which do work here. */}
        <View style={{ overflow: 'hidden' }}>
          <Text style={styles.summaryTitle}>
            {summary && summary.prs > 0 ? '🏆 Workout done!' : 'Workout done 💪'}
          </Text>
          <View style={styles.summaryRow}>
            <SummaryStat label="Volume" value={formatVolume(summary?.volume ?? 0, weightUnit)} />
            <SummaryStat label="Sets" value={String(summary?.sets ?? 0)} />
            <SummaryStat label="PRs" value={(summary?.prs ?? 0) > 0 ? `🏆 ${summary!.prs}` : '—'} />
          </View>
          {/* confetti flies within the sheet, over the stats */}
          <ConfettiBurst burst={summaryOpen && summary && summary.prs > 0 ? finishCount.current : 0} />
        </View>
        <PrimaryButton title="Done" onPress={() => setSummaryOpen(false)} />
      </BottomSheet>

      <GymSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

// ---------------- active session ----------------

function ActiveWorkout({
  elapsed,
  name,
  blocks,
  activeSets,
  sessionsFor,
  pool,
  onAddExercise,
  onReplaceExercise,
  onFinish,
  onDiscard,
  onOpenSettings,
}: {
  elapsed: string;
  name: string;
  blocks: Exercise[];
  activeSets: ReturnType<typeof setsForWorkout>;
  sessionsFor: (exerciseId: string) => ReturnType<typeof setsForWorkout>[];
  pool: Exercise[];
  onAddExercise: () => void;
  onReplaceExercise: (exerciseId: string) => void;
  onFinish: () => void;
  onDiscard: () => void;
  onOpenSettings: () => void;
}) {
  const addSet = useWorkoutStore((s) => s.addSet);
  const addPlanned = useWorkoutStore((s) => s.addPlanned);
  const planned = useWorkoutStore((s) => s.planned);
  const weightUnit = useGymSettingsStore((s) => s.weightUnit);
  const [typed, setTyped] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const session = useRef<SpeechSession | null>(null);
  const speechOk = isSpeechAvailable();

  const logFromText = (text: string) => {
    setVoiceError(null);
    const groups = parseGymText(text, pool, { defaultUnit: weightUnit });
    if (!groups.length) {
      setVoiceError('Nothing understood. Try “bench 3x8 at 60”.');
      return;
    }
    let logged = 0;
    const misses: string[] = [];
    for (const g of groups) {
      if (!g.exercise) {
        misses.push(g.raw);
        continue;
      }
      addPlanned(g.exercise.id);
      for (let i = 0; i < g.sets; i++) {
        addSet({
          exerciseId: g.exercise.id,
          weightKg: g.weightKg,
          reps: g.reps,
          durationS: g.durationS,
          rpe: g.rpe,
        });
        logged++;
      }
    }
    if (misses.length) setVoiceError(`Didn't recognize: ${misses.join(' · ')}`);
    if (logged) setTyped('');
  };

  const toggleVoice = async () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    setVoiceError(null);
    setListening(true);
    session.current = await startListening({
      onPartial: setTyped,
      onFinal: (text) => {
        setTyped(text);
        logFromText(text);
      },
      onError: (m) => {
        setVoiceError(m);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (!session.current) setListening(false);
  };

  return (
    <View style={{ gap: spacing(3.5) }}>
      <View style={styles.activeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.elapsed}>{elapsed}</Text>
        </View>
        <PressableScale onPress={onOpenSettings} style={styles.settingsBtn} haptic>
          <Ionicons name="options-outline" size={18} color={colors.textMuted} />
        </PressableScale>
        <PressableScale onPress={onFinish} style={styles.finishBtn} haptic scaleTo={0.94}>
          <Text style={styles.finishText}>Finish</Text>
        </PressableScale>
      </View>

      <View style={styles.voiceRow}>
        {speechOk && <VoiceButton listening={listening} onPress={toggleVoice} size={46} />}
        <TextInput
          style={styles.typeInput}
          placeholder="squats 5x5 at 100, bench 3x8 60…"
          placeholderTextColor={colors.textFaint}
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => logFromText(typed)}
          returnKeyType="done"
        />
        <Pressable style={styles.parseBtn} onPress={() => logFromText(typed)}>
          <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
      {voiceError && <Text style={styles.error}>{voiceError}</Text>}

      {blocks.map((e, i) => {
        const history = sessionsFor(e.id);
        const plan = planned.find((p) => p.exerciseId === e.id);
        return (
          <ExerciseBlock
            key={e.id}
            exercise={e}
            sets={activeSets.filter((s) => s.exerciseId === e.id)}
            lastSessionSets={history[history.length - 1] ?? []}
            historySessions={history.slice(-3)}
            targetSets={plan?.targetSets ?? 3}
            targetReps={plan?.targetReps ?? null}
            targetWeightKg={plan?.targetWeightKg ?? null}
            canMoveUp={i > 0}
            canMoveDown={i < blocks.length - 1}
            onReplace={() => onReplaceExercise(e.id)}
          />
        );
      })}

      <GhostButton title="+ Add exercise" onPress={onAddExercise} />
      <GhostButton title="Discard workout" danger onPress={onDiscard} />
    </View>
  );
}

// ---------------- idle view ----------------

function IdleView({
  pool,
  staleActive,
  onResumeStale,
  onDiscardStale,
  finishedWorkouts,
  showBanner,
  onOpenSettings,
}: {
  pool: Exercise[];
  staleActive: boolean;
  onResumeStale: () => void;
  onDiscardStale: () => void;
  finishedWorkouts: ReturnType<typeof useWorkoutStore.getState>['workouts'];
  showBanner: (m: string) => void;
  onOpenSettings: () => void;
}) {
  // Selectors only — see the note in Train() about the React Compiler.
  const routines = useWorkoutStore((s) => s.routines);
  const idleSets = useWorkoutStore((s) => s.sets);
  const weightUnit = useGymSettingsStore((s) => s.weightUnit);
  const startWorkoutFn = useWorkoutStore((s) => s.startWorkout);
  const removeRoutineFn = useWorkoutStore((s) => s.removeRoutine);
  const addRoutineFn = useWorkoutStore((s) => s.addRoutine);
  const [aiGoal, setAiGoal] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<GeneratedRoutine[] | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  const startFromRoutine = (r: Routine) => {
    startWorkoutFn(
      r.name,
      r.items.map((i) => ({
        exerciseId: i.exerciseId,
        targetSets: i.sets,
        targetReps: i.reps,
        targetWeightKg: i.weightKg,
      })),
    );
  };

  // Re-run a past session as a template: same exercises/order, targets seeded
  // from that day's working sets (last set's weight × reps).
  const repeatWorkout = (w: ReturnType<typeof useWorkoutStore.getState>['workouts'][number]) => {
    const sets = setsForWorkout(useWorkoutStore.getState().sets, w.id).filter((s) => !s.isWarmup);
    const order: string[] = [];
    const byEx = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      if (!byEx.has(s.exerciseId)) {
        byEx.set(s.exerciseId, []);
        order.push(s.exerciseId);
      }
      byEx.get(s.exerciseId)!.push(s);
    }
    const planned = order.map((id) => {
      const ss = byEx.get(id)!;
      const last = ss[ss.length - 1];
      return { exerciseId: id, targetSets: ss.length, targetReps: last.reps, targetWeightKg: last.weightKg };
    });
    startWorkoutFn(w.name, planned);
  };

  const runCoach = async () => {
    if (!aiGoal.trim()) return;
    setAiLoading(true);
    setAiNote(null);
    const res = await generateRoutines(aiGoal, pool);
    setAiLoading(false);
    setAiResult(res.routines);
    setAiNote(
      res.fallback
        ? 'AI unavailable — showing a proven starter template instead.'
        : `Generated by free AI (${res.provider}). Review and save what you like.`,
    );
  };

  const liveRoutines = routines.filter((r) => !r.deleted);

  return (
    <View style={{ gap: spacing(3.5) }}>
      <AppHeader
        title="Train"
        actions={[
          { icon: 'options-outline', onPress: onOpenSettings, accessibilityLabel: 'Training settings' },
        ]}
      />

      {staleActive && (
        <Card style={{ gap: spacing(3), borderColor: colors.fat }}>
          <SectionTitle>Unfinished workout found</SectionTitle>
          <Muted>You have a workout still open from a while ago.</Muted>
          <PrimaryButton title="Resume it" onPress={onResumeStale} />
          <GhostButton title="Discard it" danger onPress={onDiscardStale} />
        </Card>
      )}

      <PrimaryButton title="Start empty workout" onPress={() => startWorkoutFn('Workout')} />

      <Card style={{ gap: spacing(3) }}>
        <SectionTitle>Routines</SectionTitle>
        {liveRoutines.length === 0 && (
          <Muted>No routines yet — generate one with AI below, or start empty and save later.</Muted>
        )}
        {liveRoutines.map((r) => (
          <View key={r.id} style={styles.routineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routineName}>{r.name}</Text>
              <Muted style={{ fontSize: 12 }}>
                {r.items
                  .map((i) => pool.find((e) => e.id === i.exerciseId)?.name ?? i.exerciseId)
                  .slice(0, 4)
                  .join(' · ')}
                {r.items.length > 4 ? ` +${r.items.length - 4}` : ''}
              </Muted>
            </View>
            <Pressable onPress={() => startFromRoutine(r)} style={styles.startChip}>
              <Text style={styles.startChipText}>Start</Text>
            </Pressable>
            <Pressable onPress={() => removeRoutineFn(r.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}
      </Card>

      <Card style={{ gap: spacing(3) }}>
        <SectionTitle>✨ AI routine builder</SectionTitle>
        <Muted style={{ fontSize: 13 }}>
          Describe your goal — “3-day split for muscle, dumbbells only”, “beginner full body at
          home”. Free AI, any equipment.
        </Muted>
        <TextInput
          style={styles.aiInput}
          placeholder="your goal…"
          placeholderTextColor={colors.textFaint}
          value={aiGoal}
          onChangeText={setAiGoal}
        />
        {signedIn ? (
          aiLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing(2) }}>
              <ActivityIndicator color={colors.accent} />
              <Muted style={{ fontSize: 13 }}>Building your program… (~15 s on the free model)</Muted>
            </View>
          ) : (
            <PrimaryButton title="Generate routines" onPress={runCoach} disabled={!aiGoal.trim()} />
          )
        ) : (
          <Muted style={{ fontSize: 12 }}>Sign in (Profile tab) to use the AI builder.</Muted>
        )}
        {aiNote && <Muted style={{ fontSize: 12 }}>{aiNote}</Muted>}
        {aiResult?.map((r, i) => (
          <View key={`${r.name}-${i}`} style={styles.genRoutine}>
            <Text style={styles.routineName}>{r.name}</Text>
            {r.items.map((it) => (
              <Muted key={it.exerciseId} style={{ fontSize: 13 }}>
                • {pool.find((e) => e.id === it.exerciseId)?.name ?? it.exerciseId} — {it.sets}×
                {it.reps}
              </Muted>
            ))}
            {r.unmatched.length > 0 && (
              <Muted style={{ fontSize: 11 }}>couldn’t map: {r.unmatched.join(', ')}</Muted>
            )}
            <PrimaryButton
              title="Save routine"
              onPress={() => {
                addRoutineFn(r.name, r.items);
                setAiResult(aiResult.filter((_, j) => j !== i));
                showBanner(`Saved “${r.name}”`);
              }}
            />
          </View>
        ))}
      </Card>

      <Card style={{ gap: spacing(2.5) }}>
        <SectionTitle>History</SectionTitle>
        {finishedWorkouts.length === 0 && <Muted>No workouts yet.</Muted>}
        {finishedWorkouts.slice(0, 8).map((w) => {
          // subscribed `idleSets`, not getState() — render-time getState reads
          // don't re-render when sets change
          const sets = setsForWorkout(idleSets, w.id);
          return (
            <View key={w.id} style={styles.historyRow}>
              <Pressable
                style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.6 }]}
                onPress={() => router.push(`/workout/${w.id}` as Parameters<typeof router.push>[0])}
              >
                <Text style={styles.routineName}>{w.name}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {toDateKey(new Date(w.startedAt))} · {Math.round((w.durationS ?? 0) / 60)} min ·{' '}
                  {workoutSetCount(sets)} sets · {formatVolume(workoutVolume(sets), weightUnit)}
                </Muted>
              </Pressable>
              <Pressable
                onPress={() => {
                  repeatWorkout(w);
                  showBanner(`Started “${w.name}” again`);
                }}
                hitSlop={8}
                style={styles.repeatChip}
              >
                <Ionicons name="refresh" size={13} color={colors.onAccent} />
                <Text style={styles.repeatChipText}>Repeat</Text>
              </Pressable>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: spacing(4),
    gap: spacing(3.5),
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing(20),
  },
  title: { color: colors.text, fontFamily: font.extrabold, fontSize: 24 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  bannerText: { color: colors.onAccent, fontFamily: font.semibold, fontSize: 14 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  elapsed: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(2.5),
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing(2),
  },
  finishText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 14 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  typeInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
  },
  parseBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    alignSelf: 'stretch',
  },
  error: { color: colors.danger, fontFamily: font.regular, fontSize: 13 },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  routineName: { color: colors.text, fontFamily: font.semibold, fontSize: 15 },
  startChip: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(1.5),
  },
  startChipText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 13 },
  genRoutine: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
    gap: spacing(2),
  },
  aiInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  repeatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  repeatChipText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 12 },
  timerDock: {
    position: 'absolute',
    bottom: spacing(4),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  summaryTitle: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 22,
    textAlign: 'center',
  },
  summaryRow: { flexDirection: 'row', gap: spacing(3) },
  summaryValue: { color: colors.accent, fontFamily: font.extrabold, fontSize: 20 },
});

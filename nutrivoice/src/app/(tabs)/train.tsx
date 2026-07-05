import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseBlock } from '@/components/ExerciseBlock';
import { ExercisePicker } from '@/components/ExercisePicker';
import { RestTimer } from '@/components/RestTimer';
import { Card, GhostButton, Muted, PrimaryButton, SectionTitle } from '@/components/ui';
import { VoiceButton } from '@/components/VoiceButton';
import exercisesJson from '@/data/exercises.json';
import { generateRoutines, GeneratedRoutine } from '@/lib/coach';
import { parseGymText } from '@/lib/gymParser';
import { isSpeechAvailable, SpeechSession, startListening } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { toDateKey } from '@/lib/types';
import { detectPrs, workoutSetCount, workoutVolume } from '@/lib/workoutMath';
import { Exercise, Routine } from '@/lib/workoutTypes';
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
  const store = useWorkoutStore();
  const pool = useMemo(
    () => exercisePool(EXERCISE_DB, store.customExercises),
    [store.customExercises],
  );

  const active = store.activeWorkoutId
    ? store.workouts.find((w) => w.id === store.activeWorkoutId && !w.deleted) ?? null
    : null;
  const activeSets = active ? setsForWorkout(store.sets, active.id) : [];
  const elapsed = useElapsed(active?.startedAt ?? null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [summary, setSummary] = useState<{ volume: number; sets: number; prs: number } | null>(null);
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
    const ids = store.planned.map((p) => p.exerciseId);
    for (const s of activeSets) if (!ids.includes(s.exerciseId)) ids.push(s.exerciseId);
    return ids;
  }, [store.planned, activeSets]);

  const finishedWorkouts = useMemo(
    () =>
      store.workouts
        .filter((w) => !w.deleted && w.durationS != null)
        .sort((a, b) => (a.startedAt > b.startedAt ? -1 : 1)),
    [store.workouts],
  );

  const sessionsFor = (exerciseId: string) =>
    finishedWorkouts
      .map((w) => setsForWorkout(store.sets, w.id).filter((s) => s.exerciseId === exerciseId && !s.isWarmup))
      .filter((sets) => sets.length > 0)
      .reverse(); // oldest → newest for progression logic

  const finish = () => {
    if (!active) return;
    const volume = workoutVolume(activeSets);
    const sets = workoutSetCount(activeSets);
    const prs = detectPrs(store.sets, store.workouts, active.id).length;
    store.finishWorkout();
    setSummary({ volume, sets, prs });
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
            onAddExercise={() => setPickerOpen(true)}
            onFinish={finish}
            onDiscard={() => store.discardActiveWorkout()}
          />
        ) : (
          <IdleView
            pool={pool}
            staleActive={staleActive}
            onResumeStale={() => {
              setResumedId(active?.id ?? null);
              showBanner('Resumed workout');
            }}
            onDiscardStale={() => store.discardActiveWorkout()}
            finishedWorkouts={finishedWorkouts}
            showBanner={showBanner}
          />
        )}
      </ScrollView>

      <View style={styles.timerDock} pointerEvents="box-none">
        <RestTimer />
      </View>

      {pickerOpen && (
        <ExercisePicker
          pool={pool}
          onClose={() => setPickerOpen(false)}
          onPick={(e) => {
            store.addPlanned(e.id);
            setPickerOpen(false);
          }}
        />
      )}

      {summary && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSummary(null)}>
          <View style={styles.backdrop}>
            <View style={styles.summarySheet}>
              <Text style={styles.summaryTitle}>Workout done 💪</Text>
              <View style={styles.summaryRow}>
                <SummaryStat label="Volume" value={`${summary.volume.toLocaleString()} kg`} />
                <SummaryStat label="Sets" value={String(summary.sets)} />
                <SummaryStat label="PRs" value={summary.prs > 0 ? `🏆 ${summary.prs}` : '—'} />
              </View>
              <PrimaryButton title="Done" onPress={() => setSummary(null)} />
            </View>
          </View>
        </Modal>
      )}
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
  onFinish,
  onDiscard,
}: {
  elapsed: string;
  name: string;
  blocks: Exercise[];
  activeSets: ReturnType<typeof setsForWorkout>;
  sessionsFor: (exerciseId: string) => ReturnType<typeof setsForWorkout>[];
  pool: Exercise[];
  onAddExercise: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const addSet = useWorkoutStore((s) => s.addSet);
  const addPlanned = useWorkoutStore((s) => s.addPlanned);
  const [typed, setTyped] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const session = useRef<SpeechSession | null>(null);
  const speechOk = isSpeechAvailable();

  const logFromText = (text: string) => {
    setVoiceError(null);
    const groups = parseGymText(text, pool);
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
        <View>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.elapsed}>{elapsed}</Text>
        </View>
        <Pressable onPress={onFinish} style={styles.finishBtn}>
          <Text style={styles.finishText}>Finish</Text>
        </Pressable>
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

      {blocks.map((e) => {
        const history = sessionsFor(e.id);
        return (
          <ExerciseBlock
            key={e.id}
            exercise={e}
            sets={activeSets.filter((s) => s.exerciseId === e.id)}
            lastSessionSets={history[history.length - 1] ?? []}
            historySessions={history.slice(-3)}
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
}: {
  pool: Exercise[];
  staleActive: boolean;
  onResumeStale: () => void;
  onDiscardStale: () => void;
  finishedWorkouts: ReturnType<typeof useWorkoutStore.getState>['workouts'];
  showBanner: (m: string) => void;
}) {
  const store = useWorkoutStore();
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
    store.startWorkout(
      r.name,
      r.items.map((i) => ({
        exerciseId: i.exerciseId,
        targetSets: i.sets,
        targetReps: i.reps,
        targetWeightKg: i.weightKg,
      })),
    );
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

  const liveRoutines = store.routines.filter((r) => !r.deleted);

  return (
    <View style={{ gap: spacing(3.5) }}>
      <Text style={styles.title}>Train</Text>

      {staleActive && (
        <Card style={{ gap: spacing(3), borderColor: colors.fat }}>
          <SectionTitle>Unfinished workout found</SectionTitle>
          <Muted>You have a workout still open from a while ago.</Muted>
          <PrimaryButton title="Resume it" onPress={onResumeStale} />
          <GhostButton title="Discard it" danger onPress={onDiscardStale} />
        </Card>
      )}

      <PrimaryButton title="Start empty workout" onPress={() => store.startWorkout('Workout')} />

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
            <Pressable onPress={() => store.removeRoutine(r.id)} hitSlop={8}>
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
                store.addRoutine(r.name, r.items);
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
          const sets = setsForWorkout(useWorkoutStore.getState().sets, w.id);
          return (
            <Pressable
              key={w.id}
              style={({ pressed }) => [styles.historyRow, pressed && { opacity: 0.6 }]}
              onPress={() => router.push(`/workout/${w.id}` as Parameters<typeof router.push>[0])}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.routineName}>{w.name}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {toDateKey(new Date(w.startedAt))} · {Math.round((w.durationS ?? 0) / 60)} min ·{' '}
                  {workoutSetCount(sets)} sets · {workoutVolume(sets).toLocaleString()} kg
                </Muted>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
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
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  timerDock: {
    position: 'absolute',
    bottom: spacing(4),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing(6),
  },
  summarySheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing(5),
    gap: spacing(4),
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

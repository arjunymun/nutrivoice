import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { successHaptic } from '../lib/haptics';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { colors, font, radius, spacing } from '../theme';
import { PressableScale } from './motion';

const DONE_AUTO_CLEAR_MS = 4000;
/** Last-stretch threshold where the pill starts pulsing for attention. */
const URGENT_S = 5;

/**
 * Rest timer driven purely by an end TIMESTAMP in the store (survives
 * background/relaunch; identical on web and native — no background tasks).
 * The interval only re-renders; all truth is `restEndsAt - Date.now()`.
 */
export function RestTimer() {
  const restEndsAt = useWorkoutStore((s) => s.restEndsAt);
  const restTotalS = useWorkoutStore((s) => s.restTotalS);
  const setRestEndsAt = useWorkoutStore((s) => s.setRestEndsAt);
  const [now, setNow] = useState(Date.now());

  // 0..1 fraction of rest remaining, drives the background fill width.
  const progress = useSharedValue(1);
  const pulse = useSharedValue(1);
  // Guards the one-shot success haptic; reset whenever a new/adjusted rest starts.
  const firedDoneRef = useRef(false);
  const prevEndsAtRef = useRef<number | null>(null);

  const remaining = restEndsAt == null ? 0 : Math.max(0, Math.ceil((restEndsAt - now) / 1000));
  const done = restEndsAt != null && remaining <= 0;
  const urgent = restEndsAt != null && !done && remaining <= URGENT_S;

  useEffect(() => {
    if (restEndsAt == null) return;
    // Resync immediately on (re)start/adjust — `now` may be a stale tick.
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 500);
    // Timestamp math means backgrounding costs nothing; just resync on return.
    const sub = AppState.addEventListener('change', () => setNow(Date.now()));
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [restEndsAt]);

  useEffect(() => {
    firedDoneRef.current = false;
  }, [restEndsAt]);

  useEffect(() => {
    if (restEndsAt == null) {
      prevEndsAtRef.current = null;
      return;
    }
    const frac = Math.min(1, Math.max(0, (restEndsAt - now) / (Math.max(restTotalS, 1) * 1000)));
    // Snap whenever the end timestamp itself changes (fresh timer OR a new rest
    // started mid-rest OR ±15 adjust) — never glide from the previous rest's
    // leftover fill. Between ticks of the SAME timer, glide linearly so the
    // fill moves continuously instead of stepping once a second.
    if (prevEndsAtRef.current !== restEndsAt) {
      progress.value = frac;
    } else {
      progress.value = withTiming(frac, { duration: 1000, easing: Easing.linear });
    }
    prevEndsAtRef.current = restEndsAt;
  }, [now, restEndsAt, restTotalS, progress]);

  useEffect(() => {
    if (urgent) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 320, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 150 });
    }
    return () => cancelAnimation(pulse);
  }, [urgent, pulse]);

  useEffect(() => {
    if (!done) return;
    if (!firedDoneRef.current) {
      firedDoneRef.current = true;
      successHaptic();
    }
    const clear = setTimeout(() => setRestEndsAt(null), DONE_AUTO_CLEAR_MS);
    return () => clearTimeout(clear);
  }, [done, setRestEndsAt]);

  // Template literals widen to `string`, which RN's DimensionValue rejects.
  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (restEndsAt == null) return null;

  const adjust = (deltaS: number) => {
    const nowMs = Date.now();
    // Clamp: end can't be in the past, total can't collapse below 5s
    // (progress math divides by it).
    setRestEndsAt(Math.max(nowMs, restEndsAt + deltaS * 1000), Math.max(5, restTotalS + deltaS));
  };

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(24)}
      style={[styles.pill, done && styles.pillDone, pulseStyle]}
    >
      {!done && <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />}

      {done ? (
        <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.row}>
          <Ionicons name="flash" size={18} color={colors.onAccent} />
          <Text style={styles.doneText}>Rest over — go!</Text>
          <View style={styles.flex} />
          <PressableScale haptic hitSlop={6} style={styles.iconBtn} onPress={() => setRestEndsAt(null)}>
            <Ionicons name="close" size={18} color={colors.onAccent} />
          </PressableScale>
        </Animated.View>
      ) : (
        <View style={styles.row}>
          <Ionicons name="timer-outline" size={18} color={colors.accent} />
          <Text style={[styles.time, urgent && styles.timeUrgent]}>
            {mm}:{ss}
          </Text>
          <View style={styles.flex} />
          <PressableScale haptic hitSlop={6} style={styles.adjustBtn} onPress={() => adjust(-15)}>
            <Text style={styles.adjustText}>−15</Text>
          </PressableScale>
          <PressableScale haptic hitSlop={6} style={styles.adjustBtn} onPress={() => adjust(15)}>
            <Text style={styles.adjustText}>+15</Text>
          </PressableScale>
          <PressableScale haptic hitSlop={6} style={styles.iconBtn} onPress={() => setRestEndsAt(null)}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </PressableScale>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 280,
    alignSelf: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  pillDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentDim,
    opacity: 0.25,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2.5),
  },
  flex: {
    flex: 1,
  },
  time: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  timeUrgent: {
    color: colors.accent,
  },
  doneText: {
    color: colors.onAccent,
    fontFamily: font.bold,
    fontSize: 15,
  },
  adjustBtn: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
  },
  adjustText: {
    color: colors.carbs,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  iconBtn: {
    padding: spacing(1),
  },
});

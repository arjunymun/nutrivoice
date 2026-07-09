import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useWorkoutStore } from '../stores/useWorkoutStore';
import { colors, font, radius, spacing } from '../theme';
import { PressableScale } from './motion';

/** m:ss under an hour, h:mm:ss above — matches the in-session timer format. */
function formatElapsed(totalS: number): string {
  const s = Math.max(0, totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Floating "workout in progress" pill shown above the tab bar while browsing
 * other tabs (the Hevy pattern). Elapsed time derives from the workout's
 * startedAt timestamp — never a counter — so it stays correct across
 * background/relaunch. Parent owns absolute positioning; we only render the pill.
 */
export function MiniWorkoutBar() {
  const activeWorkoutId = useWorkoutStore((s) => s.activeWorkoutId);
  const workouts = useWorkoutStore((s) => s.workouts);
  const sets = useWorkoutStore((s) => s.sets);
  const pathname = usePathname();

  const workout = activeWorkoutId ? workouts.find((w) => w.id === activeWorkoutId) : undefined;
  const visible = !!workout && !workout.deleted && !pathname.startsWith('/train');

  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    setNowTs(Date.now());
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    // Resync immediately on foreground so the elapsed label never shows stale time.
    const sub = AppState.addEventListener('change', () => setNowTs(Date.now()));
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [visible]);

  // One 0→1 phase drives both the dot breathe and the radar ring; the ring
  // fades to fully transparent before the loop snaps back, so the restart is invisible.
  const ping = useSharedValue(0);
  useEffect(() => {
    if (!visible) return;
    ping.value = 0;
    ping.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(ping);
  }, [visible, ping]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ping.value, [0, 0.5, 1], [1, 1.5, 1]) }],
    opacity: interpolate(ping.value, [0, 0.5, 1], [1, 0.65, 1]),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ping.value, [0, 1], [1, 3]) }],
    opacity: interpolate(ping.value, [0, 1], [0.5, 0]),
  }));

  if (!visible || !workout) return null;

  const setCount = sets.filter((s) => s.workoutId === activeWorkoutId && !s.deleted).length;
  const elapsedS = Math.floor((nowTs - new Date(workout.startedAt).getTime()) / 1000);

  return (
    // box-none: the wrap spans the full strip width — only the pill itself may
    // swallow touches, or content behind the strip becomes unclickable on web.
    <Animated.View entering={SlideInDown.springify().damping(22)} style={styles.wrap}>
      <PressableScale haptic style={styles.pill} onPress={() => router.push('/train')}>
        <View style={styles.dotWell}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.dot, dotStyle]} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={styles.meta}>
            {formatElapsed(elapsedS)} · {setCount} {setCount === 1 ? 'set' : 'sets'}
          </Text>
        </View>
        <View style={styles.resume}>
          <Text style={styles.resumeText}>Resume</Text>
          <Ionicons name="chevron-up" size={16} color={colors.accent} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Side insets live here as padding (not margins on the pill): width:'100%'
  // plus marginHorizontal overflows the parent on narrow screens in RN Web.
  wrap: {
    width: '100%',
    paddingHorizontal: spacing(4),
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.35)' } as object,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      },
    }),
  },
  dotWell: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
  },
  resumeText: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: 13,
  },
});

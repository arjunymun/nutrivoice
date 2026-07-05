import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { useWorkoutStore } from '../stores/useWorkoutStore';
import { colors, font, radius, spacing } from '../theme';

/**
 * Rest timer driven purely by an end TIMESTAMP in the store (survives
 * background/relaunch; identical on web and native — no background tasks).
 */
export function RestTimer() {
  const restEndsAt = useWorkoutStore((s) => s.restEndsAt);
  const setRestEndsAt = useWorkoutStore((s) => s.setRestEndsAt);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (restEndsAt == null) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', () => setNow(Date.now()));
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [restEndsAt]);

  if (restEndsAt == null) return null;

  const remaining = Math.ceil((restEndsAt - now) / 1000);
  const done = remaining <= 0;
  const mm = Math.floor(Math.max(remaining, 0) / 60);
  const ss = String(Math.max(remaining, 0) % 60).padStart(2, '0');

  return (
    <View style={[styles.wrap, done && styles.done]}>
      <Ionicons name="timer-outline" size={18} color={done ? colors.onAccent : colors.accent} />
      <Text style={[styles.time, done && { color: colors.onAccent }]}>
        {done ? 'Rest over — go!' : `${mm}:${ss}`}
      </Text>
      {!done && (
        <Pressable onPress={() => setRestEndsAt(restEndsAt + 30_000)} hitSlop={6}>
          <Text style={styles.adjust}>+30s</Text>
        </Pressable>
      )}
      <Pressable onPress={() => setRestEndsAt(null)} hitSlop={6}>
        <Ionicons name="close" size={18} color={done ? colors.onAccent : colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignSelf: 'center',
  },
  done: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  time: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  adjust: {
    color: colors.carbs,
    fontFamily: font.semibold,
    fontSize: 13,
  },
});

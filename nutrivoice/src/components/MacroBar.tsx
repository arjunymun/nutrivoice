import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '../theme';

export function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const ratio = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={{ flex: 1, gap: spacing(1.5) }}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.value}>
        {Math.round(value)}
        <Text style={styles.target}> / {Math.round(target)} g</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  value: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 14,
  },
  target: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 13,
  },
});

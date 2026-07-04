import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, font } from '../theme';

export function CalorieRing({
  consumed,
  target,
  size = 210,
}: {
  consumed: number;
  target: number;
  size?: number;
}) {
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const over = target > 0 && consumed > target;
  const remaining = Math.round(target - consumed);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.ringTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.danger : colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.big}>{Math.abs(remaining)}</Text>
      <Text style={styles.label}>{over ? 'kcal over' : 'kcal left'}</Text>
      <Text style={styles.sub}>
        {Math.round(consumed)} / {Math.round(target)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  big: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 52,
    lineHeight: 58,
  },
  label: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 14,
  },
  sub: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 13,
    marginTop: 2,
  },
});

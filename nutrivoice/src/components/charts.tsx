import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors, font, spacing } from '../theme';

/** Seven-day calorie bars with a target line. */
export function WeekBars({
  data,
  target,
  width,
  height = 160,
}: {
  data: { label: string; value: number }[];
  target: number;
  width: number;
  height?: number;
}) {
  const padTop = 16;
  const padBottom = 22;
  const chartH = height - padTop - padBottom;
  const max = Math.max(target * 1.15, ...data.map((d) => d.value), 1);
  const barW = Math.min(28, (width / Math.max(data.length, 1)) * 0.55);
  const step = width / Math.max(data.length, 1);
  const targetY = padTop + chartH * (1 - target / max);

  return (
    <View>
      <Svg width={width} height={height}>
        {target > 0 && (
          <Line
            x1={0}
            y1={targetY}
            x2={width}
            y2={targetY}
            stroke={colors.textFaint}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {data.map((d, i) => {
          const h = chartH * (d.value / max);
          const x = step * i + (step - barW) / 2;
          const over = target > 0 && d.value > target;
          return (
            <Rect
              key={i}
              x={x}
              y={padTop + chartH - h}
              width={barW}
              height={Math.max(h, d.value > 0 ? 3 : 0)}
              rx={6}
              fill={over ? colors.danger : colors.accent}
              opacity={d.value > 0 ? 1 : 0.25}
            />
          );
        })}
      </Svg>
      <View style={[styles.labels, { width }]}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.label, { width: step }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Simple line chart for weight trend. */
export function WeightLine({
  points,
  width,
  height = 140,
}: {
  points: { label: string; value: number }[];
  width: number;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.empty}>Log your weight to see the trend</Text>
      </View>
    );
  }

  const pad = 18;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const x = (i: number) => pad + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const y = (v: number) => pad + innerH * (1 - (v - min) / range);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        <Path d={path} stroke={colors.carbs} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill={colors.carbs} />
        ))}
      </Svg>
      <View style={styles.minMax}>
        <Text style={styles.label}>{min.toFixed(1)} kg</Text>
        <Text style={styles.label}>{max.toFixed(1)} kg</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    marginTop: -18,
  },
  label: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  minMax: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(2),
  },
  empty: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 13,
  },
});

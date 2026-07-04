import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { colors, font, radius, spacing } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        (disabled || loading) && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={styles.primaryBtnText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton({
  title,
  onPress,
  danger,
  style,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={[styles.ghostBtnText, danger && { color: colors.danger }]}>{title}</Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View style={styles.segmentWrap}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {labels?.[opt] ?? opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LabeledInput({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: spacing(1.5) }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      <Text style={[styles.chipText, active && { color: colors.onAccent, fontFamily: font.semibold }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flex: 1, gap: spacing(1) }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={[styles.muted, { fontSize: 12 }]}>{sub}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 17,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontFamily: font.bold,
    fontSize: 16,
  },
  ghostBtn: {
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  ghostBtnText: {
    color: colors.textMuted,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1),
    gap: spacing(1),
  },
  segment: {
    flex: 1,
    paddingVertical: spacing(2),
    borderRadius: radius.full,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  segmentTextActive: {
    color: colors.onAccent,
    fontFamily: font.bold,
  },
  inputLabel: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 16,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  chipText: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 13,
  },
  statValue: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 24,
  },
});

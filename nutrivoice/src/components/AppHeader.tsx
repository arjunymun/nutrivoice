import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '../theme';
import { PressableScale } from './motion';
import { Muted } from './ui';

export interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}

/**
 * Native-style screen header: large title left, round icon actions right —
 * the standard app pattern (vs a bare floating text title).
 */
export function AppHeader({
  title,
  subtitle,
  actions = [],
}: {
  title: string;
  subtitle?: string;
  actions?: HeaderAction[];
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Muted style={{ fontSize: 13 }}>{subtitle}</Muted>}
      </View>
      {actions.map((a) => (
        <PressableScale
          key={a.icon}
          onPress={a.onPress}
          style={styles.actionBtn}
          haptic
          accessibilityLabel={a.accessibilityLabel}
        >
          <Ionicons name={a.icon} size={19} color={colors.text} />
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
  },
  title: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

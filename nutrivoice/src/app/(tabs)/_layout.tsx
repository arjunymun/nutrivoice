import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniWorkoutBar } from '@/components/MiniWorkoutBar';
import { colors, font, radius } from '@/theme';

/**
 * Native-app tab icon: filled glyph inside a soft accent pill when focused,
 * outline glyph when not — the standard mobile pattern (default web-ish tab
 * bars are the #1 "this is a webpage" tell).
 */
function TabIcon({
  name,
  focused,
}: {
  name: 'flame' | 'add-circle' | 'barbell' | 'stats-chart' | 'person';
  focused: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: focused ? 'rgba(200, 241, 53, 0.16)' : 'transparent',
      }}
    >
      <Ionicons
        name={focused ? name : (`${name}-outline` as const)}
        size={21}
        color={focused ? colors.accent : colors.textFaint}
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingTop: 6,
          // Float above the scene with a real shadow, not a hairline border.
          ...Platform.select({
            web: { boxShadow: '0 -6px 24px rgba(0,0,0,0.45)' } as object,
            default: {
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: -6 },
              elevation: 16,
            },
          }),
        },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 10, marginTop: 2 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon name="flame" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ focused }) => <TabIcon name="add-circle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="train"
        options={{
          title: 'Train',
          tabBarIcon: ({ focused }) => <TabIcon name="barbell" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon name="stats-chart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tabs>
    {/* Hevy-style: live workout follows you to other tabs; tap to jump back. */}
    <View
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 68 }}
      pointerEvents="box-none"
    >
      <MiniWorkoutBar />
    </View>
    </View>
  );
}

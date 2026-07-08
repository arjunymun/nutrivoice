import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';

import { tapHaptic } from '../lib/haptics';

/**
 * Shared motion language. Every animated surface in the app uses these spring
 * configs so the whole product moves with one personality (snappy, no wobble).
 */
export const springs = {
  /** Press feedback, toggles — fast, no overshoot. */
  snappy: { damping: 20, stiffness: 320, mass: 0.6 } satisfies WithSpringConfig,
  /** Sheets, bars sliding in — a touch of life but settles quickly. */
  gentle: { damping: 24, stiffness: 240, mass: 0.9 } satisfies WithSpringConfig,
  /** Celebration pops — visible overshoot. */
  bouncy: { damping: 12, stiffness: 260, mass: 0.7 } satisfies WithSpringConfig,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable with the native-app "give": scales down while pressed, springs
 * back on release. Optional light haptic on press-in.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = false,
  onPressIn,
  onPressOut,
  ...props
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, springs.snappy);
        if (haptic) tapHaptic();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.snappy);
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

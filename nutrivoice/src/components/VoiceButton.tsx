import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme';

export function VoiceButton({
  listening,
  onPress,
  size = 84,
}: {
  listening: boolean;
  onPress: () => void;
  size?: number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (listening) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.25,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [listening, pulse]);

  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.halo,
          {
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: (size * 1.35) / 2,
            opacity: listening ? 0.25 : 0,
            transform: [{ scale: pulse }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: listening ? colors.danger : colors.accent,
          },
        ]}
      >
        <Ionicons name={listening ? 'stop' : 'mic'} size={size * 0.42} color={colors.onAccent} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    backgroundColor: colors.accent,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

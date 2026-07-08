import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

const PARTICLE_COUNT = 26;
// Longest possible particle life (max up + max fall) plus a small buffer,
// after which the whole overlay unmounts so no invisible views linger.
const BURST_LIFE_MS = 1450;

const PALETTE = [colors.accent, colors.protein, colors.carbs, colors.fat, colors.success];

interface ParticleParams {
  color: string;
  offsetX: number; // launch offset from container center
  targetX: number; // final horizontal drift
  upDist: number;
  upDur: number;
  fallDist: number;
  fallDur: number;
  rotateTo: number;
  fadeDelay: number;
}

// Deterministic pseudo-random in [0, 1) from (index, burst, salt). Keeps each
// burst's particle layout stable across re-renders (no Math.random in render
// or worklets) while still looking different from the previous burst.
function seeded(i: number, burst: number, salt: number): number {
  const x = Math.sin(i * 127.1 + burst * 311.7 + salt * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeParams(i: number, burst: number): ParticleParams {
  const r = (salt: number) => seeded(i, burst, salt);
  return {
    color: PALETTE[i % PALETTE.length],
    offsetX: (r(1) - 0.5) * 60,
    targetX: (r(2) - 0.5) * 300,
    upDist: 40 + r(3) * 90,
    upDur: 280 + r(4) * 100,
    fallDist: 260 + r(5) * 160,
    fallDur: 700 + r(6) * 250,
    rotateTo: (r(7) > 0.5 ? 1 : -1) * (360 + r(8) * 360),
    fadeDelay: 550 + r(9) * 100,
  };
}

function Particle({ p }: { p: ParticleParams }) {
  const tx = useSharedValue(p.offsetX);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const life = p.upDur + p.fallDur;
    // Pop up fast (ease-out), then gravity takes over (ease-in) — the
    // two-phase sequence reads as a real toss rather than a linear slide.
    ty.value = withSequence(
      withTiming(-p.upDist, { duration: p.upDur, easing: Easing.out(Easing.quad) }),
      withTiming(p.fallDist, { duration: p.fallDur, easing: Easing.in(Easing.quad) }),
    );
    // Horizontal drift decelerates over the full life, like air resistance.
    tx.value = withTiming(p.targetX, { duration: life, easing: Easing.out(Easing.cubic) });
    rot.value = withTiming(p.rotateTo, { duration: life, easing: Easing.linear });
    opacity.value = withDelay(p.fadeDelay, withTiming(0, { duration: 350 }));
    // Runs once per mount: the parent remounts particles via key per burst,
    // which is what restarts the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return <Animated.View style={[styles.particle, { backgroundColor: p.color }, animatedStyle]} />;
}

export function ConfettiBurst({ burst }: { burst: number }) {
  const [visible, setVisible] = useState(false);

  // Unmount everything once the slowest particle has faded, so a stale burst
  // never leaves 26 invisible animated views in the tree.
  useEffect(() => {
    if (burst === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), BURST_LIFE_MS);
    return () => clearTimeout(timer);
  }, [burst]);

  const particles = useMemo(
    () => (burst === 0 ? [] : Array.from({ length: PARTICLE_COUNT }, (_, i) => makeParams(i, burst))),
    [burst],
  );

  if (burst === 0 || !visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        // Remounting on every burst is intentional: fresh mounts restart the
        // one-shot animations without imperative reset plumbing.
        <Particle key={`${burst}-${i}`} p={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 32,
    left: '50%',
    width: 9,
    height: 5,
    borderRadius: 2,
  },
});

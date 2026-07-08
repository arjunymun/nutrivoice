import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, spacing } from '../theme';
import { springs } from './motion';

/** Far enough to clear the tallest sheet on any phone before unmount. */
const SHEET_TRAVEL = 600;
const BACKDROP_IN_MS = 180;
const EXIT_MS = 220;

/**
 * App-wide animated bottom sheet (replaces centered modals). The RN Modal is
 * only a portal — transparent, no system animation — so enter/exit motion is
 * fully ours and consistent across web and native.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeightPct = 0.85,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPct?: number;
}) {
  // Mount state lags `visible` on the way out so the exit animation can play
  // before the Modal unmounts.
  const [rendered, setRendered] = useState(visible);
  const insets = useSafeAreaInsets();
  const backdrop = useSharedValue(0);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const closing = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single dismiss entry point (backdrop, drag, back button). The guard stops
  // a second gesture during the exit animation from calling onClose again.
  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      closing.current = false;
      setRendered(true);
      backdrop.value = withTiming(1, { duration: BACKDROP_IN_MS });
      // No position reset: a fresh mount starts at SHEET_TRAVEL, and reopening
      // mid-exit springs back from wherever the sheet currently is.
      translateY.value = withSpring(0, springs.gentle);
    } else {
      // Parent may flip `visible` without going through requestClose
      // (programmatic close) — block user dismissal during the exit too.
      closing.current = true;
      backdrop.value = withTiming(0, { duration: EXIT_MS });
      translateY.value = withTiming(SHEET_TRAVEL, { duration: EXIT_MS });
      exitTimer.current = setTimeout(() => {
        setRendered(false);
        exitTimer.current = null;
      }, EXIT_MS);
    }
  }, [visible, backdrop, translateY]);

  // Clear a pending unmount timer if the whole component goes away mid-exit.
  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    []
  );

  // Pan lives on the handle zone only — the sheet body must stay free for
  // scrollable children.
  const pan = Gesture.Pan()
    .onChange((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0, springs.gentle);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      {/* Gestures inside a native Modal need their own gesture-handler root. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close sheet" />
        </Animated.View>
        <KeyboardAvoidingView
          style={styles.positioner}
          // 'padding' on Android too: statusBarTranslucent disables the OS
          // adjustResize path, so KAV is the only thing lifting the sheet.
          behavior="padding"
        >
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              {
                maxHeight: `${maxHeightPct * 100}%` as const,
                // Keep sheet content above the home indicator / gesture bar.
                paddingBottom: spacing(5) + insets.bottom,
              },
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
            <View style={styles.content}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  positioner: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    // Empty space above the sheet must stay tappable as backdrop.
    pointerEvents: 'box-none',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(5),
    paddingTop: spacing(3),
  },
  handleZone: {
    // Generous hit area so the drag target is easy to grab without stealing
    // touches from the sheet body.
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.textFaint,
    opacity: 0.5,
  },
  content: {
    flexShrink: 1,
    gap: spacing(3.5),
  },
});

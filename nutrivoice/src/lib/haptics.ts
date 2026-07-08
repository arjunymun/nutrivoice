import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback, guarded for web (no-op there). Fire-and-forget — haptics
 * must never break an interaction, so every call swallows errors.
 */
const native = Platform.OS !== 'web';

/** Light tick — button presses, set-type cycling. */
export function tapHaptic() {
  if (!native) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium thunk — completing a set. */
export function setDoneHaptic() {
  if (!native) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success notification — finishing a workout, PRs, rest over. */
export function successHaptic() {
  if (!native) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning — destructive confirms. */
export function warnHaptic() {
  if (!native) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

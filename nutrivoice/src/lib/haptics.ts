import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useGymSettingsStore } from '../stores/useGymSettingsStore';

/**
 * Haptic feedback, guarded for web (no-op there) and user preference.
 * Fire-and-forget — haptics must never break an interaction, so every call
 * swallows errors.
 */
const enabled = () =>
  Platform.OS !== 'web' && useGymSettingsStore.getState().hapticsEnabled;

/** Light tick — button presses, set-type cycling. */
export function tapHaptic() {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium thunk — completing a set. */
export function setDoneHaptic() {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success notification — finishing a workout, PRs, rest over. */
export function successHaptic() {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning — destructive confirms. */
export function warnHaptic() {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

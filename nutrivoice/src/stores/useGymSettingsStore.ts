import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type WeightUnit = 'kg' | 'lb';

/**
 * Device-local training preferences (not synced — they describe THIS device's
 * gym and this user's display taste, like Hevy's settings screen).
 * All weights everywhere else in the app stay kg; the unit only changes the
 * display/input boundary.
 */
interface GymSettingsState {
  weightUnit: WeightUnit;
  /** Rest timer auto-started after checking a set. 0 = off. */
  defaultRestS: number;
  hapticsEnabled: boolean;
  setWeightUnit: (u: WeightUnit) => void;
  setDefaultRestS: (s: number) => void;
  setHapticsEnabled: (on: boolean) => void;
}

export const useGymSettingsStore = create<GymSettingsState>()(
  persist(
    (set) => ({
      weightUnit: 'kg',
      defaultRestS: 90,
      hapticsEnabled: true,
      setWeightUnit: (weightUnit) => set({ weightUnit }),
      setDefaultRestS: (defaultRestS) => set({ defaultRestS }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
    }),
    {
      name: 'nutrivoice-gym-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

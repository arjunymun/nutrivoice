import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { computeTargets } from '../lib/nutrition';
import { Profile } from '../lib/types';

interface ProfileState {
  onboarded: boolean;
  profile: Profile | null;
  /** True when local profile changed since last successful push. */
  dirty: boolean;
  completeOnboarding: (p: Omit<Profile, 'customTargets' | 'targetKcal' | 'targetProteinG' | 'targetCarbsG' | 'targetFatG' | 'updatedAt'>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setCustomTargets: (t: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null) => void;
  /** Replace local profile from a newer server copy (sync pull). */
  applyRemote: (p: Profile) => void;
  /** Clear dirty only if the profile wasn't edited while the push was in flight. */
  markPushed: (pushedUpdatedAt: string) => void;
  reset: () => void;
}

function withAutoTargets(p: Profile): Profile {
  if (p.customTargets) return p;
  const t = computeTargets(p);
  return { ...p, targetKcal: t.kcal, targetProteinG: t.proteinG, targetCarbsG: t.carbsG, targetFatG: t.fatG };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: null,
      dirty: false,

      completeOnboarding: (p) => {
        const profile = withAutoTargets({
          ...p,
          customTargets: false,
          targetKcal: 0,
          targetProteinG: 0,
          targetCarbsG: 0,
          targetFatG: 0,
          updatedAt: new Date().toISOString(),
        });
        set({ profile, onboarded: true, dirty: true });
      },

      updateProfile: (patch) => {
        const cur = get().profile;
        if (!cur) return;
        const profile = withAutoTargets({ ...cur, ...patch, updatedAt: new Date().toISOString() });
        set({ profile, dirty: true });
      },

      setCustomTargets: (t) => {
        const cur = get().profile;
        if (!cur) return;
        const next: Profile = t
          ? {
              ...cur,
              customTargets: true,
              targetKcal: t.kcal,
              targetProteinG: t.proteinG,
              targetCarbsG: t.carbsG,
              targetFatG: t.fatG,
              updatedAt: new Date().toISOString(),
            }
          : withAutoTargets({ ...cur, customTargets: false, updatedAt: new Date().toISOString() });
        set({ profile: next, dirty: true });
      },

      applyRemote: (p) => set({ profile: p, onboarded: true, dirty: false }),
      markPushed: (pushedUpdatedAt) => {
        if (get().profile?.updatedAt === pushedUpdatedAt) set({ dirty: false });
      },
      reset: () => set({ onboarded: false, profile: null, dirty: false }),
    }),
    {
      name: 'nutrivoice-profile',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

import { useEffect, useState } from 'react';

import { useSyncStore } from '../lib/sync';
import { useLogStore } from '../stores/useLogStore';
import { useProfileStore } from '../stores/useProfileStore';

/**
 * True once all persisted zustand stores have rehydrated from AsyncStorage.
 * Prevents redirect/UI flicker on cold start.
 */
export function useHydrated(): boolean {
  const stores = [useProfileStore, useLogStore, useSyncStore] as const;
  const [hydrated, setHydrated] = useState(() => stores.every((s) => s.persist.hasHydrated()));

  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (stores.every((s) => s.persist.hasHydrated())) setHydrated(true);
    };
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return hydrated;
}

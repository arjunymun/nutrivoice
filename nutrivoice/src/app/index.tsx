import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useHydrated } from '@/hooks/useHydrated';
import { useProfileStore } from '@/stores/useProfileStore';
import { colors } from '@/theme';

export default function Index() {
  const hydrated = useHydrated();
  const onboarded = useProfileStore((s) => s.onboarded);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <Redirect href={onboarded ? '/today' : '/onboarding'} />;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { SUPABASE_KEY, SUPABASE_URL } from './config';

if (Platform.OS !== 'web') {
  // Hermes lacks a full URL implementation; supabase-js needs it.
  require('react-native-url-polyfill/auto');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

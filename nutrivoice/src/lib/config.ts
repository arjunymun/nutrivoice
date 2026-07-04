/**
 * Supabase client configuration.
 *
 * These are PUBLIC client credentials (publishable key) — safe to ship in the
 * app bundle; row-level security protects all data. Override via env if you
 * point the app at your own Supabase project:
 *   EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://jqxqzhqzbiycjqjcllwd.supabase.co';

export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_EThOiUm9pZTeyEJ4UKc2qQ_xfJfI8VU';

export const colors = {
  bg: '#0B0D10',
  surface: '#14181E',
  surfaceAlt: '#1B2129',
  border: '#242C37',
  text: '#F2F5F9',
  textMuted: '#8B95A5',
  textFaint: '#5A6373',
  accent: '#C8F135',
  accentDim: '#87A61E',
  onAccent: '#131608',
  protein: '#FF7A6B',
  carbs: '#4DD6C1',
  fat: '#FFC94D',
  danger: '#FF5D5D',
  success: '#3ED598',
  ringTrack: '#1F2630',
};

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

export const macroColor = {
  protein: colors.protein,
  carbs: colors.carbs,
  fat: colors.fat,
} as const;

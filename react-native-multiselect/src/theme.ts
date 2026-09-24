import type { ColorSchemeName } from 'react-native';

export interface MultiSelectTheme {
  accent: string;
  accentSoft: string;
  onAccent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  highlight: string;
  backdrop: string;
  radius: number;
}

export const lightTheme: MultiSelectTheme = {
  accent: '#4F46E5',
  accentSoft: 'rgba(79, 70, 229, 0.08)',
  onAccent: '#FFFFFF',
  background: '#F6F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEDE8',
  border: 'rgba(20, 20, 30, 0.08)',
  text: '#16161D',
  textMuted: '#5E5E6B',
  textFaint: '#9A9AA6',
  highlight: 'rgba(79, 70, 229, 0.16)',
  backdrop: 'rgba(10, 10, 20, 0.45)',
  radius: 18,
};

export const darkTheme: MultiSelectTheme = {
  accent: '#8B85FF',
  accentSoft: 'rgba(139, 133, 255, 0.12)',
  onAccent: '#0E0E14',
  background: '#0E0E14',
  surface: '#17171F',
  surfaceAlt: '#23232E',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#F2F2F7',
  textMuted: '#A5A5B4',
  textFaint: '#6B6B7A',
  highlight: 'rgba(139, 133, 255, 0.28)',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  radius: 18,
};

export function resolveTheme(
  scheme: ColorSchemeName | null | undefined,
  overrides?: Partial<MultiSelectTheme>,
): MultiSelectTheme {
  const base = scheme === 'dark' ? darkTheme : lightTheme;
  return overrides ? { ...base, ...overrides } : base;
}

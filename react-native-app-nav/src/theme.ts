import type { ColorSchemeName } from 'react-native';

export interface NavTheme {
  /** Active indicator and primary button fill. */
  accent: string;
  /** Soft fill behind the active drawer item. */
  accentSoft: string;
  /** Text and icons on `accent`. */
  onAccent: string;
  /** Active label and icon colour on `accentSoft` and in the tab bar. */
  active: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  online: string;
  offline: string;
  danger: string;
  dangerSoft: string;
  badge: string;
  onBadge: string;
  backdrop: string;
  pressed: string;
  shadow: string;
}

export const lightTheme: NavTheme = {
  accent: '#FFC21A',
  accentSoft: '#FFF6DB',
  onAccent: '#1A1400',
  active: '#8A6100',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F7F9',
  border: 'rgba(20, 20, 30, 0.08)',
  text: '#16161D',
  textMuted: '#5E5E6B',
  textFaint: '#9A9AA6',
  online: '#16A366',
  offline: '#E5484D',
  danger: '#C62828',
  dangerSoft: '#FDE4E4',
  badge: '#E5484D',
  onBadge: '#FFFFFF',
  backdrop: 'rgba(10, 10, 20, 0.42)',
  pressed: 'rgba(20, 20, 30, 0.05)',
  shadow: '#0A0A14',
};

export const darkTheme: NavTheme = {
  accent: '#FFC933',
  accentSoft: 'rgba(255, 201, 51, 0.14)',
  onAccent: '#1A1400',
  active: '#FFD766',
  surface: '#1B1B24',
  surfaceAlt: '#23232E',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#F2F2F7',
  textMuted: '#A5A5B4',
  textFaint: '#6B6B7A',
  online: '#34C184',
  offline: '#FF6363',
  danger: '#FF8A8A',
  dangerSoft: 'rgba(255, 99, 99, 0.16)',
  badge: '#FF6363',
  onBadge: '#FFFFFF',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  pressed: 'rgba(255, 255, 255, 0.06)',
  shadow: '#000000',
};

export function resolveTheme(
  scheme: ColorSchemeName | null | undefined,
  overrides?: Partial<NavTheme>,
): NavTheme {
  const base = scheme === 'dark' ? darkTheme : lightTheme;
  return overrides ? { ...base, ...overrides } : base;
}

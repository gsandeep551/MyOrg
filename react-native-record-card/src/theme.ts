import type { ColorSchemeName } from 'react-native';

/** Semantic colour for badges, action icons and the card's attention state. */
export type Tone =
  | 'neutral'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple';

export interface ToneColors {
  /** Soft fill: badge background, icon tile. */
  soft: string;
  /** Foreground on `soft`, and the label colour of toned actions. */
  fg: string;
  /** Solid fill: attention edge and border, armed confirm icon. */
  solid: string;
  /** Faint fill for the header of a card flagged with this tone. */
  wash: string;
}

export interface RecordCardTheme {
  /** Primary button fill. */
  accent: string;
  onAccent: string;
  background: string;
  surface: string;
  /** Header and footer bands of the card. */
  surfaceAlt: string;
  /** Secondary button fill. */
  secondary: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** Amount text when `amountTone` is omitted. */
  amount: string;
  backdrop: string;
  pressed: string;
  radius: number;
  tones: Record<Tone, ToneColors>;
}

export const lightTheme: RecordCardTheme = {
  accent: '#FFC21A',
  onAccent: '#1A1400',
  background: '#F6F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FB',
  secondary: '#EEF1F6',
  border: 'rgba(20, 20, 30, 0.09)',
  text: '#16161D',
  textMuted: '#5E5E6B',
  textFaint: '#9A9AA6',
  amount: '#0B7A4B',
  backdrop: 'rgba(10, 10, 20, 0.45)',
  pressed: 'rgba(20, 20, 30, 0.05)',
  radius: 16,
  tones: {
    neutral: { soft: '#EEF0F3', fg: '#4B5160', solid: '#8A90A0', wash: '#F6F7F9' },
    accent: { soft: '#FFF4D1', fg: '#8A6100', solid: '#FFC21A', wash: '#FFFAEA' },
    info: { soft: '#E3ECFF', fg: '#2350C8', solid: '#3D6DF2', wash: '#F3F7FF' },
    success: { soft: '#DFF5EA', fg: '#0B7A4B', solid: '#16A366', wash: '#F0FAF5' },
    warning: { soft: '#FFE6D2', fg: '#B34700', solid: '#F2A516', wash: '#FFF8E6' },
    danger: { soft: '#FDE4E4', fg: '#C62828', solid: '#E5484D', wash: '#FFF4F4' },
    purple: { soft: '#F0E6FF', fg: '#7A32E0', solid: '#8E4EF0', wash: '#F9F5FF' },
  },
};

export const darkTheme: RecordCardTheme = {
  accent: '#FFC933',
  onAccent: '#1A1400',
  background: '#0E0E14',
  surface: '#17171F',
  surfaceAlt: '#1C1C26',
  secondary: '#262632',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#F2F2F7',
  textMuted: '#A5A5B4',
  textFaint: '#6B6B7A',
  amount: '#4CD39A',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  pressed: 'rgba(255, 255, 255, 0.06)',
  radius: 16,
  tones: {
    neutral: { soft: '#2A2A36', fg: '#C3C6D2', solid: '#6B6B7A', wash: '#1E1E28' },
    accent: { soft: 'rgba(255, 201, 51, 0.14)', fg: '#FFD766', solid: '#FFC933', wash: 'rgba(255, 201, 51, 0.07)' },
    info: { soft: 'rgba(92, 138, 255, 0.16)', fg: '#8FB0FF', solid: '#5C8AFF', wash: 'rgba(92, 138, 255, 0.08)' },
    success: { soft: 'rgba(76, 211, 154, 0.14)', fg: '#6FE0AE', solid: '#34C184', wash: 'rgba(76, 211, 154, 0.07)' },
    warning: { soft: 'rgba(255, 150, 64, 0.16)', fg: '#FFB070', solid: '#F2A516', wash: 'rgba(242, 165, 22, 0.08)' },
    danger: { soft: 'rgba(255, 99, 99, 0.16)', fg: '#FF8A8A', solid: '#FF6363', wash: 'rgba(255, 99, 99, 0.08)' },
    purple: { soft: 'rgba(170, 120, 255, 0.16)', fg: '#C4A3FF', solid: '#A878FF', wash: 'rgba(170, 120, 255, 0.08)' },
  },
};

export function resolveTheme(
  scheme: ColorSchemeName | null | undefined,
  overrides?: Partial<RecordCardTheme>,
): RecordCardTheme {
  const base = scheme === 'dark' ? darkTheme : lightTheme;
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    tones: overrides.tones ? { ...base.tones, ...overrides.tones } : base.tones,
  };
}

import React, { type ReactNode } from 'react';
import { Text } from 'react-native';

export type FilterIconName =
  | 'search'
  | 'filter'
  | 'close'
  | 'check'
  | 'chevron'
  | 'back'
  | 'down'
  | 'calendar'
  | 'add';

export type RenderIcon = (name: FilterIconName, color: string, size: number) => ReactNode;

const GLYPHS: Record<FilterIconName, string> = {
  search: '⌕',
  filter: '☰',
  close: '✕',
  check: '✓',
  chevron: '›',
  back: '‹',
  down: '⌄',
  calendar: '▦',
  add: '+',
};

/** Plain-glyph fallback so the components work without an icon library. */
export const glyphIcon: RenderIcon = (name, color, size) => (
  <Text style={{ color, fontSize: size * 0.9, lineHeight: size, fontWeight: '700', textAlign: 'center', minWidth: size }}>
    {GLYPHS[name]}
  </Text>
);

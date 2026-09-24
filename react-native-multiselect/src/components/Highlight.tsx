import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import type { Range } from '../fuzzy';

interface Props {
  text: string;
  ranges: Range[];
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
}

export function Highlight({ text, ranges, style, highlightStyle }: Props) {
  if (!ranges.length) {
    return (
      <Text style={style} numberOfLines={1}>
        {text}
      </Text>
    );
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <Text key={i} style={highlightStyle}>
        {text.slice(start, end)}
      </Text>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return (
    <Text style={style} numberOfLines={1}>
      {parts}
    </Text>
  );
}

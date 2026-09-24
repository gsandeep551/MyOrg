import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecordCardTheme, Tone } from '../theme';

interface Props {
  icon?: ReactNode;
  label: string;
  tone: Tone;
  theme: RecordCardTheme;
  size?: number;
  /** Solid fill, used while a confirm action is armed. */
  solid?: boolean;
}

/** Round tinted tile. Strings render as glyphs; elements render as-is. */
export function ActionIcon({ icon, label, tone, theme, size = 40, solid }: Props) {
  const c = theme.tones[tone];
  const content =
    icon == null || typeof icon === 'string' || typeof icon === 'number' ? (
      <Text
        style={[
          styles.glyph,
          { fontSize: size * 0.45, color: solid ? '#fff' : c.fg },
        ]}
      >
        {icon ?? label.trim().charAt(0).toUpperCase()}
      </Text>
    ) : (
      icon
    );
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: solid ? c.solid : c.soft,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontWeight: '700', textAlign: 'center' },
});

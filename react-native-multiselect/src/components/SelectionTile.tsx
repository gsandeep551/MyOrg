import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { MultiSelectTheme } from '../theme';

interface Props {
  selected: boolean;
  /** 1-based pick order; rendered inside the tile when selected. */
  order?: number;
  glyph: string;
  tint?: string;
  theme: MultiSelectTheme;
  size?: number;
}

/**
 * The leading tile flips from the option's glyph into a filled badge that shows
 * the order it was picked in, so selection *and* priority are readable at a glance.
 */
export function SelectionTile({
  selected,
  order,
  glyph,
  tint,
  theme,
  size = 40,
}: Props) {
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: selected ? 1 : 0,
      friction: 6,
      tension: 170,
      useNativeDriver: true,
    }).start();
  }, [selected, progress]);

  const glyphStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.5],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.5],
        }),
      },
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '90deg'],
        }),
      },
    ],
  };
  const badgeStyle = {
    opacity: progress.interpolate({
      inputRange: [0.3, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
        }),
      },
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['-90deg', '0deg'],
        }),
      },
    ],
  };
  const radius = size * 0.34;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: radius, backgroundColor: tint ?? theme.surfaceAlt },
          glyphStyle,
        ]}
      >
        <Text
          style={[styles.glyph, { fontSize: size * 0.45, color: theme.text }]}
        >
          {glyph}
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: radius, backgroundColor: theme.accent },
          badgeStyle,
        ]}
      >
        <Text
          style={[
            styles.order,
            { color: theme.onAccent, fontSize: size * 0.4 },
          ]}
        >
          {order ?? '✓'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontWeight: '600' },
  order: { fontWeight: '800', fontVariant: ['tabular-nums'] },
});

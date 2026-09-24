import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { resolveTheme, type RecordCardTheme } from './theme';

export interface RecordCardSkeletonProps {
  /** Placeholder field cells. */
  fields?: number;
  columns?: number;
  theme?: Partial<RecordCardTheme>;
  style?: StyleProp<ViewStyle>;
}

/** Same footprint as a `RecordCard`, so the list doesn't jump when data lands. */
export function RecordCardSkeleton({
  fields = 3,
  columns = 3,
  theme: themeOverrides,
  style,
}: RecordCardSkeletonProps) {
  const scheme = useColorScheme();
  const theme = useMemo(
    () => resolveTheme(scheme, themeOverrides),
    [scheme, themeOverrides],
  );
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const bar = (w: number | `${number}%`, h = 12) => (
    <View
      style={{ width: w, height: h, borderRadius: 6, backgroundColor: theme.secondary }}
    />
  );
  const cols = Math.min(columns, fields);

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        styles.card,
        {
          opacity: pulse,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: theme.radius,
        },
        style,
      ]}
    >
      <View style={[styles.band, { backgroundColor: theme.surfaceAlt }]}>
        {bar(140, 16)}
        {bar(56, 20)}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: fields }, (_, i) => (
          <View key={i} style={[styles.cell, { width: `${100 / cols}%` }]}>
            {bar(48, 9)}
            {bar('70%', 14)}
          </View>
        ))}
      </View>
      <View style={[styles.band, { backgroundColor: theme.surfaceAlt }]}>
        <View style={styles.row}>
          {bar(72, 36)}
          {bar(64, 36)}
          {bar(36, 36)}
        </View>
        {bar(80, 16)}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { paddingHorizontal: 18, paddingVertical: 14, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
});

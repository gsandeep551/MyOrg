import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { isActive, summarize } from './filters';
import { glyphIcon, type RenderIcon } from './icons';
import { resolveTheme, type FilterTheme } from './theme';
import type { FilterDef, FilterValues } from './types';

export interface SearchPanelProps {
  /** Controlled open state. Leave out to let the panel manage it. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  defaultExpanded?: boolean;
  title?: string;
  /**
   * One-line summary shown while collapsed, e.g. from `summarizeFilters`.
   * Truncates at the end; the badge still gives the full count.
   */
  summary?: string;
  /** Number shown in a badge on the bar, e.g. `countActive(...)`. */
  badge?: number;
  /** The search field and chips, revealed when expanded. */
  children: ReactNode;
  renderIcon?: RenderIcon;
  theme?: Partial<FilterTheme>;
  style?: StyleProp<ViewStyle>;
}

/** Joins every shown filter's value: `Rig · 807-Milliken · Last 7 days · 2 statuses`. */
export const summarizeFilters = (filters: FilterDef[], values: FilterValues) =>
  filters
    .filter(d => isActive(d, values[d.key]))
    .map(d => summarize(d, values[d.key]))
    .join(' · ');

/**
 * A slim bar that shows what's being searched and expands to reveal the
 * search field and filter chips, so the list keeps the screen.
 */
export function SearchPanel({
  expanded: expandedProp,
  onExpandedChange,
  defaultExpanded = false,
  title = 'Search & Filters',
  summary,
  badge = 0,
  children,
  renderIcon = glyphIcon,
  theme: themeOverrides,
  style,
}: SearchPanelProps) {
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(scheme, themeOverrides), [scheme, themeOverrides]);
  const [own, setOwn] = useState(defaultExpanded);
  const expanded = expandedProp ?? own;
  const setExpanded = (v: boolean) => {
    if (expandedProp === undefined) setOwn(v);
    onExpandedChange?.(v);
  };

  const [contentHeight, setContentHeight] = useState(0);
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animates height
    }).start();
  }, [expanded, progress]);

  const onContentLayout = (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    if (h !== contentHeight) setContentHeight(h);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={[title, summary, badge ? `${badge} filters active` : ''].filter(Boolean).join(', ')}
        style={({ pressed }) => [styles.bar, pressed && { backgroundColor: theme.pressed }]}
      >
        <View style={[styles.icon, { backgroundColor: badge ? theme.tones.accent.soft : theme.secondary }]}>
          {renderIcon('filter', badge ? theme.tones.accent.fg : theme.textMuted, 18)}
          {badge > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.surface }]}>
              <Text style={[styles.badgeText, { color: theme.onAccent }]}>{badge}</Text>
            </View>
          )}
        </View>
        <View style={styles.text}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          {!!summary && (
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.summary,
                {
                  color: theme.textMuted,
                  opacity: progress.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
                  // The summary line folds away while open, so the bar doesn't keep a blank line.
                  height: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
                },
              ]}
            >
              {summary}
            </Animated.Text>
          )}
        </View>
        <Animated.View
          style={{
            transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
          }}
        >
          {renderIcon('down', theme.textMuted, 22)}
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[
          styles.clip,
          {
            height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] }),
            opacity: progress,
          },
        ]}
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      >
        {/* Laid out at full height (absolutely) so it can be measured while clipped. */}
        <View style={styles.content} onLayout={onContentLayout}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56, paddingTop: 10, paddingBottom: 6 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  summary: { fontSize: 13, lineHeight: 18, marginTop: 1, overflow: 'hidden' },
  clip: { overflow: 'hidden' },
  // paddingTop leaves room for badges that sit above their buttons (e.g. the Filters count).
  content: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 12 },
});

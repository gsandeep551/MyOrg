import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { countActive, isActive, summarize } from './filters';
import { glyphIcon, type RenderIcon } from './icons';
import { resolveTheme, type FilterTheme } from './theme';
import type { FilterDef, FilterValues } from './types';

export interface FilterChipsProps {
  filters: FilterDef[];
  value: FilterValues;
  /** Tap a chip to edit that filter, e.g. open the sheet at it. */
  onPressChip: (key: string) => void;
  /** × on a chip resets that filter. Required filters have no ×. */
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  /** Also show unused filters as dashed “+ Label” chips, so they can be found. */
  showInactive?: boolean;
  renderIcon?: RenderIcon;
  theme?: Partial<FilterTheme>;
  style?: StyleProp<ViewStyle>;
}

/** One horizontally scrolling row that shows every applied filter at a glance. */
export function FilterChips({
  filters,
  value,
  onPressChip,
  onRemove,
  onClearAll,
  showInactive = true,
  renderIcon = glyphIcon,
  theme: themeOverrides,
  style,
}: FilterChipsProps) {
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(scheme, themeOverrides), [scheme, themeOverrides]);
  const accent = theme.tones.accent;
  const removable = countActive(filters, value);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, style]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {filters.map(def => {
        const on = isActive(def, value[def.key]);
        if (!on && !showInactive) return null;
        const required = def.type === 'single' && def.required;
        const text = on ? summarize(def, value[def.key]) : def.label;
        return (
          <View
            key={def.key}
            style={[
              styles.chip,
              on
                ? { backgroundColor: accent.soft, borderColor: accent.solid }
                : { backgroundColor: theme.surface, borderColor: theme.textFaint, borderStyle: 'dashed' },
            ]}
          >
            <Pressable
              onPress={() => onPressChip(def.key)}
              accessibilityRole="button"
              accessibilityLabel={on ? `${def.label}: ${text}. Change` : `Add ${def.label} filter`}
              style={styles.chipMain}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              {!on && renderIcon('add', theme.textMuted, 14)}
              <Text numberOfLines={1} style={[styles.chipText, { color: on ? accent.fg : theme.textMuted }]}>
                {on && <Text style={styles.chipLabel}>{def.label}: </Text>}
                {text}
              </Text>
              {on && required && renderIcon('down', accent.fg, 14)}
            </Pressable>
            {on && !required && (
              <Pressable
                onPress={() => onRemove(def.key)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${def.label} filter`}
                style={[styles.x, { backgroundColor: accent.solid }]}
              >
                {renderIcon('close', theme.onAccent, 10)}
              </Pressable>
            )}
          </View>
        );
      })}
      {!!onClearAll && removable > 1 && (
        <Pressable onPress={onClearAll} accessibilityRole="button" hitSlop={8} style={styles.clearAll}>
          <Text style={[styles.clearAllText, { color: theme.textMuted }]}>Clear all</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { alignItems: 'center', gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 6,
    gap: 6,
  },
  chipMain: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6, maxWidth: 220 },
  chipText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  chipLabel: { fontWeight: '500' },
  x: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  clearAll: { paddingHorizontal: 6, height: 34, justifyContent: 'center' },
  clearAllText: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});

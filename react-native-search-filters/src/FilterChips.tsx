import React, { useMemo, useState } from 'react';
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
  /**
   * Filters don't apply right now, e.g. while searching by ticket number.
   * Chips dim and can't be tapped, and `pausedNote` is shown before them.
   */
  paused?: boolean;
  /** e.g. `Filters paused while searching by ticket #`. */
  pausedNote?: string;
  /** Link after the note to leave the paused mode, e.g. clear the ticket number. */
  onResume?: () => void;
  resumeLabel?: string;
  /**
   * `collapse` (default): one line with as many chips as fit and a `+N` chip
   * that expands the rest in place; `Less` folds them back.
   * `wrap`: always show every chip, over as many lines as needed.
   * `scroll`: one line that scrolls sideways.
   */
  layout?: 'collapse' | 'wrap' | 'scroll';
  /** Prefix each value with its filter name (“Job type: Rig”). Off by default to save width. */
  showLabels?: boolean;
  renderIcon?: RenderIcon;
  theme?: Partial<FilterTheme>;
  style?: StyleProp<ViewStyle>;
}

/** Shows every applied filter at a glance; tap to change, × to remove. */
export function FilterChips({
  filters,
  value,
  onPressChip,
  onRemove,
  onClearAll,
  showInactive = true,
  paused = false,
  pausedNote = 'Filters paused',
  onResume,
  resumeLabel = 'Use filters',
  layout = 'collapse',
  showLabels = false,
  renderIcon = glyphIcon,
  theme: themeOverrides,
  style,
}: FilterChipsProps) {
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(scheme, themeOverrides), [scheme, themeOverrides]);
  const accent = theme.tones.accent;
  const removable = countActive(filters, value);
  const [expanded, setExpanded] = useState(false);
  const [rowWidth, setRowWidth] = useState(0);
  const [widths, setWidths] = useState<Record<string, number>>({});

  if (paused) {
    return (
      <View style={[styles.pausedRow, style]}>
        <View style={[styles.pausedPill, { backgroundColor: theme.secondary }]}>
          {renderIcon('filter', theme.textMuted, 14)}
          <Text numberOfLines={1} style={[styles.pausedText, { color: theme.textMuted }]}>
            {pausedNote}
          </Text>
        </View>
        {onResume && (
          <Pressable onPress={onResume} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.clearAllText, { color: theme.tones.accent.fg }]}>{resumeLabel}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const chips = filters.flatMap(def => {
    const on = isActive(def, value[def.key]);
    if (!on && !showInactive) return [];
    const required = def.type === 'single' && def.required;
    const text = on ? summarize(def, value[def.key]) : def.label;
    return [
      {
        key: def.key,
        node: (
          <View
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
                {on && showLabels && <Text style={styles.chipLabel}>{def.label}: </Text>}
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
        ),
      },
    ];
  });

  const clearAll = !!onClearAll && removable > 1 && (
    <Pressable key="__clear" onPress={onClearAll} accessibilityRole="button" hitSlop={8} style={styles.clearAll}>
      <Text style={[styles.clearAllText, { color: theme.textMuted }]}>Clear all</Text>
    </Pressable>
  );

  const pill = (label: string, onPress: () => void, a11y: string) => (
    <Pressable
      key="__more"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [styles.more, { backgroundColor: theme.secondary, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.moreText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );

  if (layout !== 'collapse') {
    return (
      <Wrapper layout={layout} style={style}>
        {chips.map(c => (
          <React.Fragment key={c.key}>{c.node}</React.Fragment>
        ))}
        {clearAll}
      </Wrapper>
    );
  }

  // ---- collapse: measure every chip off-screen, then show what fits on line one.
  const measured = rowWidth > 0 && chips.every(c => widths[c.key] != null);
  let visible = chips.length;
  if (measured) {
    // Pack chips left to right; if some don't fit, keep room for the “+N” chip.
    const lineWidth = (n: number) => chips.slice(0, n).reduce((sum, c, i) => sum + widths[c.key] + (i ? GAP : 0), 0);
    if (lineWidth(chips.length) > rowWidth) {
      visible = 1;
      while (visible < chips.length && lineWidth(visible + 1) + GAP + MORE_WIDTH <= rowWidth) visible++;
    }
  }
  const hidden = chips.length - visible;

  return (
    <View style={style} onLayout={e => setRowWidth(Math.round(e.nativeEvent.layout.width))}>
      {/* Invisible copy used only to measure each chip's natural width. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        {chips.map(c => (
          <View
            key={c.key}
            style={styles.measureItem}
            onLayout={e => {
              const w = Math.ceil(e.nativeEvent.layout.width);
              setWidths(b => (b[c.key] === w ? b : { ...b, [c.key]: w }));
            }}
          >
            {c.node}
          </View>
        ))}
      </View>

      {expanded || !hidden ? (
        <View style={styles.wrap}>
          {chips.map(c => (
            <React.Fragment key={c.key}>{c.node}</React.Fragment>
          ))}
          {hidden > 0 && pill('Less', () => setExpanded(false), 'Show fewer filters')}
          {clearAll}
        </View>
      ) : (
        <View style={[styles.row, !measured && styles.hiddenRow]}>
          {chips.slice(0, visible).map(c => (
            <React.Fragment key={c.key}>{c.node}</React.Fragment>
          ))}
          {pill(`+${hidden}`, () => setExpanded(true), `Show ${hidden} more filter${hidden === 1 ? '' : 's'}`)}
        </View>
      )}
    </View>
  );
}

const GAP = 8;
const MORE_WIDTH = 48;

function Wrapper({ layout, style, children }: { layout: 'wrap' | 'scroll'; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  if (layout === 'wrap') return <View style={[styles.wrap, style]}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, style]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: GAP },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP, overflow: 'hidden' },
  hiddenRow: { opacity: 0 },
  measure: { position: 'absolute', left: 0, top: 0, opacity: 0, alignItems: 'flex-start' },
  measureItem: { flexDirection: 'row' },
  more: { height: 34, minWidth: 40, paddingHorizontal: 12, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scroll: { flexGrow: 0 },
  content: { alignItems: 'center', gap: 8, paddingVertical: 2 },
  chip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 6,
    gap: 6,
  },
  chipMain: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6, flexShrink: 1 },
  chipText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  chipLabel: { fontWeight: '500' },
  x: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pausedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 38 },
  pausedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    flexShrink: 1,
  },
  pausedText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  clearAll: { paddingHorizontal: 6, height: 34, justifyContent: 'center' },
  clearAllText: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});

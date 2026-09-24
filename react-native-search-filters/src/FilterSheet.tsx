import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { RangeCalendar } from './components/RangeCalendar';
import { resolveRange, shortDate } from './dates';
import { defaultOf, defaultsOf, presetsOf } from './filters';
import { glyphIcon, type RenderIcon } from './icons';
import { resolveTheme, type FilterTheme } from './theme';
import type {
  DateRangeFilterDef,
  DateRangeValue,
  FilterDef,
  FilterOption,
  FilterValues,
  MultiFilterDef,
  SingleFilterDef,
} from './types';

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterDef[];
  /** The applied values. The sheet edits a draft and only calls `onApply` on the main button. */
  value: FilterValues;
  onApply: (value: FilterValues) => void;
  /**
   * Optional result count for a draft, for a “Show 23 tickets” button. Leave it
   * out when filtering happens on the server and there's no count endpoint:
   * the button then says “Search tickets”. It may return a Promise (e.g. a
   * count-only API call); calls are debounced and stale answers are ignored.
   */
  resultCount?: (draft: FilterValues) => number | Promise<number> | undefined;
  /** Nouns for the button, e.g. `['ticket', 'tickets']`. */
  noun?: [string, string];
  /** Main button label when no count is available. Defaults to `Search <nouns>`. */
  applyLabel?: string;
  /**
   * Open straight at one filter (e.g. after tapping its chip). A list filter
   * opens its searchable list, and picking an option applies and closes.
   */
  focusKey?: string | null;
  title?: string;
  today?: Date;
  renderIcon?: RenderIcon;
  bottomInset?: number;
  maxWidth?: number;
  theme?: Partial<FilterTheme>;
}

const CHIP_LIMIT = 8;
const isList = (d: SingleFilterDef) => d.display === 'list' || (d.display !== 'chips' && d.options.length > CHIP_LIMIT);

/**
 * All filters on one sheet: chips for short lists, a searchable page for long
 * ones, date presets with a range calendar, and a live result count.
 */
export function FilterSheet({
  visible,
  onClose,
  filters,
  value,
  onApply,
  resultCount,
  noun = ['result', 'results'],
  applyLabel,
  focusKey,
  title = 'Filters',
  today: todayProp,
  renderIcon = glyphIcon,
  bottomInset = 0,
  maxWidth = 600,
  theme: themeOverrides,
}: FilterSheetProps) {
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(scheme, themeOverrides), [scheme, themeOverrides]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheetWidth = Math.min(windowWidth, maxWidth);
  const wide = windowWidth > maxWidth;
  const sheetHeight = Math.min(windowHeight * 0.88, 780);
  const today = useMemo(() => todayProp ?? new Date(), [todayProp]);
  const accent = theme.tones.accent;

  const [mounted, setMounted] = useState(visible);
  const [draft, setDraft] = useState<FilterValues>(value);
  const [page, setPage] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const [query, setQuery] = useState('');
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const sheetY = useRef(new Animated.Value(windowHeight)).current;
  const pageX = useRef(new Animated.Value(sheetWidth)).current;

  // ---- optional result count (sync, or async from the server) --------------
  const [count, setCount] = useState<number | undefined>(undefined);
  const [counting, setCounting] = useState(false);
  const countRef = useRef(resultCount);
  countRef.current = resultCount;
  const requestId = useRef(0);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!visible || !countRef.current) return;
    const id = ++requestId.current;
    const t = setTimeout(() => {
      const r = countRef.current?.(draft);
      if (r == null || typeof r === 'number') {
        setCount(r ?? undefined);
        setCounting(false);
        return;
      }
      setCounting(true);
      r.then(
        n => id === requestId.current && (setCount(n), setCounting(false)),
        () => id === requestId.current && (setCount(undefined), setCounting(false)),
      );
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, visible]);

  const openPage = (key: string, animate = true) => {
    setQuery('');
    setPage(key);
    pageX.setValue(animate ? sheetWidth : 0);
    if (animate) Animated.timing(pageX, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const closePage = () =>
    Animated.timing(pageX, { toValue: sheetWidth, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
      setPage(null),
    );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setDraft({ ...defaultsOf(filters), ...value });
      const focus = filters.find(f => f.key === focusKey);
      const listFocus = focus?.type === 'single' && isList(focus);
      setQuick(!!listFocus);
      if (listFocus) openPage(focus.key, false);
      else setPage(null);
      sheetY.setValue(windowHeight);
      Animated.spring(sheetY, { toValue: 0, damping: 24, stiffness: 240, mass: 0.9, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(sheetY, { toValue: windowHeight, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        if (!visibleRef.current) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => sheetY.setValue(g.dy > 0 ? g.dy : g.dy / 6),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 90 || g.vy > 1.1) onCloseRef.current();
          else Animated.spring(sheetY, { toValue: 0, damping: 20, stiffness: 260, useNativeDriver: true }).start();
        },
      }),
    [sheetY],
  );

  if (!mounted) return null;

  const set = (key: string, v: FilterValues[string]) => setDraft(d => ({ ...d, [key]: v }));
  const apply = (next = draft) => {
    onApply(next);
    onClose();
  };
  const changed = filters.some(f => JSON.stringify(draft[f.key]) !== JSON.stringify(defaultOf(f)));

  // ---- pieces ---------------------------------------------------------------

  const chip = (
    key: string,
    label: string,
    on: boolean,
    onPress: () => void,
    extra?: { tone?: FilterOption['tone']; count?: number; a11y?: 'radio' | 'checkbox' },
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole={extra?.a11y ?? 'button'}
      accessibilityState={extra?.a11y === 'radio' ? { selected: on } : { checked: on }}
      style={({ pressed }) => [
        styles.chip,
        on
          ? { backgroundColor: accent.soft, borderColor: accent.solid }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      {on ? renderIcon('check', accent.fg, 14) : extra?.tone ? <View style={[styles.dot, { backgroundColor: theme.tones[extra.tone].solid }]} /> : null}
      <Text style={[styles.chipText, { color: on ? accent.fg : theme.text, fontWeight: on ? '700' : '500' }]}>{label}</Text>
      {extra?.count != null && (
        <Text style={[styles.chipCount, { color: on ? accent.fg : theme.textFaint }]}>{extra.count}</Text>
      )}
    </Pressable>
  );

  const sectionHead = (label: string, right?: React.ReactNode) => (
    <View style={styles.sectionHead}>
      <Text accessibilityRole="header" style={[styles.sectionLabel, { color: theme.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      {right}
    </View>
  );

  const single = (d: SingleFilterDef) => {
    const v = draft[d.key] as string | null;
    const selected = d.options.find(o => o.value === v);
    if (isList(d)) {
      return (
        <View key={d.key} style={styles.section}>
          {sectionHead(d.label + (d.required ? ' *' : ''))}
          <Pressable
            onPress={() => openPage(d.key)}
            accessibilityRole="button"
            accessibilityLabel={`${d.label}: ${selected?.label ?? d.anyLabel ?? 'Any'}. Change`}
            style={({ pressed }) => [styles.select, { borderColor: theme.border, backgroundColor: pressed ? theme.pressed : theme.surface }]}
          >
            <Text numberOfLines={1} style={[styles.selectText, { color: selected ? theme.text : theme.textFaint }]}>
              {selected?.label ?? d.anyLabel ?? 'Any'}
            </Text>
            {renderIcon('chevron', theme.textMuted, 20)}
          </Pressable>
          {!!selected?.hint && <Text style={[styles.hint, { color: theme.textMuted }]}>{selected.hint}</Text>}
        </View>
      );
    }
    return (
      <View key={d.key} style={styles.section}>
        {sectionHead(d.label + (d.required ? ' *' : ''))}
        <View style={styles.chips}>
          {d.options.map(o =>
            chip(o.value, o.label, o.value === v, () => set(d.key, o.value === v && !d.required ? null : o.value), { a11y: 'radio' }),
          )}
        </View>
      </View>
    );
  };

  const multi = (d: MultiFilterDef) => {
    const v = (draft[d.key] as string[]) ?? [];
    const all = v.length === d.options.length;
    return (
      <View key={d.key} style={styles.section}>
        {sectionHead(
          d.label,
          <Pressable onPress={() => set(d.key, all ? [] : d.options.map(o => o.value))} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: accent.fg }]}>{all ? 'Clear' : 'Select all'}</Text>
          </Pressable>,
        )}
        <View style={styles.chips}>
          {d.options.map(o =>
            chip(
              o.value,
              o.label,
              v.includes(o.value),
              () => set(d.key, v.includes(o.value) ? v.filter(x => x !== o.value) : [...v, o.value]),
              { tone: o.tone, count: o.count, a11y: 'checkbox' },
            ),
          )}
        </View>
      </View>
    );
  };

  const dateRange = (d: DateRangeFilterDef) => {
    const presets = presetsOf(d);
    const v = (draft[d.key] as DateRangeValue) ?? { preset: null, from: null, to: null };
    const custom = v.preset === 'custom';
    const shown = resolveRange(v, presets, today);
    return (
      <View key={d.key} style={styles.section}>
        {sectionHead(
          d.label,
          (v.preset || v.from) && (
            <Pressable onPress={() => set(d.key, defaultOf(d))} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: accent.fg }]}>Any date</Text>
            </Pressable>
          ),
        )}
        <View style={styles.chips}>
          {presets.map(p =>
            chip(p.key, p.label, v.preset === p.key, () => set(d.key, v.preset === p.key ? defaultOf(d) : resolveRange({ preset: p.key, from: null, to: null }, presets, today)), {
              a11y: 'radio',
            }),
          )}
          {chip('custom', 'Custom', custom, () => set(d.key, custom ? defaultOf(d) : { preset: 'custom', from: shown.from, to: shown.to }), { a11y: 'radio' })}
        </View>
        {(custom || shown.from) && (
          <View style={[styles.rangeBox, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <View style={styles.rangeRow}>
              {renderIcon('calendar', theme.textMuted, 16)}
              <Text style={[styles.rangeText, { color: theme.text }]}>
                {shown.from ? shortDate(shown.from) : 'Start'} → {shown.to ? shortDate(shown.to) : custom && shown.from ? 'Pick an end date' : 'End'}
              </Text>
            </View>
            {custom && (
              <RangeCalendar
                from={v.from}
                to={v.to}
                onChange={(from, to) => set(d.key, { preset: 'custom', from, to })}
                today={today}
                maxDate={today}
                theme={theme}
                renderIcon={renderIcon}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  // ---- list page ----------------------------------------------------------

  const pageDef = filters.find(f => f.key === page) as SingleFilterDef | undefined;
  const q = query.trim().toLowerCase();
  // Optional filters get a “no filter” row at the top (value null).
  const ANY = '\u0000any';
  const pageOptions: FilterOption[] = pageDef
    ? [
        ...(!pageDef.required && !q ? [{ value: ANY, label: pageDef.anyLabel ?? 'Any' }] : []),
        ...pageDef.options.filter(o => !q || o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)),
      ]
    : [];
  const choose = (o: FilterOption) => {
    if (!pageDef) return;
    const next = { ...draft, [pageDef.key]: o.value === ANY ? null : o.value };
    setDraft(next);
    if (quick) apply(next);
    else closePage();
  };

  const cta = counting
    ? 'Counting…'
    : count == null
      ? applyLabel ?? `Search ${noun[1]}`
      : count === 0
        ? `No ${noun[1]} match`
        : `Show ${count} ${count === 1 ? noun[0] : noun[1]}`;
  const empty = !counting && count === 0;

  return (
    <Modal visible transparent animationType="none" onRequestClose={page && !quick ? closePage : onClose} statusBarTranslucent>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.backdrop,
            opacity: sheetY.interpolate({ inputRange: [0, windowHeight * 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close filters" />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { width: sheetWidth, height: sheetHeight, backgroundColor: theme.surface, transform: [{ translateY: sheetY }] },
          wide && styles.sheetWide,
        ]}
      >
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View {...drag.panHandlers}>
            <View style={[styles.grabber, { backgroundColor: theme.border }]} />
            <View style={styles.head}>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
                {title}
              </Text>
              {changed && (
                <Pressable onPress={() => setDraft(defaultsOf(filters))} hitSlop={8} accessibilityRole="button" style={styles.reset}>
                  <Text style={[styles.resetText, { color: theme.textMuted }]}>Reset</Text>
                </Pressable>
              )}
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [styles.close, { backgroundColor: pressed ? theme.pressed : theme.secondary }]}
              >
                {renderIcon('close', theme.textMuted, 16)}
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {filters.map(d => (d.type === 'single' ? single(d) : d.type === 'multi' ? multi(d) : dateRange(d)))}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: 12 + bottomInset }]}>
            <Pressable
              onPress={() => apply()}
              disabled={empty}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: empty ? theme.secondary : theme.accent, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              {counting ? <ActivityIndicator size="small" color={theme.onAccent} /> : !empty && renderIcon('search', theme.onAccent, 18)}
              <Text style={[styles.ctaText, { color: empty ? theme.textFaint : theme.onAccent }]}>{cta}</Text>
            </Pressable>
          </View>

          {pageDef && (
            <Animated.View style={[StyleSheet.absoluteFill, styles.page, { backgroundColor: theme.surface, transform: [{ translateX: pageX }] }]}>
              <View style={[styles.grabber, { backgroundColor: theme.border }]} />
              <View style={styles.head}>
                <Pressable
                  onPress={quick ? onClose : closePage}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={quick ? 'Close' : 'Back to filters'}
                  style={({ pressed }) => [styles.close, { backgroundColor: pressed ? theme.pressed : theme.secondary }]}
                >
                  {renderIcon(quick ? 'close' : 'back', theme.text, quick ? 16 : 20)}
                </Pressable>
                <Text accessibilityRole="header" style={[styles.title, styles.pageTitle, { color: theme.text }]}>
                  {pageDef.label}
                </Text>
              </View>
              <View style={[styles.search, { backgroundColor: theme.secondary }]}>
                {renderIcon('search', theme.textMuted, 18)}
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${pageDef.label.toLowerCase()}`}
                  placeholderTextColor={theme.textFaint}
                  autoCorrect={false}
                  style={[styles.searchInput, { color: theme.text }]}
                  accessibilityLabel={`Search ${pageDef.label}`}
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
                {pageOptions.map(o => {
                  const on = (draft[pageDef.key] ?? ANY) === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => choose(o)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => [
                        styles.option,
                        on && { backgroundColor: accent.soft },
                        pressed && !on && { backgroundColor: theme.pressed },
                      ]}
                    >
                      <View style={styles.optionText}>
                        <Text style={[styles.optionLabel, { color: on ? accent.fg : theme.text, fontWeight: on ? '700' : '500' }]}>{o.label}</Text>
                        {!!o.hint && <Text style={[styles.optionHint, { color: theme.textMuted }]}>{o.hint}</Text>}
                      </View>
                      <View style={[styles.radio, { borderColor: on ? accent.solid : theme.textFaint }]}>
                        {on && <View style={[styles.radioDot, { backgroundColor: accent.solid }]} />}
                      </View>
                    </Pressable>
                  );
                })}
                {!pageOptions.length && (
                  <Text style={[styles.empty, { color: theme.textMuted }]}>No {pageDef.label.toLowerCase()} matches “{query}”</Text>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetWide: { bottom: 16, borderRadius: 28 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  pageTitle: { flex: 1 },
  reset: { paddingHorizontal: 4 },
  resetText: { fontSize: 14, fontWeight: '700' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: 20, paddingBottom: 20, gap: 22 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7 },
  link: { fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
  },
  chipText: { fontSize: 14 },
  chipCount: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  selectText: { flex: 1, fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: -4 },
  rangeBox: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16 },
  ctaText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  page: { zIndex: 5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 6, height: 44, borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  list: { paddingHorizontal: 8, paddingBottom: 24 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 14, borderRadius: 14 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16 },
  optionHint: { fontSize: 13, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 14 },
});

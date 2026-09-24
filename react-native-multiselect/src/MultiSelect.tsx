import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  FlatList,
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
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { OptionRow, OPTION_ROW_HEIGHT } from './components/OptionRow';
import { fuzzyMatch, type Range } from './fuzzy';
import { resolveTheme, type MultiSelectTheme } from './theme';

export type OptionValue = string | number;

export interface MultiSelectOption<V extends OptionValue = string> {
  value: V;
  label: string;
  description?: string;
  /** Options sharing a group are sectioned under a header with a "select all" toggle. */
  group?: string;
  /** Emoji or 1–2 characters shown in the leading tile. Defaults to the label's initials. */
  icon?: string;
  /** Background of the leading tile while unselected. */
  tint?: string;
  disabled?: boolean;
}

export interface MultiSelectProps<V extends OptionValue = string> {
  options: MultiSelectOption<V>[];
  /** Selected values, in the order they were picked. */
  value: V[];
  onChange: (value: V[]) => void;
  label?: string;
  placeholder?: string;
  /** Sheet title; defaults to `label`. */
  title?: string;
  searchPlaceholder?: string;
  /** Maximum number of selections. */
  max?: number;
  /** How many chips the closed field shows before collapsing into "+N". */
  maxTriggerChips?: number;
  /**
   * Enables "Create “query”" when the search has no exact match. Return the new
   * option; it is selected immediately. Add it to `options` so its chip can render.
   */
  onCreateOption?: (label: string) => MultiSelectOption<V> | undefined;
  onLimitReached?: () => void;
  theme?: Partial<MultiSelectTheme>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

type Row<V extends OptionValue> =
  | { kind: 'header'; key: string; group: string; values: V[] }
  | {
      kind: 'option';
      key: string;
      option: MultiSelectOption<V>;
      ranges: Range[];
    };

const HEADER_HEIGHT = 44;
const LIST_BOTTOM_PADDING = 24;
const EDGE = 64;
const MAX_AUTOSCROLL_SPEED = 16;

const initials = (label: string) =>
  label
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

const sameArray = <T,>(a: T[], b: T[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export function MultiSelect<V extends OptionValue = string>(
  props: MultiSelectProps<V>,
) {
  const {
    options,
    value,
    label,
    placeholder = 'Select…',
    title = label ?? 'Select',
    searchPlaceholder = 'Search',
    max,
    maxTriggerChips = 2,
    onCreateOption,
    style,
    disabled,
  } = props;

  const scheme = useColorScheme();
  const theme = useMemo(
    () => resolveTheme(scheme, props.theme),
    [scheme, props.theme],
  );
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.min(windowHeight * 0.88, 780);

  // Latest props in refs so gesture handlers created once never go stale.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;
  const onLimitRef = useRef(props.onLimitReached);
  onLimitRef.current = props.onLimitReached;
  const maxRef = useRef(max);
  maxRef.current = max;

  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [painting, setPainting] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo: V[] } | null>(
    null,
  );

  const optionByValue = useMemo(
    () => new Map(options.map(o => [o.value, o])),
    [options],
  );
  const selectedOptions = useMemo(
    () =>
      value
        .map(v => optionByValue.get(v))
        .filter((o): o is MultiSelectOption<V> => !!o),
    [value, optionByValue],
  );
  const orderOf = useMemo(
    () => new Map(value.map((v, i) => [v, i + 1])),
    [value],
  );

  // ---- rows ---------------------------------------------------------------

  // Filtering runs on a deferred copy so keystrokes never wait on re-ranking.
  const deferredQuery = useDeferredValue(query);
  const { rows, offsets, contentHeight, matchCount } = useMemo(() => {
    const q = deferredQuery.trim();
    let matched = options.flatMap(option => {
      if (!q) return [{ option, ranges: [] as Range[], score: 0 }];
      const m = fuzzyMatch(q, option.label);
      if (m) return [{ option, ranges: m.ranges, score: m.score }];
      if (option.description && fuzzyMatch(q, option.description)) {
        return [{ option, ranges: [] as Range[], score: -1e6 }];
      }
      return [];
    });
    const out: Row<V>[] = [];
    if (q) {
      matched = [...matched].sort((a, b) => b.score - a.score);
      matched.forEach(m =>
        out.push({ kind: 'option', key: `o:${m.option.value}`, ...m }),
      );
    } else {
      const groups = new Map<string, typeof matched>();
      matched.forEach(m => {
        const g = m.option.group ?? '';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(m);
      });
      groups.forEach((items, group) => {
        if (group) {
          const values = items
            .filter(i => !i.option.disabled)
            .map(i => i.option.value);
          out.push({ kind: 'header', key: `h:${group}`, group, values });
        }
        items.forEach(m =>
          out.push({ kind: 'option', key: `o:${m.option.value}`, ...m }),
        );
      });
    }
    const offs: number[] = [];
    let y = 0;
    out.forEach(r => {
      offs.push(y);
      y += r.kind === 'header' ? HEADER_HEIGHT : OPTION_ROW_HEIGHT;
    });
    return {
      rows: out,
      offsets: offs,
      contentHeight: y + LIST_BOTTOM_PADDING,
      matchCount: matched.length,
    };
  }, [options, deferredQuery]);

  const layoutRef = useRef({ rows, offsets, contentHeight });
  layoutRef.current = { rows, offsets, contentHeight };

  // ---- selection primitives ----------------------------------------------

  const shake = useRef(new Animated.Value(0)).current;
  const signalLimit = useCallback(() => {
    shake.setValue(0);
    Animated.sequence(
      [10, -9, 7, -5, 3, 0].map(toValue =>
        Animated.timing(shake, {
          toValue,
          duration: 45,
          useNativeDriver: true,
        }),
      ),
    ).start();
    onLimitRef.current?.();
  }, [shake]);

  const commit = useCallback((next: V[]) => {
    valueRef.current = next; // optimistic, so rapid gestures see their own writes
    onChangeRef.current(next);
  }, []);

  /** Adds values in order, stopping at `max`. Returns false if the limit cut it short. */
  const addValues = useCallback((base: V[], add: V[]): [V[], boolean] => {
    const next = [...base];
    const limit = maxRef.current;
    for (const v of add) {
      if (next.includes(v)) continue;
      if (limit != null && next.length >= limit) return [next, false];
      next.push(v);
    }
    return [next, true];
  }, []);

  const toggleValue = useCallback(
    (v: V) => {
      const cur = valueRef.current;
      if (cur.includes(v)) return commit(cur.filter(x => x !== v));
      const [next, ok] = addValues(cur, [v]);
      if (!ok) return signalLimit();
      commit(next);
    },
    [addValues, commit, signalLimit],
  );

  const setMany = useCallback(
    (values: V[]) => {
      const cur = valueRef.current;
      if (values.every(v => cur.includes(v))) {
        const drop = new Set(values);
        return commit(cur.filter(v => !drop.has(v)));
      }
      const [next, ok] = addValues(cur, values);
      if (!ok) signalLimit();
      commit(next);
    },
    [addValues, commit, signalLimit],
  );

  // ---- drag-to-paint selection -------------------------------------------
  // Long-press a row, then drag: every row between the anchor and your finger
  // takes the anchor's new state. Dragging back un-paints. Near the edges the
  // list auto-scrolls, so long ranges are one gesture.

  const listRef = useRef<FlatList<Row<V>>>(null);
  // ComponentRef resolves to the instance type on both old (class) and new (function) RN typings.
  const listWrapRef = useRef<React.ComponentRef<typeof View>>(null);
  const scrollY = useRef(0);
  const listTop = useRef(0);
  const viewportH = useRef(0);
  const lastPageY = useRef(-1);
  const raf = useRef<number | null>(null);
  const paint = useRef({
    active: false,
    granted: false,
    limitHit: false,
    anchor: -1,
    current: -1,
    mode: 'select' as 'select' | 'deselect',
    baseline: [] as V[],
  });

  const applyPaint = useCallback(() => {
    const p = paint.current;
    const { rows: rs } = layoutRef.current;
    const step = p.current >= p.anchor ? 1 : -1;
    const range: V[] = [];
    for (let i = p.anchor; ; i += step) {
      const r = rs[i];
      if (r?.kind === 'option' && !r.option.disabled)
        range.push(r.option.value);
      if (i === p.current || r === undefined) break;
    }
    let next: V[];
    if (p.mode === 'deselect') {
      const drop = new Set(range);
      next = p.baseline.filter(v => !drop.has(v));
    } else {
      const [added, ok] = addValues(p.baseline, range);
      next = added;
      if (!ok && !p.limitHit) {
        p.limitHit = true;
        signalLimit();
      }
    }
    if (!sameArray(next, valueRef.current)) commit(next);
  }, [addValues, commit, signalLimit]);

  const rowAt = useCallback((pageY: number) => {
    const { offsets: offs } = layoutRef.current;
    const y = pageY - listTop.current + scrollY.current;
    let lo = 0;
    let hi = offs.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (offs[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return Math.max(0, lo);
  }, []);

  const trackFinger = useCallback(
    (pageY: number) => {
      const idx = rowAt(pageY);
      if (idx !== paint.current.current) {
        paint.current.current = idx;
        applyPaint();
      }
    },
    [applyPaint, rowAt],
  );

  const autoScroll = useCallback(() => {
    if (!paint.current.active) return;
    if (lastPageY.current >= 0) {
      const y = lastPageY.current - listTop.current;
      const h = viewportH.current;
      let speed = 0;
      if (y < EDGE) speed = -Math.min(1, (EDGE - y) / EDGE);
      else if (y > h - EDGE) speed = Math.min(1, (y - (h - EDGE)) / EDGE);
      if (speed) {
        const maxOffset = Math.max(0, layoutRef.current.contentHeight - h);
        const next = Math.min(
          maxOffset,
          Math.max(0, scrollY.current + speed * MAX_AUTOSCROLL_SPEED),
        );
        if (next !== scrollY.current) {
          scrollY.current = next;
          listRef.current?.scrollToOffset({ offset: next, animated: false });
          trackFinger(lastPageY.current);
        }
      }
    }
    raf.current = requestAnimationFrame(autoScroll);
  }, [trackFinger]);

  const endPaint = useCallback(() => {
    if (!paint.current.active) return;
    paint.current.active = false;
    paint.current.granted = false;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPainting(false);
  }, []);

  const startPaint = useCallback(
    (rowIndex: number) => {
      const row = layoutRef.current.rows[rowIndex];
      if (row?.kind !== 'option') return;
      const wasSelected = valueRef.current.includes(row.option.value);
      paint.current = {
        active: true,
        granted: false,
        limitHit: false,
        anchor: rowIndex,
        current: rowIndex,
        mode: wasSelected ? 'deselect' : 'select',
        baseline: valueRef.current,
      };
      lastPageY.current = -1;
      setPainting(true);
      listWrapRef.current?.measure((_x, _y, _w, h, _px, py) => {
        listTop.current = py;
        viewportH.current = h;
      });
      applyPaint();
      raf.current = requestAnimationFrame(autoScroll);
    },
    [applyPaint, autoScroll],
  );

  const onRowPressOut = useCallback(() => {
    // A long-press released without dragging: the pan responder never took
    // over, so the row is the one that has to end the paint session.
    if (paint.current.active)
      setTimeout(() => !paint.current.granted && endPaint(), 0);
  }, [endPaint]);

  const paintResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: () => paint.current.active,
        onMoveShouldSetPanResponder: () => paint.current.active,
        onPanResponderTerminationRequest: () => !paint.current.active,
        onPanResponderGrant: () => {
          paint.current.granted = true;
        },
        onPanResponderMove: (_e, g) => {
          lastPageY.current = g.moveY;
          trackFinger(g.moveY);
        },
        onPanResponderRelease: endPaint,
        onPanResponderTerminate: endPaint,
      }),
    [endPaint, trackFinger],
  );

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // A new query re-ranks everything; always show the best match first.
  useEffect(() => {
    scrollY.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [deferredQuery]);

  // ---- sheet -------------------------------------------------------------

  const sheetY = useRef(new Animated.Value(sheetHeight)).current;
  const caret = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    if (disabled) return;
    sheetY.setValue(sheetHeight);
    setVisible(true);
    Animated.parallel([
      Animated.spring(sheetY, {
        toValue: 0,
        damping: 24,
        stiffness: 240,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(caret, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [caret, disabled, sheetHeight, sheetY]);

  const close = useCallback(() => {
    endPaint();
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: sheetHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(caret, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setQuery('');
      setToast(null);
    });
  }, [caret, endPaint, sheetHeight, sheetY]);

  const dragToClose = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => sheetY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 120 || g.vy > 1.1) close();
          else
            Animated.spring(sheetY, {
              toValue: 0,
              damping: 20,
              stiffness: 260,
              useNativeDriver: true,
            }).start();
        },
      }),
    [close, sheetY],
  );

  // ---- clear with undo ----------------------------------------------------

  const toastAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    toastAnim.setValue(0);
    Animated.spring(toastAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast, toastAnim]);

  const clearAll = () => {
    if (!value.length) return;
    setToast({ message: `Cleared ${value.length}`, undo: value });
    commit([]);
  };

  // ---- tray ---------------------------------------------------------------

  const trayRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const prevCount = useRef(value.length);
  const onTrayContentChange = () => {
    if (value.length > prevCount.current)
      trayRef.current?.scrollToEnd({ animated: true });
    prevCount.current = value.length;
  };

  const reveal = (v: V) => {
    const i = rows.findIndex(r => r.kind === 'option' && r.option.value === v);
    if (i >= 0)
      listRef.current?.scrollToOffset({
        offset: Math.max(0, offsets[i] - OPTION_ROW_HEIGHT),
        animated: true,
      });
  };

  // ---- render -------------------------------------------------------------

  const q = query.trim();
  const optionRows = rows.filter(
    (r): r is Extract<Row<V>, { kind: 'option' }> => r.kind === 'option',
  );
  const matchValues = optionRows
    .filter(r => !r.option.disabled)
    .map(r => r.option.value);
  const allMatchesSelected =
    matchValues.length > 0 && matchValues.every(v => orderOf.has(v));
  const canCreate =
    !!onCreateOption &&
    !!q &&
    !options.some(o => o.label.toLowerCase() === q.toLowerCase());

  const renderRow = ({ item, index }: ListRenderItemInfo<Row<V>>) => {
    if (item.kind === 'header') {
      const picked = item.values.filter(v => orderOf.has(v)).length;
      const all = picked === item.values.length && picked > 0;
      return (
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerText, { color: theme.textFaint }]}>
            {item.group.toUpperCase()}
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => setMany(item.values)}
            accessibilityRole="button"
            accessibilityLabel={`${all ? 'Deselect' : 'Select'} all in ${
              item.group
            }`}
            style={styles.headerAction}
          >
            {picked > 0 && (
              <Text style={[styles.headerCount, { color: theme.accent }]}>
                {picked}/{item.values.length}
              </Text>
            )}
            <Text style={[styles.headerActionText, { color: theme.accent }]}>
              {all ? 'Deselect all' : 'Select all'}
            </Text>
          </Pressable>
        </View>
      );
    }
    const { option } = item;
    return (
      <OptionRow
        index={index}
        label={option.label}
        description={option.description}
        glyph={option.icon ?? initials(option.label)}
        tint={option.tint}
        ranges={item.ranges}
        selected={orderOf.has(option.value)}
        order={orderOf.get(option.value)}
        disabled={option.disabled}
        theme={theme}
        onToggle={i => {
          const r = layoutRef.current.rows[i];
          if (r?.kind === 'option') toggleValue(r.option.value);
        }}
        onPaintStart={startPaint}
        onPressOut={onRowPressOut}
      />
    );
  };

  const counterText =
    max != null ? `${value.length} / ${max}` : `${value.length} selected`;
  const atLimit = max != null && value.length >= max;

  return (
    <View style={style}>
      {/* ---------- closed field ---------- */}
      <Pressable
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? title}: ${
          selectedOptions.length
            ? selectedOptions.map(o => o.label).join(', ')
            : placeholder
        }`}
        // The inline × buttons are unreachable inside an accessible parent, so
        // screen readers get them as custom actions instead.
        accessibilityActions={selectedOptions.map(o => ({
          name: `remove:${o.value}`,
          label: `Remove ${o.label}`,
        }))}
        onAccessibilityAction={e => {
          const o = selectedOptions.find(
            x => `remove:${x.value}` === e.nativeEvent.actionName,
          );
          if (o) toggleValue(o.value);
        }}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: theme.surface,
            borderColor: visible ? theme.accent : theme.border,
            borderRadius: theme.radius,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        {label ? (
          <Text style={[styles.triggerLabel, { color: theme.textMuted }]}>
            {label}
          </Text>
        ) : null}
        <View style={styles.triggerBody}>
          <View style={styles.triggerChips}>
            {selectedOptions.length === 0 ? (
              <Text style={[styles.placeholder, { color: theme.textFaint }]}>
                {placeholder}
              </Text>
            ) : (
              <>
                {selectedOptions.slice(0, maxTriggerChips).map(o => (
                  <View
                    key={String(o.value)}
                    style={[styles.chip, { backgroundColor: theme.accentSoft }]}
                  >
                    <Text style={styles.chipIcon}>
                      {o.icon ?? initials(o.label)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.chipText, { color: theme.text }]}
                    >
                      {o.label}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() => toggleValue(o.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${o.label}`}
                    >
                      <Text style={[styles.chipX, { color: theme.textMuted }]}>
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ))}
                {selectedOptions.length > maxTriggerChips && (
                  <View
                    style={[styles.more, { backgroundColor: theme.accent }]}
                  >
                    <Text style={[styles.moreText, { color: theme.onAccent }]}>
                      +{selectedOptions.length - maxTriggerChips}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
          <Animated.Text
            style={[
              styles.caret,
              {
                color: theme.textMuted,
                transform: [
                  {
                    rotate: caret.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            ⌄
          </Animated.Text>
        </View>
      </Pressable>

      {/* ---------- sheet ---------- */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.backdrop,
              opacity: sheetY.interpolate({
                inputRange: [0, sheetHeight],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: theme.surface,
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View {...dragToClose.panHandlers}>
              <View
                style={[styles.grabber, { backgroundColor: theme.border }]}
              />
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {title}
                </Text>
                <Animated.View
                  style={[
                    styles.counter,
                    {
                      backgroundColor: atLimit
                        ? theme.accent
                        : theme.surfaceAlt,
                      transform: [{ translateX: shake }],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.counterText,
                      { color: atLimit ? theme.onAccent : theme.textMuted },
                    ]}
                  >
                    {counterText}
                  </Text>
                  {max != null && (
                    <View
                      style={[styles.meter, { backgroundColor: theme.border }]}
                    >
                      <View
                        style={[
                          styles.meterFill,
                          {
                            width: `${Math.min(
                              100,
                              (value.length / max) * 100,
                            )}%`,
                            backgroundColor: atLimit
                              ? theme.onAccent
                              : theme.accent,
                          },
                        ]}
                      />
                    </View>
                  )}
                </Animated.View>
              </View>
            </View>

            <View
              style={[styles.search, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={[styles.searchIcon, { color: theme.textFaint }]}>
                ⌕
              </Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={theme.textFaint}
                style={[styles.searchInput, { color: theme.text }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel="Search options"
              />
              {query ? (
                <Pressable
                  hitSlop={10}
                  onPress={() => setQuery('')}
                  accessibilityLabel="Clear search"
                >
                  <Text
                    style={[styles.searchClear, { color: theme.textMuted }]}
                  >
                    ×
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Fixed-height tray so the list never jumps under a dragging finger. */}
            <ScrollView
              ref={trayRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tray}
              contentContainerStyle={styles.trayContent}
              onContentSizeChange={onTrayContentChange}
              keyboardShouldPersistTaps="handled"
            >
              {selectedOptions.length === 0 ? (
                <Text style={[styles.trayEmpty, { color: theme.textFaint }]}>
                  Nothing picked yet: tap a row, or hold and drag to pick
                  several
                </Text>
              ) : (
                selectedOptions.map((o, i) => (
                  <Pressable
                    key={String(o.value)}
                    onPress={() => reveal(o.value)}
                    accessibilityLabel={`${o.label}, pick ${
                      i + 1
                    }. Tap to show in list`}
                    accessibilityActions={[
                      { name: 'remove', label: `Remove ${o.label}` },
                    ]}
                    onAccessibilityAction={e =>
                      e.nativeEvent.actionName === 'remove' &&
                      toggleValue(o.value)
                    }
                    style={[
                      styles.trayChip,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.surface,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.trayOrder,
                        { backgroundColor: theme.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.trayOrderText,
                          { color: theme.onAccent },
                        ]}
                      >
                        {i + 1}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.chipText, { color: theme.text }]}
                    >
                      {o.label}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() => toggleValue(o.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${o.label}`}
                    >
                      <Text style={[styles.chipX, { color: theme.textMuted }]}>
                        ×
                      </Text>
                    </Pressable>
                  </Pressable>
                ))
              )}
            </ScrollView>

            {q ? (
              <View style={[styles.actions, { borderColor: theme.border }]}>
                <Text style={[styles.actionsMeta, { color: theme.textFaint }]}>
                  {matchCount} result{matchCount === 1 ? '' : 's'}
                </Text>
                <View style={styles.actionsRight}>
                  {canCreate && (
                    <Pressable
                      onPress={() => {
                        const created = onCreateOption!(q);
                        if (created) {
                          const [next, ok] = addValues(valueRef.current, [
                            created.value,
                          ]);
                          if (ok) commit(next);
                          else signalLimit();
                        }
                        setQuery('');
                      }}
                      style={[styles.pill, { backgroundColor: theme.accent }]}
                    >
                      <Text
                        style={[styles.pillText, { color: theme.onAccent }]}
                      >
                        + Create “{q}”
                      </Text>
                    </Pressable>
                  )}
                  {matchValues.length > 0 && (
                    <Pressable
                      onPress={() => setMany(matchValues)}
                      style={[
                        styles.pill,
                        { backgroundColor: theme.accentSoft },
                      ]}
                    >
                      <Text style={[styles.pillText, { color: theme.accent }]}>
                        {allMatchesSelected ? 'Deselect all' : 'Select all'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            <View
              ref={listWrapRef}
              style={styles.flex}
              collapsable={false}
              onLayout={e => (viewportH.current = e.nativeEvent.layout.height)}
              {...paintResponder.panHandlers}
            >
              <FlatList
                ref={listRef}
                data={rows}
                keyExtractor={r => r.key}
                renderItem={renderRow}
                extraData={orderOf}
                getItemLayout={(_d, index) => ({
                  index,
                  offset: offsets[index] ?? 0,
                  length:
                    rows[index]?.kind === 'header'
                      ? HEADER_HEIGHT
                      : OPTION_ROW_HEIGHT,
                })}
                scrollEnabled={!painting}
                keyboardShouldPersistTaps="handled"
                // RN Web dismisses on *any* scroll, incl. our scroll-to-top while typing.
                keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  scrollY.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: LIST_BOTTOM_PADDING }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>
                      No matches
                    </Text>
                    <Text
                      style={[styles.emptyBody, { color: theme.textMuted }]}
                    >
                      Nothing matches “{q}”.
                      {onCreateOption ? ' Create it above.' : ''}
                    </Text>
                  </View>
                }
              />
            </View>

            {toast && (
              <Animated.View
                style={[
                  styles.toast,
                  {
                    backgroundColor: theme.text,
                    opacity: toastAnim,
                    transform: [
                      {
                        translateY: toastAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={[styles.toastText, { color: theme.surface }]}>
                  {toast.message}
                </Text>
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    commit(toast.undo);
                    setToast(null);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.toastAction, { color: theme.accent }]}>
                    UNDO
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            <View style={[styles.footer, { borderColor: theme.border }]}>
              <Pressable
                onPress={clearAll}
                disabled={!value.length}
                style={[styles.secondary, !value.length && styles.dimmed]}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryText, { color: theme.text }]}>
                  Clear
                </Text>
              </Pressable>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  {
                    backgroundColor: theme.text,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.primaryText, { color: theme.surface }]}>
                  {value.length ? `Done · ${value.length}` : 'Done'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  trigger: {
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  triggerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  triggerBody: { flexDirection: 'row', alignItems: 'center' },
  triggerChips: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  placeholder: { fontSize: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 10,
    height: 30,
    borderRadius: 15,
    maxWidth: 150,
    flexShrink: 1,
  },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  chipX: { fontSize: 18, lineHeight: 20, fontWeight: '500' },
  more: {
    height: 30,
    minWidth: 34,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  moreText: { fontSize: 13, fontWeight: '800' },
  caret: { fontSize: 20, marginLeft: 8, lineHeight: 22 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  counter: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 64,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  meter: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  meterFill: { height: '100%' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: { fontSize: 20, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  searchClear: { fontSize: 22, paddingHorizontal: 4 },

  tray: { height: 56, flexGrow: 0 },
  trayContent: { alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  trayEmpty: { fontSize: 13 },
  trayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 5,
    paddingRight: 10,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 180,
  },
  trayOrder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayOrderText: { fontSize: 12, fontWeight: '800' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  actionsMeta: { fontSize: 13, fontWeight: '600' },
  actionsRight: { flexDirection: 'row', gap: 8, flexShrink: 1 },
  pill: {
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 30,
    justifyContent: 'center',
    flexShrink: 1,
  },
  pillText: { fontSize: 13, fontWeight: '700' },

  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCount: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  headerActionText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, marginTop: 6, textAlign: 'center' },

  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toastText: { fontSize: 14, fontWeight: '600' },
  toastAction: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondary: { height: 52, paddingHorizontal: 20, justifyContent: 'center' },
  dimmed: { opacity: 0.35 },
  secondaryText: { fontSize: 16, fontWeight: '700' },
  primary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});

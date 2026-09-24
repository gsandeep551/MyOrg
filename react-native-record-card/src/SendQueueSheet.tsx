import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { resolveTheme, type RecordCardTheme } from './theme';

export interface QueueItem {
  id: string;
  /** e.g. `#1671683 · Rig Ticket` */
  title: string;
  /** e.g. `OXY USA Inc. · DOVE 8C-13HZ · 09/21` */
  subtitle?: string;
  /** Pre-formatted, e.g. `$4,830.00`. */
  amount?: string;
}

export type QueueIconName =
  | 'ticket'
  | 'send'
  | 'check'
  | 'error'
  | 'offline'
  | 'close'
  | 'done';

export interface SendQueueSheetProps {
  visible: boolean;
  onClose: () => void;
  items: QueueItem[];
  /** Sends one item. Resolve on success; reject (optionally with an Error message) on failure. */
  send: (id: string) => Promise<void>;
  /** When `false`, sending is paused and the sheet says why. */
  online?: boolean;
  title?: string;
  /** Singular and plural nouns for labels, e.g. `['ticket', 'tickets']`. */
  noun?: [string, string];
  /** Pre-formatted total of all items, shown in the header. */
  total?: string;
  /** Called once a run finishes, with the ids that were sent and that failed. */
  onDone?: (result: { sent: string[]; failed: string[] }) => void;
  /** Close automatically this long after everything is sent. `0` keeps it open. */
  autoCloseMs?: number;
  /** Icons for the sheet. Defaults to plain glyphs; pass your vector icon set. */
  renderIcon?: (name: QueueIconName, color: string, size: number) => ReactNode;
  bottomInset?: number;
  /** The sheet is centred and capped at this width on tablets. */
  maxWidth?: number;
  theme?: Partial<RecordCardTheme>;
}

type ItemState = { status: 'idle' | 'sending' | 'sent' | 'failed'; error?: string };

const GLYPHS: Record<QueueIconName, string> = {
  ticket: '▤',
  send: '➤',
  check: '✓',
  error: '!',
  offline: '⌀',
  close: '✕',
  done: '✓',
};

/**
 * A bottom sheet for sending locally saved records to the server: pick
 * which ones, send them one by one with per-row progress, retry failures,
 * and wait politely while offline.
 */
export function SendQueueSheet({
  visible,
  onClose,
  items,
  send,
  online = true,
  title = 'Send tickets',
  noun = ['ticket', 'tickets'],
  total,
  onDone,
  autoCloseMs = 1400,
  renderIcon,
  bottomInset = 0,
  maxWidth = 560,
  theme: themeOverrides,
}: SendQueueSheetProps) {
  const scheme = useColorScheme();
  const theme = useMemo(
    () => resolveTheme(scheme, themeOverrides),
    [scheme, themeOverrides],
  );
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheetWidth = Math.min(windowWidth, maxWidth);
  const wide = windowWidth > maxWidth;
  const many = items.length > 1;
  const word = (n: number) => (n === 1 ? noun[0] : noun[1]);

  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map(i => i.id)));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, of: 0 });
  const [mounted, setMounted] = useState(visible);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const sheetY = useRef(new Animated.Value(windowHeight)).current;
  const bar = useRef(new Animated.Value(0)).current;

  // New items are selected by default; items that left the queue are forgotten.
  const known = useRef(new Set(items.map(i => i.id)));
  const ids = items.map(i => i.id).join('|');
  useEffect(() => {
    setSelected(prev => {
      const next = new Set<string>();
      items.forEach(i => {
        if (prev.has(i.id) || !known.current.has(i.id)) next.add(i.id);
      });
      return next;
    });
    known.current = new Set(items.map(i => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      sheetY.setValue(windowHeight);
      Animated.spring(sheetY, { toValue: 0, damping: 24, stiffness: 240, mass: 0.9, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(sheetY, {
        toValue: windowHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
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

  const stateOf = (id: string): ItemState => states[id] ?? { status: 'idle' };
  const pending = items.filter(i => stateOf(i.id).status !== 'sent');
  const failed = items.filter(i => stateOf(i.id).status === 'failed');
  const allSent = items.length > 0 && pending.length === 0;
  const targets = pending.filter(i => !many || selected.has(i.id));

  const run = useCallback(
    async (list: QueueItem[]) => {
      if (!list.length || running) return;
      setRunning(true);
      setProgress({ done: 0, of: list.length });
      bar.setValue(0);
      const sent: string[] = [];
      const bad: string[] = [];
      for (let n = 0; n < list.length; n++) {
        const { id } = list[n];
        setStates(s => ({ ...s, [id]: { status: 'sending' } }));
        try {
          await send(id);
          sent.push(id);
          setStates(s => ({ ...s, [id]: { status: 'sent' } }));
        } catch (e) {
          bad.push(id);
          setStates(s => ({
            ...s,
            [id]: { status: 'failed', error: e instanceof Error && e.message ? e.message : 'Couldn’t send' },
          }));
        }
        setProgress({ done: n + 1, of: list.length });
        Animated.timing(bar, {
          toValue: (n + 1) / list.length,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }
      setRunning(false);
      onDone?.({ sent, failed: bad });
    },
    [bar, onDone, running, send],
  );

  useEffect(() => {
    if (!allSent || !autoCloseMs || !visible) return;
    const t = setTimeout(() => onCloseRef.current(), autoCloseMs);
    return () => clearTimeout(t);
  }, [allSent, autoCloseMs, visible]);

  if (!mounted) return null;

  const icon = (name: QueueIconName, color: string, size: number) =>
    renderIcon ? (
      renderIcon(name, color, size)
    ) : (
      <Text style={{ color, fontSize: size * 0.8, fontWeight: '800', lineHeight: size, textAlign: 'center' }}>
        {GLYPHS[name]}
      </Text>
    );

  const allSelected = targets.length === pending.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pending.map(i => i.id)));
  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ---- header copy ---------------------------------------------------------
  const headerDetail = allSent
    ? `${items.length} ${word(items.length)} sent`
    : [`${pending.length} ${word(pending.length)} waiting to send`, total].filter(Boolean).join(' · ');

  // ---- primary button ------------------------------------------------------
  let cta: string;
  let ctaDisabled = false;
  let ctaList = targets;
  if (allSent) {
    cta = 'Done';
  } else if (!online) {
    cta = 'Waiting for connection';
    ctaDisabled = true;
  } else if (running) {
    cta = `Sending ${Math.min(progress.done + 1, progress.of)} of ${progress.of}…`;
    ctaDisabled = true;
  } else if (failed.length && failed.length === pending.length) {
    cta = `Retry ${failed.length} failed`;
    ctaList = failed;
  } else if (!targets.length) {
    cta = `Select ${noun[1]} to send`;
    ctaDisabled = true;
  } else if (many && targets.length < pending.length) {
    cta = `Send ${targets.length} selected`;
  } else {
    cta = `Send ${targets.length} ${word(targets.length)}`;
  }
  const onCta = () => (allSent ? onClose() : run(ctaList));

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.backdrop,
            opacity: sheetY.interpolate({ inputRange: [0, windowHeight * 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            width: sheetWidth,
            maxHeight: windowHeight * 0.85,
            backgroundColor: theme.surface,
            paddingBottom: 14 + bottomInset,
            transform: [{ translateY: sheetY }],
          },
          wide && styles.sheetWide,
        ]}
      >
        <View {...drag.panHandlers}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <View style={styles.head}>
            <View
              style={[
                styles.headIcon,
                { backgroundColor: allSent ? theme.tones.success.soft : theme.tones.accent.soft },
              ]}
            >
              {icon(allSent ? 'done' : 'send', allSent ? theme.tones.success.fg : theme.tones.accent.fg, 20)}
            </View>
            <View style={styles.headText}>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
                {allSent ? 'All sent' : title}
              </Text>
              <Text numberOfLines={2} style={[styles.detail, { color: theme.textMuted }]}>
                {headerDetail}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, { backgroundColor: pressed ? theme.pressed : theme.secondary }]}
            >
              {icon('close', theme.textMuted, 18)}
            </Pressable>
          </View>
        </View>

        {!online && !allSent && (
          <View style={[styles.banner, { backgroundColor: theme.tones.warning.wash, borderColor: theme.tones.warning.soft }]}>
            {icon('offline', theme.tones.warning.fg, 18)}
            <Text style={[styles.bannerText, { color: theme.tones.warning.fg }]}>
              You’re offline. {noun[1][0].toUpperCase() + noun[1].slice(1)} send automatically when you’re back online.
            </Text>
          </View>
        )}

        {many && !allSent && !running && pending.length > 1 && (
          <Pressable onPress={toggleAll} accessibilityRole="button" style={styles.selectAll} hitSlop={6}>
            <Text style={[styles.selectAllText, { color: theme.tones.accent.fg }]}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Text>
          </Pressable>
        )}

        <ScrollView bounces={false} style={styles.list} contentContainerStyle={styles.listContent}>
          {items.map(item => {
            const st = stateOf(item.id);
            const checkable = many && st.status !== 'sent' && !running;
            const checked = selected.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={checkable ? () => toggle(item.id) : undefined}
                disabled={!checkable}
                accessibilityRole={checkable ? 'checkbox' : undefined}
                accessibilityState={checkable ? { checked } : undefined}
                accessibilityLabel={[item.title, item.subtitle, item.amount, st.status === 'idle' ? '' : st.status]
                  .filter(Boolean)
                  .join(', ')}
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: st.status === 'failed' ? theme.tones.danger.soft : theme.border },
                  st.status === 'failed' && { backgroundColor: theme.tones.danger.wash },
                  pressed && checkable && { backgroundColor: theme.pressed },
                ]}
              >
                {many && (
                  <View
                    style={[
                      styles.check,
                      st.status === 'sent'
                        ? { backgroundColor: theme.tones.success.solid, borderColor: theme.tones.success.solid }
                        : checked
                          ? { backgroundColor: theme.accent, borderColor: theme.accent }
                          : { borderColor: theme.textFaint },
                      !checkable && st.status !== 'sent' && styles.dim,
                    ]}
                  >
                    {(checked || st.status === 'sent') &&
                      icon('check', st.status === 'sent' ? '#fff' : theme.onAccent, 14)}
                  </View>
                )}
                {/* With checkboxes the checkbox leads the row; the icon would crowd the title. */}
                {!many && (
                  <View style={[styles.tile, { backgroundColor: theme.tones.accent.soft }]}>
                    {icon('ticket', theme.tones.accent.fg, 20)}
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>
                    {item.title}
                  </Text>
                  {!!item.subtitle && (
                    <Text numberOfLines={2} style={[styles.rowSub, { color: theme.textMuted }]}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
                <View style={styles.rowEnd}>
                  {!!item.amount && (
                    <Text style={[styles.amount, { color: theme.text }]}>{item.amount}</Text>
                  )}
                  {st.status === 'sending' && (
                    <View style={styles.stateLine}>
                      <ActivityIndicator size="small" color={theme.tones.accent.solid} />
                      <Text style={[styles.stateText, { color: theme.textMuted }]}>Sending</Text>
                    </View>
                  )}
                  {st.status === 'sent' && (
                    <View style={styles.stateLine}>
                      {icon('check', theme.tones.success.fg, 14)}
                      <Text style={[styles.stateText, { color: theme.tones.success.fg }]}>Sent</Text>
                    </View>
                  )}
                  {st.status === 'failed' && !running && (
                    <Pressable
                      onPress={() => run([item])}
                      disabled={!online}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Retry ${item.title}`}
                      style={styles.stateLine}
                    >
                      {icon('error', theme.tones.danger.fg, 14)}
                      <Text style={[styles.stateText, styles.retry, { color: theme.tones.danger.fg }]}>
                        Retry
                      </Text>
                    </Pressable>
                  )}
                </View>
                {st.status === 'failed' && !!st.error && (
                  <Text
                    style={[styles.error, { color: theme.tones.danger.fg, paddingLeft: many ? 34 : 52 }]}
                    numberOfLines={2}
                  >
                    {st.error}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={onCta}
          disabled={ctaDisabled && !allSent}
          accessibilityRole="button"
          accessibilityState={{ disabled: ctaDisabled, busy: running }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: allSent
                ? theme.tones.success.solid
                : ctaDisabled && !running
                  ? theme.secondary
                  : theme.accent,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {running && (
            <Animated.View
              style={[
                styles.ctaFill,
                {
                  backgroundColor: theme.tones.accent.fg,
                  width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          )}
          {!running && !ctaDisabled && !allSent && icon('send', theme.onAccent, 18)}
          <Text
            style={[
              styles.ctaText,
              { color: allSent ? '#fff' : ctaDisabled && !running ? theme.textFaint : theme.onAccent },
            ]}
          >
            {cta}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  headIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  detail: { fontSize: 13, marginTop: 1, fontVariant: ['tabular-nums'] },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  selectAll: { alignSelf: 'flex-end', marginRight: 20, marginBottom: 2 },
  selectAllText: { fontSize: 13, fontWeight: '700' },

  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.4 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  amount: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 18 },
  stateText: { fontSize: 12, fontWeight: '700' },
  retry: { textDecorationLine: 'underline' },
  error: { width: '100%', fontSize: 12, marginTop: -4 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaFill: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.18 },
  ctaText: { fontSize: 16, fontWeight: '800' },
});

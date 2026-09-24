import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
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
import { ActionIcon } from './components/ActionIcon';
import { resolveTheme, type RecordCardTheme, type Tone } from './theme';

export interface SheetAction {
  key: string;
  label: string;
  /** Second line under the label (list layout only). */
  description?: string;
  /** Emoji / 1–2 characters, or any element (e.g. a vector icon). Defaults to the label's initial. */
  icon?: ReactNode;
  /** Colours the icon tile and label. `danger` actions are also separated from the rest. */
  tone?: Tone;
  disabled?: boolean;
  /** Shown instead of `description` while disabled, so users know *why*. */
  disabledReason?: string;
  /** Small pill after the label, e.g. `"3"` or `"New"`. */
  badge?: string;
  /**
   * Makes the action two-step: the first tap arms it and swaps the label for
   * this text (e.g. "Tap again to delete"); a second tap within 3 s runs it.
   * Use it for destructive actions instead of a confirmation dialog.
   */
  confirmLabel?: string;
  /** Keep the sheet open after running (e.g. toggles). */
  keepOpen?: boolean;
  onPress: () => void;
}

export interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  actions: SheetAction[];
  title?: string;
  subtitle?: string;
  /** Rendered under the title, above the actions. */
  header?: ReactNode;
  /**
   * `list` (default): full-width rows with icon, label and description.
   * `grid`: icon tiles, 3 per row (4 on wide screens). Good for 6+ short actions.
   */
  layout?: 'list' | 'grid';
  /** Label of the bottom button. `null` hides it (tap outside or drag down still closes). */
  cancelLabel?: string | null;
  /** Bottom safe-area inset, e.g. from `useSafeAreaInsets().bottom`. */
  bottomInset?: number;
  /** The sheet is centred and capped at this width on tablets. */
  maxWidth?: number;
  theme?: Partial<RecordCardTheme>;
}

const CONFIRM_WINDOW_MS = 3000;

/**
 * A bottom sheet of actions. The sheet closes *before* the chosen action runs,
 * so navigation or a new modal opened by the action never fights the exit
 * animation.
 */
export function ActionSheet({
  visible,
  onClose,
  actions,
  title,
  subtitle,
  header,
  layout = 'list',
  cancelLabel = 'Cancel',
  bottomInset = 0,
  maxWidth = 640,
  theme: themeOverrides,
}: ActionSheetProps) {
  const scheme = useColorScheme();
  const theme = useMemo(
    () => resolveTheme(scheme, themeOverrides),
    [scheme, themeOverrides],
  );
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheetWidth = Math.min(windowWidth, maxWidth);
  const wide = windowWidth > maxWidth;

  const [mounted, setMounted] = useState(visible);
  const [armed, setArmed] = useState<string | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const sheetY = useRef(new Animated.Value(windowHeight)).current;
  const stagger = useRef(new Animated.Value(0)).current;

  // Danger actions sink to their own group at the bottom, away from thumbs.
  const groups = useMemo(() => {
    const safe = actions.filter(a => a.tone !== 'danger');
    const danger = actions.filter(a => a.tone === 'danger');
    return [safe, danger].filter(g => g.length);
  }, [actions]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setArmed(null);
      sheetY.setValue(windowHeight);
      stagger.setValue(0);
      Animated.parallel([
        Animated.spring(sheetY, {
          toValue: 0,
          damping: 24,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(stagger, {
          toValue: 1,
          duration: 360,
          delay: 60,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.timing(sheetY, {
        toValue: windowHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        // Reopened while closing: the spring above has taken over.
        if (visibleRef.current) return;
        setMounted(false);
        const run = pending.current;
        pending.current = null;
        run?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), CONFIRM_WINDOW_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const dragToClose = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) =>
          // Rubber-band upward drags instead of letting the sheet detach.
          sheetY.setValue(g.dy > 0 ? g.dy : g.dy / 6),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 90 || g.vy > 1.1) onCloseRef.current();
          else
            Animated.spring(sheetY, {
              toValue: 0,
              damping: 20,
              stiffness: 260,
              useNativeDriver: true,
            }).start();
        },
      }),
    [sheetY],
  );

  const run = useCallback(
    (action: SheetAction) => {
      if (action.disabled) return;
      if (action.confirmLabel && armed !== action.key) {
        setArmed(action.key);
        AccessibilityInfo.announceForAccessibility?.(action.confirmLabel);
        return;
      }
      setArmed(null);
      if (action.keepOpen) {
        action.onPress();
        return;
      }
      pending.current = action.onPress;
      onClose();
    },
    [armed, onClose],
  );

  if (!mounted) return null;

  let index = 0;
  const entrance = () => {
    // Each row slides in a beat after the previous one.
    const i = index++;
    const start = Math.min(0.08 * i, 0.5);
    return {
      opacity: stagger.interpolate({
        inputRange: [start, start + 0.5],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: stagger.interpolate({
            inputRange: [start, start + 0.5],
            outputRange: [14, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  };

  const gridColumns = sheetWidth >= 560 ? 4 : 3;

  const renderRow = (a: SheetAction) => {
    const tone = theme.tones[a.tone ?? 'neutral'];
    const isArmed = armed === a.key;
    const labelColor = a.tone && a.tone !== 'neutral' ? tone.fg : theme.text;
    const detail = a.disabled ? a.disabledReason ?? a.description : a.description;
    return (
      <Animated.View key={a.key} style={entrance()}>
        <Pressable
          onPress={() => run(a)}
          disabled={a.disabled}
          accessibilityRole="button"
          accessibilityLabel={isArmed ? a.confirmLabel : a.label}
          accessibilityHint={
            a.disabled ? a.disabledReason : isArmed ? 'Double tap to confirm' : a.description
          }
          accessibilityState={{ disabled: !!a.disabled }}
          style={({ pressed }) => [
            styles.row,
            isArmed && { backgroundColor: tone.soft },
            pressed && !isArmed && { backgroundColor: theme.pressed },
            a.disabled && styles.disabled,
          ]}
        >
          <ActionIcon
            icon={a.icon}
            label={a.label}
            tone={a.tone ?? 'neutral'}
            theme={theme}
            solid={isArmed}
          />
          <View style={styles.rowText}>
            <View style={styles.labelLine}>
              <Text
                numberOfLines={1}
                style={[styles.rowLabel, { color: labelColor }]}
              >
                {isArmed ? a.confirmLabel : a.label}
              </Text>
              {!!a.badge && !isArmed && (
                <View style={[styles.badge, { backgroundColor: tone.soft }]}>
                  <Text style={[styles.badgeText, { color: tone.fg }]}>
                    {a.badge}
                  </Text>
                </View>
              )}
            </View>
            {!!detail && !isArmed && (
              <Text
                numberOfLines={1}
                style={[styles.rowDetail, { color: theme.textFaint }]}
              >
                {detail}
              </Text>
            )}
          </View>
          <Text style={[styles.chevron, { color: theme.textFaint }]}>
            {a.disabled ? '' : '›'}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderTile = (a: SheetAction) => {
    const tone = theme.tones[a.tone ?? 'neutral'];
    const isArmed = armed === a.key;
    return (
      <Animated.View
        key={a.key}
        style={[{ width: `${100 / gridColumns}%` }, entrance()]}
      >
        <Pressable
          onPress={() => run(a)}
          disabled={a.disabled}
          accessibilityRole="button"
          accessibilityLabel={isArmed ? a.confirmLabel : a.label}
          accessibilityHint={a.disabled ? a.disabledReason : undefined}
          accessibilityState={{ disabled: !!a.disabled }}
          style={({ pressed }) => [
            styles.tile,
            { borderRadius: theme.radius },
            isArmed && { backgroundColor: tone.soft },
            pressed && !isArmed && { backgroundColor: theme.pressed },
            a.disabled && styles.disabled,
          ]}
        >
          <View>
            <ActionIcon
              icon={a.icon}
              label={a.label}
              tone={a.tone ?? 'neutral'}
              theme={theme}
              size={52}
              solid={isArmed}
            />
            {!!a.badge && (
              <View
                style={[
                  styles.tileBadge,
                  { backgroundColor: tone.solid, borderColor: theme.surface },
                ]}
              >
                <Text style={[styles.badgeText, { color: '#fff' }]}>
                  {a.badge}
                </Text>
              </View>
            )}
          </View>
          <Text
            numberOfLines={2}
            style={[
              styles.tileLabel,
              {
                color:
                  a.tone && a.tone !== 'neutral' ? tone.fg : theme.text,
              },
            ]}
          >
            {isArmed ? a.confirmLabel : a.label}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.backdrop,
            opacity: sheetY.interpolate({
              inputRange: [0, windowHeight * 0.6],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            width: sheetWidth,
            maxHeight: windowHeight * 0.85,
            backgroundColor: theme.surface,
            paddingBottom: 12 + bottomInset,
            transform: [{ translateY: sheetY }],
          },
          wide && styles.sheetWide,
        ]}
      >
        <View {...dragToClose.panHandlers}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          {(!!title || !!subtitle) && (
            <View style={styles.titleBlock}>
              {!!title && (
                <Text
                  accessibilityRole="header"
                  numberOfLines={1}
                  style={[styles.title, { color: theme.text }]}
                >
                  {title}
                </Text>
              )}
              {!!subtitle && (
                <Text
                  numberOfLines={2}
                  style={[styles.subtitle, { color: theme.textMuted }]}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          )}
          {header}
        </View>

        <ScrollView
          bounces={false}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group, gi) => (
            <View key={gi}>
              {gi > 0 && (
                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />
              )}
              {layout === 'grid' ? (
                <View style={styles.grid}>{group.map(renderTile)}</View>
              ) : (
                group.map(renderRow)
              )}
            </View>
          ))}
        </ScrollView>

        {cancelLabel !== null && (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: pressed ? theme.pressed : theme.secondary },
            ]}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>
              {cancelLabel}
            </Text>
          </Pressable>
        )}
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
  sheetWide: {
    bottom: 16,
    borderRadius: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 4,
  },
  titleBlock: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 6 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, marginTop: 2 },
  body: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 14,
  },
  rowText: { flex: 1, minWidth: 0 },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  rowDetail: { fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '300', width: 12 },
  badge: {
    borderRadius: 9,
    paddingHorizontal: 7,
    height: 18,
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.42 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4 },
  tile: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 8,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },
  tileBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  cancel: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '700' },
});

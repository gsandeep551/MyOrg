import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Badge, NavIcon } from './components/NavIcon';
import { resolveTheme, type NavTheme } from './theme';
import type { NavItem } from './types';

export interface IslandTabBarProps<K extends string = string> {
  items: NavItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  /** Tapping the active tab again, e.g. to scroll its list to the top. */
  onReselect?: (key: K) => void;
  /**
   * `always` (default): every tab shows its label.
   * `active`: only the active tab's label shows, for a quieter bar.
   */
  labels?: 'always' | 'active';
  /**
   * A raised round button in the middle of the bar for the screen's main
   * action (e.g. New ticket). Needs an even number of tabs.
   */
  action?: { label: string; icon?: ReactNode; onPress: () => void };
  /** Slides the bar off screen; pair with `useHideOnScroll`. */
  hidden?: boolean;
  /** Bottom safe-area inset, e.g. from `useSafeAreaInsets().bottom`. */
  bottomInset?: number;
  /** `false` renders the bar in place instead of floating over the screen. */
  floating?: boolean;
  /** The bar is centred and capped at this width on tablets. */
  maxWidth?: number;
  theme?: Partial<NavTheme>;
  style?: StyleProp<ViewStyle>;
}

const BAR_HEIGHT = 64;
const GAP = 12;

/**
 * A floating "island" tab bar: a rounded pill that hovers above the content
 * with a highlight that slides to the active tab.
 */
export function IslandTabBar<K extends string = string>({
  items,
  activeKey,
  onChange,
  onReselect,
  labels = 'always',
  action,
  hidden = false,
  bottomInset = 0,
  floating = true,
  maxWidth = 480,
  theme: themeOverrides,
  style,
}: IslandTabBarProps<K>) {
  const scheme = useColorScheme();
  const theme = useMemo(
    () => resolveTheme(scheme, themeOverrides),
    [scheme, themeOverrides],
  );
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(0, items.findIndex(i => i.key === activeKey));

  // Slots: the tabs, with the action button taking the middle slot.
  const half = action ? Math.ceil(items.length / 2) : items.length;
  const slots = items.length + (action ? 1 : 0);
  const slotWidth = width / Math.max(1, slots);
  const slotOf = (i: number) => (action && i >= half ? i + 1 : i);

  const x = useRef(new Animated.Value(0)).current;
  const hide = useRef(new Animated.Value(hidden ? 1 : 0)).current;
  const focus = useMemo(
    () => items.map((_, i) => new Animated.Value(i === activeIndex ? 1 : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length],
  );
  const bounce = useMemo(() => items.map(() => new Animated.Value(1)), [items.length]);
  const placed = useRef(false);

  useEffect(() => {
    if (!width) return;
    const to = slotOf(activeIndex) * slotWidth;
    // Jump into place on first layout; slide after that.
    if (!placed.current) {
      x.setValue(to);
      placed.current = true;
    } else {
      Animated.spring(x, { toValue: to, damping: 20, stiffness: 220, mass: 0.8, useNativeDriver: true }).start();
    }
    focus.forEach((v, i) =>
      Animated.timing(v, { toValue: i === activeIndex ? 1 : 0, duration: 180, useNativeDriver: true }).start(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, width, slotWidth]);

  useEffect(() => {
    Animated.spring(hide, { toValue: hidden ? 1 : 0, damping: 22, stiffness: 240, useNativeDriver: true }).start();
  }, [hidden, hide]);

  const press = (item: NavItem<K>, i: number) => {
    if (item.disabled) return;
    bounce[i].setValue(0.82);
    Animated.spring(bounce[i], { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
    if (item.key === activeKey) onReselect?.(item.key);
    else onChange(item.key);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const bottom = GAP + bottomInset;

  const tab = (item: NavItem<K>, i: number) => {
    const active = i === activeIndex;
    const color = active ? theme.active : theme.textMuted;
    const showLabel = labels === 'always' || active;
    return (
      <Pressable
        key={item.key}
        onPress={() => press(item, i)}
        disabled={item.disabled}
        accessibilityRole="tab"
        accessibilityLabel={
          typeof item.badge === 'number' && item.badge > 0 ? `${item.label}, ${item.badge} new` : item.label
        }
        accessibilityState={{ selected: active, disabled: !!item.disabled }}
        style={[styles.tab, item.disabled && styles.disabled]}
      >
        <Animated.View style={{ transform: [{ scale: bounce[i] }] }}>
          <NavIcon item={item} active={active} color={color} size={22} />
          {item.badge != null && (
            <View style={styles.badgeAnchor}>
              <Badge value={item.badge} theme={theme} ring={theme.surface} />
            </View>
          )}
        </Animated.View>
        {showLabel && (
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.label,
              { color, fontWeight: active ? '700' : '500' },
              labels === 'active' && {
                opacity: focus[i],
                transform: [{ translateY: focus[i].interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
              },
            ]}
          >
            {item.label}
          </Animated.Text>
        )}
      </Pressable>
    );
  };

  const children: ReactNode[] = items.map(tab);
  if (action) {
    children.splice(
      half,
      0,
      <View key="__action" style={styles.tab}>
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.accent,
              borderColor: theme.surface,
              shadowColor: theme.shadow,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          {typeof action.icon === 'string' || action.icon == null ? (
            <Text style={[styles.actionGlyph, { color: theme.onAccent }]}>{action.icon ?? '+'}</Text>
          ) : (
            action.icon
          )}
        </Pressable>
      </View>,
    );
  }

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        floating ? [styles.floating, { bottom }] : styles.inline,
        {
          transform: [
            {
              translateY: hide.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_HEIGHT + bottom + 24] }),
            },
          ],
        },
        style,
      ]}
    >
      <View
        accessibilityRole="tabbar"
        onLayout={onLayout}
        style={[
          styles.bar,
          {
            maxWidth,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        {width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: slotWidth - 12,
                backgroundColor: theme.accentSoft,
                transform: [{ translateX: x }],
              },
            ]}
          >
            <View style={[styles.indicatorBar, { backgroundColor: theme.accent }]} />
          </Animated.View>
        )}
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  inline: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: GAP },
  bar: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  indicator: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: (BAR_HEIGHT - 12) / 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  indicatorBar: { width: 18, height: 3, borderRadius: 2, marginBottom: 3 },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: 11, letterSpacing: 0.1 },
  badgeAnchor: { position: 'absolute', top: -5, right: -10 },
  disabled: { opacity: 0.4 },
  action: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 4,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  actionGlyph: { fontSize: 26, fontWeight: '600', lineHeight: 28 },
});

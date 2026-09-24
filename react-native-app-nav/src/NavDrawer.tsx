import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { Badge, NavIcon } from './components/NavIcon';
import { resolveTheme, type NavTheme } from './theme';
import type { NavItem } from './types';

export interface DrawerProfile {
  name: string;
  /** Role, email or crew, under the name. */
  subtitle?: string;
  /** Photo or custom avatar. Defaults to the name's initials. */
  avatar?: ReactNode;
  /** Brand logo shown above the profile. */
  logo?: ReactNode;
}

export interface DrawerStatus {
  online: boolean;
  /** Defaults to "Online" / "Offline". */
  label?: string;
  /** e.g. "Synced 2 min ago" or "3 tickets waiting to sync". */
  detail?: string;
  /** e.g. `{ label: 'Sync now', onPress }`, shown beside the status. */
  action?: { label: string; onPress: () => void };
}

export interface NavDrawerProps<K extends string = string> {
  visible: boolean;
  onClose: () => void;
  items: NavItem<K>[];
  activeKey: K;
  /** Called right away; the drawer closes while the new screen renders behind it. */
  onSelect: (key: K) => void;
  profile?: DrawerProfile;
  status?: DrawerStatus;
  /** Shows a Log out button that needs a second tap within 3 s. */
  onLogout?: () => void;
  logoutLabel?: string;
  /** Shown while Log out is armed, e.g. "3 unsynced tickets stay on this device". */
  logoutWarning?: string;
  /** Small text at the very bottom, e.g. the app version. */
  footnote?: string;
  side?: 'left' | 'right';
  /**
   * `island` (default): a rounded panel floating with a margin around it.
   * `edge`: a classic full-height panel attached to the screen edge.
   */
  variant?: 'island' | 'edge';
  width?: number;
  topInset?: number;
  bottomInset?: number;
  theme?: Partial<NavTheme>;
}

const CONFIRM_WINDOW_MS = 3000;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

export function NavDrawer<K extends string = string>({
  visible,
  onClose,
  items,
  activeKey,
  onSelect,
  profile,
  status,
  onLogout,
  logoutLabel = 'Log out',
  logoutWarning,
  footnote,
  side = 'left',
  variant = 'island',
  width: widthProp,
  topInset = 0,
  bottomInset = 0,
  theme: themeOverrides,
}: NavDrawerProps<K>) {
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(scheme, themeOverrides), [scheme, themeOverrides]);
  const { width: windowWidth } = useWindowDimensions();
  const island = variant === 'island';
  const margin = island ? 12 : 0;
  const width = Math.min(widthProp ?? 320, windowWidth * 0.86);
  const offscreen = (width + margin + 24) * (side === 'left' ? -1 : 1);

  const [mounted, setMounted] = useState(visible);
  const [armed, setArmed] = useState(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const x = useRef(new Animated.Value(offscreen)).current;
  const stagger = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setArmed(false);
      x.setValue(offscreen);
      stagger.setValue(0);
      Animated.parallel([
        Animated.spring(x, { toValue: 0, damping: 26, stiffness: 260, mass: 0.9, useNativeDriver: true }),
        Animated.timing(stagger, {
          toValue: 1,
          duration: 380,
          delay: 60,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.timing(x, {
        toValue: offscreen,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (!visibleRef.current) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!mounted || !status?.online) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [mounted, status?.online, pulse]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dir = side === 'left' ? -1 : 1;
  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => {
          const d = g.dx * dir;
          // Follows the finger toward the edge; resists the other way.
          x.setValue(d > 0 ? g.dx : g.dx / 5);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dx * dir > width * 0.3 || g.vx * dir > 0.6) onCloseRef.current();
          else Animated.spring(x, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }).start();
        },
      }),
    [dir, width, x],
  );

  if (!mounted) return null;

  let index = 0;
  const entrance = () => {
    const start = Math.min(0.06 * index++, 0.45);
    return {
      opacity: stagger.interpolate({ inputRange: [start, start + 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
      transform: [
        {
          translateX: stagger.interpolate({
            inputRange: [start, start + 0.5],
            outputRange: [dir * 16, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  };

  const sections: Array<{ title?: string; items: NavItem<K>[] }> = [];
  items.forEach(item => {
    const last = sections[sections.length - 1];
    if (last && last.title === item.section) last.items.push(item);
    else sections.push({ title: item.section, items: [item] });
  });

  const select = (item: NavItem<K>) => {
    if (item.disabled) return;
    if (item.key !== activeKey) onSelect(item.key);
    onClose();
  };

  const logout = () => {
    if (!armed) {
      setArmed(true);
      AccessibilityInfo.announceForAccessibility?.(`Tap again to ${logoutLabel.toLowerCase()}`);
      return;
    }
    setArmed(false);
    onClose();
    onLogout?.();
  };

  const statusColor = status?.online ? theme.online : theme.offline;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.backdrop,
            opacity: x.interpolate({
              inputRange: side === 'left' ? [offscreen, 0] : [0, offscreen],
              outputRange: side === 'left' ? [0, 1] : [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        {...drag.panHandlers}
        accessibilityViewIsModal
        style={[
          styles.panel,
          island ? styles.island : styles.edge,
          {
            width,
            [side]: margin,
            top: island ? margin + topInset : 0,
            bottom: island ? margin + bottomInset : 0,
            paddingTop: island ? 0 : topInset,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.shadow,
            transform: [{ translateX: x }],
          },
          !island && (side === 'left' ? styles.edgeLeft : styles.edgeRight),
        ]}
      >
        <ScrollView bounces={false} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {profile && (
            <Animated.View style={[styles.head, entrance()]}>
              {profile.logo && <View style={styles.logo}>{profile.logo}</View>}
              <View style={[styles.profile, { backgroundColor: theme.surfaceAlt }]}>
                {profile.avatar ?? (
                  <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.avatarText, { color: theme.onAccent }]}>{initials(profile.name)}</Text>
                  </View>
                )}
                <View style={styles.profileText}>
                  <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
                    {profile.name}
                  </Text>
                  {!!profile.subtitle && (
                    <Text numberOfLines={1} style={[styles.subtitle, { color: theme.textMuted }]}>
                      {profile.subtitle}
                    </Text>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {sections.map((section, si) => (
            <View key={si} style={styles.section}>
              {!!section.title && (
                <Animated.Text
                  accessibilityRole="header"
                  style={[styles.sectionTitle, { color: theme.textFaint }, entrance()]}
                >
                  {section.title.toUpperCase()}
                </Animated.Text>
              )}
              {section.items.map(item => {
                const active = item.key === activeKey;
                const color = active ? theme.active : theme.text;
                return (
                  <Animated.View key={item.key} style={entrance()}>
                    <Pressable
                      onPress={() => select(item)}
                      disabled={item.disabled}
                      accessibilityRole="menuitem"
                      accessibilityLabel={
                        typeof item.badge === 'number' && item.badge > 0
                          ? `${item.label}, ${item.badge} new`
                          : item.label
                      }
                      accessibilityState={{ selected: active, disabled: !!item.disabled }}
                      style={({ pressed }) => [
                        styles.item,
                        active && { backgroundColor: theme.accentSoft },
                        pressed && !active && { backgroundColor: theme.pressed },
                        item.disabled && styles.disabled,
                      ]}
                    >
                      {active && <View style={[styles.activeBar, { backgroundColor: theme.accent }]} />}
                      <NavIcon item={item} active={active} color={active ? theme.active : theme.textMuted} size={20} />
                      <View style={styles.itemText}>
                        <Text
                          numberOfLines={1}
                          style={[styles.itemLabel, { color, fontWeight: active ? '700' : '500' }]}
                        >
                          {item.label}
                        </Text>
                        {!!item.description && (
                          <Text numberOfLines={1} style={[styles.itemDetail, { color: theme.textFaint }]}>
                            {item.description}
                          </Text>
                        )}
                      </View>
                      {item.badge != null && item.badge !== false && item.badge !== 0 && (
                        <Badge value={item.badge} theme={theme} ring={active ? theme.accentSoft : theme.surface} />
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: 14 + (island ? 0 : bottomInset) }]}>
          {status && (
            <View style={[styles.status, { backgroundColor: theme.surfaceAlt }]}>
              <View style={styles.dotWrap}>
                {status.online && (
                  <Animated.View
                    style={[
                      styles.dotRing,
                      {
                        backgroundColor: statusColor,
                        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
                      },
                    ]}
                  />
                )}
                <View style={[styles.dot, { backgroundColor: statusColor }]} />
              </View>
              <View style={styles.statusText}>
                <Text style={[styles.statusLabel, { color: theme.text }]}>
                  {status.label ?? (status.online ? 'Online' : 'Offline')}
                </Text>
                {!!status.detail && (
                  <Text numberOfLines={1} style={[styles.statusDetail, { color: theme.textMuted }]}>
                    {status.detail}
                  </Text>
                )}
              </View>
              {status.action && (
                <Pressable
                  onPress={status.action.onPress}
                  accessibilityRole="button"
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.statusAction,
                    { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.statusActionText, { color: theme.text }]}>{status.action.label}</Text>
                </Pressable>
              )}
            </View>
          )}

          {onLogout && (
            <>
              <Pressable
                onPress={logout}
                accessibilityRole="button"
                accessibilityLabel={armed ? `Tap again to ${logoutLabel.toLowerCase()}` : logoutLabel}
                accessibilityHint={armed ? logoutWarning : undefined}
                style={({ pressed }) => [
                  styles.logout,
                  {
                    backgroundColor: armed ? theme.dangerSoft : theme.accent,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.logoutGlyph, { color: armed ? theme.danger : theme.onAccent }]}>⇥</Text>
                <Text style={[styles.logoutText, { color: armed ? theme.danger : theme.onAccent }]}>
                  {armed ? `Tap again to ${logoutLabel.toLowerCase()}` : logoutLabel}
                </Text>
              </Pressable>
              {armed && !!logoutWarning && (
                <Text style={[styles.warning, { color: theme.danger }]}>{logoutWarning}</Text>
              )}
            </>
          )}
          {!!footnote && <Text style={[styles.footnote, { color: theme.textFaint }]}>{footnote}</Text>}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    overflow: 'hidden',
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  island: { borderRadius: 28, borderWidth: StyleSheet.hairlineWidth },
  edge: {},
  edgeLeft: { borderTopRightRadius: 24, borderBottomRightRadius: 24 },
  edgeRight: { borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
  scroll: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },

  head: { gap: 14, marginBottom: 8 },
  logo: { alignItems: 'center', paddingTop: 6 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  profileText: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 1 },

  section: { marginTop: 10, gap: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginLeft: 14, marginBottom: 4, marginTop: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  activeBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2 },
  itemText: { flex: 1, minWidth: 0 },
  itemLabel: { fontSize: 15 },
  itemDetail: { fontSize: 12, marginTop: 1 },
  disabled: { opacity: 0.4 },

  footer: { paddingHorizontal: 12, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 14, borderRadius: 14 },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotRing: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, minWidth: 0 },
  statusLabel: { fontSize: 13, fontWeight: '700' },
  statusDetail: { fontSize: 12 },
  statusAction: { paddingHorizontal: 10, height: 30, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  statusActionText: { fontSize: 12, fontWeight: '700' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  logoutGlyph: { fontSize: 18, fontWeight: '700' },
  logoutText: { fontSize: 15, fontWeight: '700' },
  warning: { fontSize: 12, textAlign: 'center', marginTop: -4 },
  footnote: { fontSize: 11, textAlign: 'center' },
});

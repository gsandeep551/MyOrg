import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NavItem } from '../types';
import type { NavTheme } from '../theme';

interface Props {
  item: NavItem;
  active: boolean;
  color: string;
  size: number;
}

/** The item's icon in `color`, or its initial when it has none. */
export function NavIcon({ item, active, color, size }: Props) {
  const icon = (active && item.activeIcon) || item.icon;
  if (typeof icon === 'function') return <>{icon({ color, size, active })}</>;
  return (
    <View style={[styles.box, { width: size + 4, height: size + 4 }]}>
      <Text style={{ color, fontSize: size * 0.9, lineHeight: size + 4, fontWeight: '700', textAlign: 'center' }}>
        {icon ?? item.label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Red count pill, or a dot for `true`. Positioned by the caller. */
export function Badge({ value, theme, ring }: { value: number | boolean; theme: NavTheme; ring: string }) {
  if (value === false || value === 0) return null;
  const dot = value === true;
  const text = typeof value === 'number' ? (value > 99 ? '99+' : String(value)) : '';
  return (
    <View
      style={[
        dot ? styles.dot : styles.badge,
        { backgroundColor: theme.badge, borderColor: ring },
      ]}
    >
      {!dot && <Text style={[styles.badgeText, { color: theme.onBadge }]}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  badgeText: { fontSize: 10, fontWeight: '800', lineHeight: 12, fontVariant: ['tabular-nums'] },
});

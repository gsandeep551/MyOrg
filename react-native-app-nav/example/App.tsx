import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  IslandTabBar,
  NavDrawer,
  useHideOnScroll,
  type NavItem,
} from '../src';

type Screen = 'home' | 'sync' | 'tickets' | 'support';

// Glyphs keep the example dependency-free. In an app, pass a render function:
// icon: ({ color, size }) => <Icon name="home" color={color} size={size} />
const TABS: NavItem<Screen>[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'sync', label: 'Sync', icon: '⟳', badge: 3 },
  { key: 'tickets', label: 'Tickets', icon: '☑' },
];

const DRAWER: NavItem<Screen>[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'sync', label: 'Sync', icon: '⟳', badge: 3, description: '3 tickets waiting' },
  { key: 'tickets', label: 'Job Tickets', icon: '☑' },
  { key: 'support', label: 'Support', icon: '?', section: 'Help' },
];

const TITLES: Record<Screen, string> = {
  home: 'Home',
  sync: 'Sync',
  tickets: 'Job Tickets',
  support: 'Support',
};

function Shell() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('tickets');
  const [drawer, setDrawer] = useState(false);
  // Logging out here just flips to the offline state so you can see it.
  const [online, setOnline] = useState(true);
  const { hidden, onScroll } = useHideOnScroll();
  const ink = dark ? '#F2F2F7' : '#16161D';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: dark ? '#0E0E14' : '#F6F5F2' }]}
    >
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Pressable
          onPress={() => setDrawer(true)}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={10}
          style={styles.burger}
        >
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.burgerLine, { backgroundColor: ink }]} />
          ))}
        </Pressable>
        <Text style={[styles.title, { color: ink }]}>{TITLES[screen]}</Text>
      </View>

      <FlatList
        data={Array.from({ length: 30 }, (_, i) => `Ticket #${1670354 + i}`)}
        keyExtractor={item => item}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 + insets.bottom }}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: dark ? '#17171F' : '#FFFFFF' }]}>
            <Text style={{ color: ink, fontWeight: '600' }}>{item}</Text>
          </View>
        )}
      />

      <IslandTabBar
        items={TABS}
        activeKey={screen === 'support' ? 'home' : screen}
        onChange={setScreen}
        hidden={hidden}
        bottomInset={insets.bottom}
      />

      <NavDrawer
        visible={drawer}
        onClose={() => setDrawer(false)}
        items={DRAWER}
        activeKey={screen}
        onSelect={setScreen}
        profile={{ name: 'Sandeep Gonagondla', subtitle: 'Field supervisor · Permian' }}
        status={
          online
            ? { online: true, detail: 'Synced 2 min ago' }
            : {
                online: false,
                detail: '3 tickets waiting to sync',
                action: { label: 'Retry', onPress: () => setOnline(true) },
              }
        }
        onLogout={() => setOnline(false)}
        logoutWarning="3 unsynced tickets stay on this device"
        footnote="Version 2.4.0"
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  burger: { width: 22, gap: 4 },
  burgerLine: { height: 2, borderRadius: 1 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  row: { padding: 16, borderRadius: 14 },
});

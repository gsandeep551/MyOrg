import React, { useState } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { SendQueueSheet, type QueueItem } from '../src';

interface Ticket {
  id: string;
  type: string;
  customer: string;
  well: string;
  date: string;
  amount: number;
}

const TICKETS: Ticket[] = [
  { id: '1671683', type: 'Rig Ticket', customer: 'OXY USA Inc.', well: 'DOVE 8C-13HZ', date: '09/21', amount: 4830 },
  { id: '1671690', type: 'Rig Ticket', customer: 'Chevron U.S.A. Inc.', well: 'CROW CREEK AC 36-73HN', date: '09/22', amount: 23823.38 },
  { id: '1671702', type: 'Service Ticket', customer: 'Devon Energy', well: 'BIG EDDY UNIT 214H', date: '09/22', amount: 9120 },
];

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Stand-in for your API: ~1 s per ticket, and the second ticket fails once.
const failedOnce = new Set<string>();
const sendTicket = (id: string) =>
  new Promise<void>((resolve, reject) =>
    setTimeout(() => {
      if (id === '1671690' && !failedOnce.has(id)) {
        failedOnce.add(id);
        reject(new Error('Server didn’t respond. Try again.'));
      } else resolve();
    }, 1000),
  );

function Screen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState(TICKETS);
  const [open, setOpen] = useState(true);
  const [online, setOnline] = useState(true);
  const ink = dark ? '#F2F2F7' : '#16161D';

  const items: QueueItem[] = queue.map(t => ({
    id: t.id,
    title: `#${t.id} · ${t.type}`,
    subtitle: `${t.customer} · ${t.well} · ${t.date}`,
    amount: money(t.amount),
  }));
  const total = money(queue.reduce((s, t) => s + t.amount, 0));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: dark ? '#0E0E14' : '#F6F5F2' }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Text style={[styles.h1, { color: ink }]}>Job Tickets</Text>
      <View style={styles.row}>
        <Text style={{ color: ink }}>Online</Text>
        <Switch value={online} onValueChange={setOnline} />
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={!queue.length}
        style={[styles.button, { opacity: queue.length ? 1 : 0.5 }]}
      >
        <Text style={styles.buttonText}>
          {queue.length ? `Send (${queue.length})` : 'All sent'}
        </Text>
      </Pressable>

      <SendQueueSheet
        visible={open}
        onClose={() => setOpen(false)}
        items={items}
        send={sendTicket}
        online={online}
        total={queue.length ? total : undefined}
        // Sent tickets leave the queue.
        onDone={({ sent }) => setTimeout(() => setQueue(q => q.filter(t => !sent.includes(t.id))), 1600)}
        bottomInset={insets.bottom}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 16 },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: {
    backgroundColor: '#FFC21A',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '800', color: '#1A1400' },
});

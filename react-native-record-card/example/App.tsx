import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
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
  RecordCard,
  RecordCardSkeleton,
  type SheetAction,
  type Tone,
} from '../src';

interface Ticket {
  id: string;
  date: string;
  type: string;
  customer: string;
  well: string;
  amount: number;
  status: 'New' | 'Approved' | 'Not Synced' | 'Rejected';
  local?: boolean;
}

const TICKETS: Ticket[] = [
  { id: '1668586', date: '09/21/2026', type: 'Rig Ticket', customer: 'OXY USA Inc.', well: 'DOVE 8C-13HZ', amount: 4830, status: 'Not Synced', local: true },
  { id: '1670354', date: '09/22/2026', type: 'Rig Ticket', customer: 'OXY USA Inc.', well: 'ENDSLEY 32-8J5', amount: 3611, status: 'New' },
  { id: '1670355', date: '09/23/2026', type: 'Rig Ticket', customer: 'OXY USA Inc.', well: 'PERRY 1-30-D', amount: 4896, status: 'New' },
  { id: '1669499', date: '09/22/2026', type: 'Rig Ticket', customer: 'Chevron', well: 'CROW CREEK STATE AC 36-75-1HN', amount: 2100, status: 'Approved' },
  { id: '1669498', date: '09/22/2026', type: 'Rig Ticket', customer: 'Chevron', well: 'CROW CREEK STATE AC 36-73HN', amount: 3823.38, status: 'New' },
  { id: '1666765', date: '09/22/2026', type: 'Rig Ticket', customer: 'Chevron', well: 'WELLS RANCH AF07-625', amount: 5310.5, status: 'Rejected' },
];

const STATUS_TONE: Record<Ticket['status'], Tone> = {
  New: 'info',
  Approved: 'success',
  'Not Synced': 'warning',
  Rejected: 'danger',
};

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function TicketList() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState(TICKETS);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  const say = (what: string, t: Ticket) => Alert.alert(what, `Ticket #${t.id}`);

  const actionsFor = (t: Ticket): SheetAction[] => [
    { key: 'clone', label: 'Clone', description: 'Start a new ticket from this one', icon: '⧉', tone: 'purple', onPress: () => say('Clone', t) },
    { key: 'print', label: 'Print', description: 'Send to a nearby printer', icon: '⎚', onPress: () => say('Print', t) },
    { key: 'email', label: 'Email', description: `Send a PDF to ${t.customer}`, icon: '✉', tone: 'success', onPress: () => say('Email', t) },
    { key: 'sign', label: 'Request signature', description: 'Customer signs on this device', icon: '✍', tone: 'info', badge: t.status === 'New' ? 'Needed' : undefined, onPress: () => say('Sign', t) },
    t.local
      ? { key: 'sync', label: 'Sync now', description: 'Upload this ticket to the office', icon: '⟳', tone: 'accent', onPress: () => say('Sync', t) }
      : { key: 'history', label: 'History', description: 'Edits, approvals and comments', icon: '◷', onPress: () => say('History', t) },
    {
      key: 'delete',
      label: 'Delete',
      icon: '✕',
      tone: 'danger',
      confirmLabel: 'Tap again to delete',
      disabled: t.status === 'Approved',
      disabledReason: 'Approved tickets can’t be deleted',
      onPress: () => setTickets(prev => prev.filter(x => x.id !== t.id)),
    },
  ];

  const local = tickets.filter(t => t.local);
  const remote = tickets.filter(t => !t.local);
  const data: Array<{ header: string } | Ticket> = [
    ...(local.length ? [{ header: `LOCAL TICKETS (${local.length})` }, ...local] : []),
    { header: `${remote.length} tickets found` },
    ...remote,
  ];

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: dark ? '#0E0E14' : '#F6F5F2' }]}
    >
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Text style={[styles.h1, { color: dark ? '#F2F2F7' : '#16161D' }]}>
        Job Tickets
      </Text>
      <FlatList
        data={loading ? [] : data}
        keyExtractor={item => ('header' in item ? item.header : item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.gap}>
              <RecordCardSkeleton />
              <RecordCardSkeleton />
              <RecordCardSkeleton />
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          'header' in item ? (
            <Text style={[styles.section, { color: dark ? '#A5A5B4' : '#5E5E6B' }]}>
              {item.header}
            </Text>
          ) : (
            <RecordCard
              title={`#${item.id}`}
              subtitle={item.date}
              status={{ label: item.status, tone: STATUS_TONE[item.status] }}
              tone={item.local ? 'warning' : undefined}
              fields={[
                { label: 'Type', value: item.type },
                { label: 'Customer', value: item.customer },
                { label: 'Well', value: item.well },
              ]}
              amount={money(item.amount)}
              primaryAction={{ label: 'View', icon: '👁', onPress: () => say('View', item) }}
              secondaryAction={{
                label: 'Edit',
                icon: '✎',
                disabled: item.status === 'Approved',
                onPress: () => say('Edit', item),
              }}
              actions={actionsFor(item)}
              actionsTitle={`Ticket #${item.id}`}
              actionsSubtitle={`${item.customer} · ${item.well}`}
              onPress={() => say('Open', item)}
              bottomInset={insets.bottom}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TicketList />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  h1: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  list: { paddingHorizontal: 16 },
  gap: { gap: 12 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 8,
  },
});

import React, { useMemo, useState } from 'react';
import { FlatList, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_PRESETS,
  FilterChips,
  FilterSheet,
  SearchBar,
  clearedOf,
  countActive,
  defaultsOf,
  resolveRange,
  type DateRangeValue,
  type FilterDef,
  type FilterValues,
} from '../src';

interface Ticket {
  id: string;
  type: string;
  location: string;
  status: string;
  date: string; // YYYY-MM-DD
  customer: string;
}

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TICKETS: Ticket[] = [
  { id: '1670354', type: 'rig', location: '807', status: 'new', date: daysAgo(0), customer: 'OXY USA Inc.' },
  { id: '1670355', type: 'rig', location: '802', status: 'progress', date: daysAgo(1), customer: 'Chevron U.S.A. Inc.' },
  { id: '1669499', type: 'tubing', location: '807', status: 'approved', date: daysAgo(3), customer: 'Devon Energy' },
  { id: '1669498', type: 'rig', location: '804', status: 'rejected', date: daysAgo(9), customer: 'EOG Resources' },
];

const FILTERS: FilterDef[] = [
  {
    key: 'jobType',
    label: 'Job type',
    type: 'single',
    required: true,
    defaultValue: 'rig',
    options: [
      { value: 'rig', label: 'Rig' },
      { value: 'tubing', label: 'Tubing' },
      { value: 'pressure', label: 'Pressure Control' },
    ],
  },
  {
    key: 'location',
    label: 'Location',
    type: 'single',
    anyLabel: 'All locations',
    display: 'list',
    options: [
      { value: '802', label: '802-Odessa', hint: '41 rigs will be included' },
      { value: '804', label: '804-Midland', hint: '35 rigs will be included' },
      { value: '807', label: '807-Milliken', hint: '38 rigs will be included' },
    ],
  },
  { key: 'date', label: 'Date', type: 'dateRange', defaultValue: { preset: 'last7', from: null, to: null } },
  {
    key: 'status',
    label: 'Status',
    type: 'multi',
    noun: ['status', 'statuses'],
    options: [
      { value: 'new', label: 'New', tone: 'info' },
      { value: 'progress', label: 'In Progress', tone: 'accent' },
      { value: 'approved', label: 'Approved', tone: 'success' },
      { value: 'rejected', label: 'Rejected', tone: 'danger' },
    ],
  },
];

function filter(values: FilterValues, query: string) {
  const range = resolveRange(values.date as DateRangeValue, DEFAULT_PRESETS, today);
  const statuses = values.status as string[];
  const q = query.trim().toLowerCase();
  return TICKETS.filter(
    t =>
      t.type === values.jobType &&
      (!values.location || t.location === values.location) &&
      (!range.from || t.date >= range.from) &&
      (!range.to || t.date <= range.to) &&
      (!statuses.length || statuses.includes(t.status)) &&
      (!q || t.id.startsWith(q) || t.customer.toLowerCase().includes(q)),
  );
}

function Screen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [values, setValues] = useState(defaultsOf(FILTERS));
  const [sheet, setSheet] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const results = useMemo(() => filter(values, query), [values, query]);
  const ink = dark ? '#F2F2F7' : '#16161D';

  const open = (key: string | null) => {
    setFocusKey(key);
    setSheet(true);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: dark ? '#0E0E14' : '#F6F5F2' }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={styles.top}>
        <Text style={[styles.h1, { color: ink }]}>Job Tickets</Text>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Ticket #, customer or well"
          filterCount={countActive(FILTERS, values)}
          onPressFilters={() => open(null)}
        />
        <FilterChips
          filters={FILTERS}
          value={values}
          onPressChip={open}
          onRemove={key => setValues(v => ({ ...v, [key]: clearedOf(FILTERS.find(f => f.key === key)!) }))}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={{ color: ink }}>{results.length} tickets</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: dark ? '#17171F' : '#FFFFFF' }]}>
            <Text style={{ color: ink, fontWeight: '700' }}>#{item.id}</Text>
            <Text style={{ color: ink }}>{item.customer}</Text>
          </View>
        )}
      />
      <FilterSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        filters={FILTERS}
        value={values}
        onApply={setValues}
        resultCount={draft => filter(draft, query).length}
        noun={['ticket', 'tickets']}
        focusKey={focusKey}
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
  root: { flex: 1 },
  top: { padding: 16, gap: 12 },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 40 },
  row: { padding: 16, borderRadius: 14, gap: 4 },
});

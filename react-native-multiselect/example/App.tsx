import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, useColorScheme } from 'react-native';
import { MultiSelect, type MultiSelectOption } from '../src';

const INITIAL: MultiSelectOption[] = [
  { value: 'ui', label: 'Interface design', description: 'Layouts, systems, polish', group: 'Design', icon: '🎨', tint: '#FDE7E1' },
  { value: 'motion', label: 'Motion', description: 'Springs, easing, choreography', group: 'Design', icon: '🌀', tint: '#E4ECFF' },
  { value: 'type', label: 'Typography', description: 'Type scales and pairing', group: 'Design', icon: '🔤', tint: '#F1EAFE' },
  { value: 'illus', label: 'Illustration', group: 'Design', icon: '✏️', tint: '#FFF4D6' },
  { value: 'rn', label: 'React Native', description: 'Cross-platform apps', group: 'Engineering', icon: '⚛️', tint: '#DDF4FB' },
  { value: 'ts', label: 'TypeScript', description: 'Types all the way down', group: 'Engineering', icon: '🟦', tint: '#E1EAFB' },
  { value: 'rust', label: 'Rust', description: 'Fearless concurrency', group: 'Engineering', icon: '🦀', tint: '#FDE3D8' },
  { value: 'go', label: 'Go', group: 'Engineering', icon: '🐹', tint: '#DDF6F3' },
  { value: 'ml', label: 'Machine learning', description: 'Models and data', group: 'Engineering', icon: '🧠', tint: '#FBE4F0' },
  { value: 'cobol', label: 'COBOL', description: 'Retired from this list', group: 'Engineering', icon: '📼', disabled: true },
  { value: 'coffee', label: 'Specialty coffee', group: 'Life', icon: '☕️', tint: '#F3E7DC' },
  { value: 'climb', label: 'Bouldering', group: 'Life', icon: '🧗', tint: '#E3F5E1' },
  { value: 'film', label: 'Film photography', group: 'Life', icon: '🎞️', tint: '#ECECEC' },
  { value: 'cook', label: 'Cooking', group: 'Life', icon: '🍳', tint: '#FFF0D9' },
  { value: 'run', label: 'Trail running', group: 'Life', icon: '🏃', tint: '#E0F2FF' },
  { value: 'synth', label: 'Synthesizers', group: 'Life', icon: '🎛️', tint: '#EFE6FF' },
];

export default function App() {
  const dark = useColorScheme() === 'dark';
  const [options, setOptions] = useState(INITIAL);
  const [interests, setInterests] = useState<string[]>(['rn', 'motion', 'coffee']);
  const [top3, setTop3] = useState<string[]>([]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: dark ? '#0E0E14' : '#F6F5F2' }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: dark ? '#F2F2F7' : '#16161D' }]}>Your profile</Text>

        <MultiSelect
          label="Interests"
          placeholder="What are you into?"
          options={options}
          value={interests}
          onChange={setInterests}
          onCreateOption={label => {
            const created = { value: label.toLowerCase(), label, group: 'Custom', icon: '✨' };
            setOptions(prev => [...prev, created]);
            return created;
          }}
        />

        <MultiSelect
          label="Top 3, in order"
          title="Pick your top 3"
          placeholder="Rank your favourites"
          options={options}
          value={top3}
          onChange={setTop3}
          max={3}
          theme={{ accent: '#E0482B', accentSoft: 'rgba(224,72,43,0.09)', highlight: 'rgba(224,72,43,0.18)' }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, gap: 16 },
  h1: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 8 },
});

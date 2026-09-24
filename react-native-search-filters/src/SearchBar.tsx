import React, { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { glyphIcon, type RenderIcon } from './icons';
import { resolveTheme, type FilterTheme } from './theme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Keyboard search key. */
  onSubmit?: (text: string) => void;
  placeholder?: string;
  /** Number of active filters, shown as a badge on the Filters button. */
  filterCount?: number;
  /** Shows the Filters button. */
  onPressFilters?: () => void;
  /** Spinner in place of the search icon while results load. */
  loading?: boolean;
  /** `number-pad` suits ticket numbers; `default` allows names too. */
  keyboardType?: 'default' | 'number-pad';
  renderIcon?: RenderIcon;
  theme?: Partial<FilterTheme>;
  style?: StyleProp<ViewStyle>;
}

/** Always-visible search field with a Filters button beside it. */
export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search',
  filterCount = 0,
  onPressFilters,
  loading,
  keyboardType = 'default',
  renderIcon = glyphIcon,
  theme: themeOverrides,
  style,
}: SearchBarProps) {
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(scheme, themeOverrides), [scheme, themeOverrides]);
  const input = useRef<TextInput>(null);
  const active = filterCount > 0;

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={() => input.current?.focus()}
        style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.textMuted} style={styles.lead} />
        ) : (
          <View style={styles.lead}>{renderIcon('search', theme.textMuted, 20)}</View>
        )}
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={() => onSubmit?.(value)}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          returnKeyType="search"
          keyboardType={keyboardType}
          autoCorrect={false}
          autoCapitalize="characters"
          style={[styles.input, { color: theme.text }]}
          accessibilityLabel={placeholder}
        />
        {!!value && (
          <Pressable
            onPress={() => {
              onChangeText('');
              input.current?.focus();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={[styles.clear, { backgroundColor: theme.secondary }]}
          >
            {renderIcon('close', theme.textMuted, 12)}
          </Pressable>
        )}
      </Pressable>

      {onPressFilters && (
        <Pressable
          onPress={onPressFilters}
          accessibilityRole="button"
          accessibilityLabel={active ? `Filters, ${filterCount} active` : 'Filters'}
          style={({ pressed }) => [
            styles.filters,
            {
              backgroundColor: active ? theme.tones.accent.soft : theme.surface,
              borderColor: active ? theme.tones.accent.solid : theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {renderIcon('filter', active ? theme.tones.accent.fg : theme.text, 20)}
          {active && (
            <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
              <Text style={[styles.badgeText, { color: theme.onAccent }]}>{filterCount}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  lead: { width: 22, alignItems: 'center', marginRight: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  clear: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filters: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
});

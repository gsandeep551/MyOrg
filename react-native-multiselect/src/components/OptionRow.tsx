import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Range } from '../fuzzy';
import type { MultiSelectTheme } from '../theme';
import { Highlight } from './Highlight';
import { SelectionTile } from './SelectionTile';

export const OPTION_ROW_HEIGHT = 64;

interface Props {
  index: number;
  label: string;
  description?: string;
  glyph: string;
  tint?: string;
  ranges: Range[];
  selected: boolean;
  order?: number;
  /** Multi-select rows are checkboxes; single-select rows are radio buttons. */
  multiple: boolean;
  disabled?: boolean;
  theme: MultiSelectTheme;
  onToggle: (index: number) => void;
  /** Omitted in single-select mode, so a long press acts as a normal tap. */
  onPaintStart?: (index: number) => void;
  onPressOut: () => void;
}

export const OptionRow = memo(function OptionRowImpl(props: Props) {
  const {
    index,
    label,
    description,
    glyph,
    tint,
    ranges,
    selected,
    order,
    multiple,
    disabled,
    theme,
    onPaintStart,
  } = props;
  const wash = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(wash, {
      toValue: selected ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [selected, wash]);

  return (
    <Pressable
      onPress={() => props.onToggle(index)}
      onLongPress={onPaintStart ? () => onPaintStart(index) : undefined}
      onPressOut={props.onPressOut}
      delayLongPress={220}
      disabled={disabled}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={!!disabled}
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityHint={
        multiple ? 'Long-press and drag to select several at once' : undefined
      }
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.accentSoft, opacity: wash },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.rail,
          {
            backgroundColor: theme.accent,
            opacity: wash,
            transform: [{ scaleY: wash }],
          },
        ]}
      />
      <SelectionTile
        selected={selected}
        order={order}
        glyph={glyph}
        tint={tint}
        theme={theme}
      />
      <View style={styles.text}>
        <Highlight
          text={label}
          ranges={ranges}
          style={[styles.label, { color: theme.text }]}
          highlightStyle={{
            backgroundColor: theme.highlight,
            color: theme.accent,
          }}
        />
        {description ? (
          <Text
            numberOfLines={1}
            style={[styles.description, { color: theme.textMuted }]}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: OPTION_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
    overflow: 'hidden',
  },
  rail: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  // Keeps a mouse drag on web from starting a text selection / HTML drag mid-paint.
  text: { flex: 1, justifyContent: 'center', userSelect: 'none' },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  description: { fontSize: 13, marginTop: 2 },
});

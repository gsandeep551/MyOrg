import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MONTH_NAMES, fromISO, toISO } from '../dates';
import type { RenderIcon } from '../icons';
import type { FilterTheme } from '../theme';

interface Props {
  from: string | null;
  to: string | null;
  onChange: (from: string, to: string | null) => void;
  today: Date;
  /** Days after this can't be picked (tickets can't be in the future). */
  maxDate?: Date;
  theme: FilterTheme;
  renderIcon: RenderIcon;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A month grid for picking a range: the first tap sets the start, the second
 * the end (tapping an earlier day moves the start instead).
 */
export function RangeCalendar({ from, to, onChange, today, maxDate, theme, renderIcon }: Props) {
  const anchor = from ? fromISO(from) : today;
  const [month, setMonth] = useState(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const accent = theme.tones.accent;
  const todayISO = toISO(today);
  const maxISO = maxDate ? toISO(maxDate) : null;

  const first = (month.getDay() + 6) % 7; // Monday-based offset
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => toISO(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  const pick = (iso: string) => {
    if (!from || to) onChange(iso, null);
    else if (iso < from) onChange(iso, null);
    else onChange(from, iso);
  };
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const nextDisabled = !!maxDate && new Date(month.getFullYear(), month.getMonth() + 1, 1) > maxDate;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable onPress={() => shift(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month" style={[styles.nav, { backgroundColor: theme.secondary }]}>
          {renderIcon('back', theme.text, 18)}
        </Pressable>
        <Text style={[styles.month, { color: theme.text }]}>
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable
          onPress={() => shift(1)}
          disabled={nextDisabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={[styles.nav, { backgroundColor: theme.secondary, opacity: nextDisabled ? 0.35 : 1 }]}
        >
          {renderIcon('chevron', theme.text, 18)}
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((d, i) => (
          <Text key={`w${i}`} style={[styles.weekday, { color: theme.textFaint }]}>
            {d}
          </Text>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <View key={`e${i}`} style={styles.cell} />;
          const end = iso === from || iso === (to ?? from);
          const inside = !!from && !!to && iso > from && iso < to;
          const disabled = !!maxISO && iso > maxISO;
          const col = i % 7;
          return (
            <View key={iso} style={styles.cell}>
              {/* Band behind the range; half-width on the start and end days. */}
              {!!from && !!to && from !== to && (inside || end) && (
                <View
                  style={[
                    styles.band,
                    { backgroundColor: accent.soft },
                    iso === from && styles.bandStart,
                    iso === to && styles.bandEnd,
                    col === 0 && styles.roundLeft,
                    col === 6 && styles.roundRight,
                  ]}
                />
              )}
              <Pressable
                onPress={() => pick(iso)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={iso}
                accessibilityState={{ selected: end || inside, disabled }}
                style={[
                  styles.day,
                  end && { backgroundColor: accent.solid },
                  iso === todayISO && !end && { borderWidth: 1.5, borderColor: accent.solid },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: end ? theme.onAccent : disabled ? theme.textFaint : theme.text },
                    end && styles.dayTextOn,
                  ]}
                >
                  {fromISO(iso).getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 15, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0, top: 3, bottom: 3 },
  bandStart: { left: '50%' },
  bandEnd: { right: '50%' },
  roundLeft: { borderTopLeftRadius: 17, borderBottomLeftRadius: 17 },
  roundRight: { borderTopRightRadius: 17, borderBottomRightRadius: 17 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] },
  dayTextOn: { fontWeight: '800' },
});

import React, { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ActionSheet, type SheetAction } from './ActionSheet';
import { resolveTheme, type RecordCardTheme, type Tone } from './theme';

export interface RecordField {
  label: string;
  value: ReactNode;
  key?: string;
}

export interface CardButton {
  label: string;
  /** Emoji / short glyph, or any element (e.g. a vector icon). */
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export interface RecordCardProps {
  /** Record identifier, e.g. `#1670354`. */
  title: string;
  /** Muted text beside the title, e.g. the date. */
  subtitle?: string;
  status?: { label: string; tone?: Tone };
  fields: RecordField[];
  /** Grid columns. Defaults to 2 on phones, 3 on small tablets, 4 on wide ones. */
  columns?: number;
  amount?: string;
  amountTone?: Tone;
  /** `header` shows the amount beside the status instead of in the footer. */
  amountPlacement?: 'footer' | 'header';
  /** `compact` tightens padding and type, fitting about 25% more cards per screen. */
  density?: 'comfortable' | 'compact';
  primaryAction?: CardButton;
  secondaryAction?: CardButton;
  /** Overflow menu. Shows a ⋮ button; long-pressing the card opens it too. */
  actions?: SheetAction[];
  /** Menu title; defaults to `title`. */
  actionsTitle?: string;
  actionsSubtitle?: string;
  actionsLayout?: 'list' | 'grid';
  /** Custom content at the top of the menu, e.g. a summary of the record. */
  actionsHeader?: ReactNode;
  /**
   * Flags the card for attention (e.g. `warning` for "not synced"): tints the
   * header, draws a coloured edge and border.
   */
  tone?: Tone;
  onPress?: () => void;
  /** Bottom safe-area inset, forwarded to the action sheet. */
  bottomInset?: number;
  /** Extra content between the fields and the footer. */
  children?: ReactNode;
  theme?: Partial<RecordCardTheme>;
  style?: StyleProp<ViewStyle>;
}

const autoColumns = (width: number) =>
  width >= 900 ? 4 : width >= 560 ? 3 : 2;

export function RecordCard({
  title,
  subtitle,
  status,
  fields,
  columns,
  amount,
  amountTone,
  amountPlacement = 'footer',
  density = 'comfortable',
  primaryAction,
  secondaryAction,
  actions,
  actionsTitle,
  actionsSubtitle,
  actionsLayout,
  actionsHeader,
  tone,
  onPress,
  bottomInset,
  children,
  theme: themeOverrides,
  style,
}: RecordCardProps) {
  const scheme = useColorScheme();
  const theme = useMemo(
    () => resolveTheme(scheme, themeOverrides),
    [scheme, themeOverrides],
  );
  const [width, setWidth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const hasMenu = !!actions?.length;
  const cols = Math.max(
    1,
    Math.min(columns ?? autoColumns(width), fields.length || 1),
  );
  const attention = tone ? theme.tones[tone] : undefined;
  const statusTone = theme.tones[status?.tone ?? 'info'];
  const compact = density === 'compact';
  const amountInHeader = amountPlacement === 'header' && !!amount;
  const amountColor = amountTone ? theme.tones[amountTone].fg : theme.amount;

  const pressTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      damping: 18,
      stiffness: 380,
      useNativeDriver: true,
    }).start();

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  // Screen reader users get the buttons and every menu item as card actions.
  const a11yActions = [
    ...(primaryAction && !primaryAction.disabled
      ? [{ name: 'primary', label: primaryAction.label }]
      : []),
    ...(secondaryAction && !secondaryAction.disabled
      ? [{ name: 'secondary', label: secondaryAction.label }]
      : []),
    ...(actions ?? [])
      .filter(a => !a.disabled)
      .map(a => ({ name: `menu:${a.key}`, label: a.label })),
  ];
  const onA11yAction = (e: AccessibilityActionEvent) => {
    const name = e.nativeEvent.actionName;
    if (name === 'activate') onPress?.();
    else if (name === 'primary') primaryAction?.onPress();
    else if (name === 'secondary') secondaryAction?.onPress();
    else if (name.startsWith('menu:')) {
      // Menu items with a confirm step still go through the sheet.
      const a = actions?.find(x => `menu:${x.key}` === name);
      if (a?.confirmLabel) setMenuOpen(true);
      else a?.onPress();
    }
  };

  const summary = [
    title,
    subtitle,
    status?.label,
    ...fields.map(f =>
      typeof f.value === 'string' || typeof f.value === 'number'
        ? `${f.label}: ${f.value}`
        : f.label,
    ),
    amount,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: attention ? attention.solid : theme.border,
          borderRadius: theme.radius,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={hasMenu ? () => setMenuOpen(true) : undefined}
        delayLongPress={350}
        onPressIn={onPress || hasMenu ? () => pressTo(0.985) : undefined}
        onPressOut={onPress || hasMenu ? () => pressTo(1) : undefined}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={summary}
        accessibilityHint={hasMenu ? 'Long press for more actions' : undefined}
        accessibilityActions={
          onPress
            ? [{ name: 'activate' }, ...a11yActions]
            : a11yActions
        }
        onAccessibilityAction={onA11yAction}
      >
        {attention && (
          <View
            style={[styles.edge, { backgroundColor: attention.solid }]}
          />
        )}

        {/* ---------- header ---------- */}
        <View
          style={[
            styles.header,
            compact && styles.headerCompact,
            {
              backgroundColor: attention ? attention.wash : theme.surfaceAlt,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={styles.titleWrap}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: theme.text }]}
            >
              {title}
            </Text>
            {!!subtitle && (
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: theme.textFaint }]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {status && (
            <View
              style={[styles.status, { backgroundColor: statusTone.soft }]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusTone.fg }]}
              />
              <Text
                numberOfLines={1}
                style={[styles.statusText, { color: statusTone.fg }]}
              >
                {status.label}
              </Text>
            </View>
          )}
          {amountInHeader && (
            <Text
              numberOfLines={1}
              style={[styles.amount, styles.amountHeader, { color: amountColor }]}
            >
              {amount}
            </Text>
          )}
        </View>

        {/* ---------- fields ---------- */}
        {fields.length > 0 && (
          <View style={styles.grid}>
            {fields.map((f, i) => {
              const col = i % cols;
              return (
                <View
                  key={f.key ?? f.label}
                  style={[
                    styles.cell,
                    compact && styles.cellCompact,
                    {
                      // Grows so a short last row fills the card width.
                      flexBasis: `${100 / cols}%`,
                      borderColor: theme.border,
                      borderLeftWidth: col === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopWidth: i < cols ? 0 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.fieldLabel,
                      compact && styles.fieldLabelCompact,
                      { color: theme.textFaint },
                    ]}
                  >
                    {f.label.toUpperCase()}
                  </Text>
                  {typeof f.value === 'string' ||
                  typeof f.value === 'number' ? (
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.fieldValue,
                        compact && styles.fieldValueCompact,
                        { color: theme.text },
                      ]}
                    >
                      {f.value}
                    </Text>
                  ) : (
                    f.value
                  )}
                </View>
              );
            })}
          </View>
        )}

        {children}

        {/* ---------- footer ---------- */}
        {(primaryAction ||
          secondaryAction ||
          hasMenu ||
          (amount && !amountInHeader)) && (
          <View
            style={[
              styles.footer,
              compact && styles.footerCompact,
              {
                backgroundColor: theme.surfaceAlt,
                borderTopColor: theme.border,
              },
            ]}
          >
            <View style={styles.buttons}>
              {primaryAction && (
                <Button
                  action={primaryAction}
                  fill={theme.accent}
                  ink={theme.onAccent}
                  pressed={theme.pressed}
                  compact={compact}
                />
              )}
              {secondaryAction && (
                <Button
                  action={secondaryAction}
                  fill={theme.secondary}
                  ink={theme.text}
                  pressed={theme.pressed}
                  compact={compact}
                />
              )}
              {hasMenu && (
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for ${title}`}
                  style={({ pressed }) => [
                    styles.more,
                    compact && styles.moreCompact,
                    {
                      backgroundColor: theme.secondary,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  {[0, 1, 2].map(d => (
                    <View
                      key={d}
                      style={[styles.dot, { backgroundColor: theme.text }]}
                    />
                  ))}
                </Pressable>
              )}
            </View>
            {!!amount && !amountInHeader && (
              <Text
                numberOfLines={1}
                style={[styles.amount, { color: amountColor }]}
              >
                {amount}
              </Text>
            )}
          </View>
        )}
      </Pressable>

      {hasMenu && (
        <ActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          actions={actions!}
          title={actionsTitle ?? title}
          subtitle={actionsSubtitle}
          header={actionsHeader}
          layout={actionsLayout}
          bottomInset={bottomInset}
          theme={themeOverrides}
        />
      )}
    </Animated.View>
  );
}

function Button({
  action,
  fill,
  ink,
  pressed: pressedFill,
  compact,
}: {
  action: CardButton;
  fill: string;
  ink: string;
  pressed: string;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityState={{ disabled: !!action.disabled }}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: fill },
        action.disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed && (
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.buttonPressed,
                { backgroundColor: pressedFill },
              ]}
            />
          )}
          {action.icon != null &&
            (typeof action.icon === 'string' ? (
              <Text style={[styles.buttonIcon, { color: ink }]}>
                {action.icon}
              </Text>
            ) : (
              action.icon
            ))}
          <Text style={[styles.buttonText, { color: ink }]}>
            {action.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  subtitle: { fontSize: 13, fontVariant: ['tabular-nums'] },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    maxWidth: '45%',
  },
  headerCompact: { paddingVertical: 8, paddingHorizontal: 14 },
  amountHeader: { fontSize: 16 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 0,
  },
  cellCompact: { paddingHorizontal: 14, paddingVertical: 7 },
  fieldLabelCompact: { fontSize: 10, marginBottom: 2 },
  fieldValueCompact: { fontSize: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fieldValue: { fontSize: 15, fontWeight: '500' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerCompact: { paddingHorizontal: 10, paddingVertical: 7 },
  buttonCompact: { height: 32, paddingHorizontal: 12 },
  moreCompact: { width: 32, height: 32 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonPressed: { borderRadius: 10 },
  buttonIcon: { fontSize: 15 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  more: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  amount: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
});

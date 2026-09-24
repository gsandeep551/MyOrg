import type { DatePreset, DateRangeValue } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const shortDate = (iso: string) => {
  const d = fromISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** `Sep 22 – 24`, `Sep 28 – Oct 3`, or `Sep 22` for a single day. */
export function formatRange(from: string | null, to: string | null) {
  if (!from) return 'Any date';
  if (!to || to === from) return shortDate(from);
  const a = fromISO(from);
  const b = fromISO(to);
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${shortDate(from)} – ${b.getDate()}`
    : `${shortDate(from)} – ${shortDate(to)}`;
}

export const DEFAULT_PRESETS: DatePreset[] = [
  { key: 'today', label: 'Today', range: t => [toISO(t), toISO(t)] },
  { key: 'yesterday', label: 'Yesterday', range: t => [toISO(addDays(t, -1)), toISO(addDays(t, -1))] },
  { key: 'last7', label: 'Last 7 days', range: t => [toISO(addDays(t, -6)), toISO(t)] },
  {
    key: 'week',
    label: 'This week',
    // Weeks start on Monday.
    range: t => [toISO(addDays(t, -((t.getDay() + 6) % 7))), toISO(t)],
  },
  { key: 'month', label: 'This month', range: t => [toISO(new Date(t.getFullYear(), t.getMonth(), 1)), toISO(t)] },
];

/** Resolves a preset to concrete dates for `today`; custom ranges pass through. */
export function resolveRange(v: DateRangeValue, presets: DatePreset[], today: Date): DateRangeValue {
  const p = presets.find(x => x.key === v.preset);
  if (!p) return v;
  const [from, to] = p.range(today);
  return { preset: p.key, from, to };
}

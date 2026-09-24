import { DEFAULT_PRESETS, formatRange } from './dates';
import type { DateRangeValue, FilterDef, FilterValue, FilterValues } from './types';

const EMPTY_RANGE: DateRangeValue = { preset: null, from: null, to: null };

/** A filter's reset value. */
export function defaultOf(def: FilterDef): FilterValue {
  if (def.type === 'single') return def.defaultValue ?? (def.required ? def.options[0]?.value ?? null : null);
  if (def.type === 'multi') return def.defaultValue ?? [];
  return def.defaultValue ?? EMPTY_RANGE;
}

export const defaultsOf = (defs: FilterDef[]): FilterValues =>
  Object.fromEntries(defs.map(d => [d.key, defaultOf(d)]));

/** A filter's “no filter” value; what the × on its chip sets. */
export function clearedOf(def: FilterDef): FilterValue {
  if (def.type === 'single') return def.required ? defaultOf(def) : null;
  if (def.type === 'multi') return [];
  return EMPTY_RANGE;
}

/** Whether a filter narrows the results. Required filters always count as shown. */
export function isActive(def: FilterDef, value: FilterValue): boolean {
  if (def.type === 'single') return !!def.required || value != null;
  if (def.type === 'multi') return ((value as string[]) ?? []).length > 0;
  const r = (value as DateRangeValue) ?? EMPTY_RANGE;
  return !!(r.preset && r.preset !== 'custom') || !!r.from;
}

/** Filters that narrow results, for the badge on the Filters button. */
export const countActive = (defs: FilterDef[], values: FilterValues) =>
  defs.filter(d => !(d.type === 'single' && d.required) && isActive(d, values[d.key])).length;

export const presetsOf = (def: FilterDef) => (def.type === 'dateRange' ? def.presets ?? DEFAULT_PRESETS : []);

/** Short text for the chip, e.g. `Rig`, `807-Milliken`, `Sep 22 – 24`, `3 statuses`. */
export function summarize(def: FilterDef, value: FilterValue): string {
  if (def.type === 'single') {
    return def.options.find(o => o.value === value)?.label ?? def.anyLabel ?? def.label;
  }
  if (def.type === 'multi') {
    const v = (value as string[]) ?? [];
    if (!v.length) return def.label;
    if (v.length === 1) return def.options.find(o => o.value === v[0])?.label ?? def.label;
    const [one, many] = def.noun ?? [def.label.toLowerCase(), def.label.toLowerCase()];
    return `${v.length} ${v.length === 1 ? one : many}`;
  }
  const r = (value as DateRangeValue) ?? EMPTY_RANGE;
  const preset = presetsOf(def).find(p => p.key === r.preset);
  return preset ? preset.label : formatRange(r.from, r.to);
}

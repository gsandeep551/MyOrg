import type { Tone } from './theme';

export interface FilterOption {
  value: string;
  label: string;
  /** Secondary text, e.g. `38 rigs` for a location. Shown in lists and under the section when selected. */
  hint?: string;
  /** Colour dot on status-style chips. */
  tone?: Tone;
  /** Optional count shown on the chip, e.g. how many tickets have this status. */
  count?: number;
}

interface BaseDef {
  key: string;
  label: string;
}

/** Pick exactly one. Up to 8 options show as chips; more open a searchable list. */
export interface SingleFilterDef extends BaseDef {
  type: 'single';
  options: FilterOption[];
  /** Always has a value: its chip can't be removed, only changed. */
  required?: boolean;
  /** Force the searchable list (or chips) regardless of option count. */
  display?: 'chips' | 'list';
  defaultValue?: string | null;
  /** Label for “no filter” on optional filters, e.g. `All locations`. */
  anyLabel?: string;
}

/** Pick any number. */
export interface MultiFilterDef extends BaseDef {
  type: 'multi';
  options: FilterOption[];
  /** Nouns for the chip summary, e.g. `['status', 'statuses']` → “3 statuses”. */
  noun?: [string, string];
  defaultValue?: string[];
}

export interface DateRangeValue {
  /** Preset key, or `custom`. */
  preset: string | null;
  /** ISO dates, `YYYY-MM-DD`. */
  from: string | null;
  to: string | null;
}

export interface DatePreset {
  key: string;
  label: string;
  /** Returns [from, to] as ISO dates for the given `today`. */
  range: (today: Date) => [string, string];
}

export interface DateRangeFilterDef extends BaseDef {
  type: 'dateRange';
  presets?: DatePreset[];
  defaultValue?: DateRangeValue;
}

export type FilterDef = SingleFilterDef | MultiFilterDef | DateRangeFilterDef;

export type FilterValue = string | null | string[] | DateRangeValue;
export type FilterValues = Record<string, FilterValue>;

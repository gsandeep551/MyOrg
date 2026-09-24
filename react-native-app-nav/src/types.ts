import type { ReactNode } from 'react';

/** Renders an icon in the colour the component picks for its state. */
export type NavIconRender = (props: {
  color: string;
  size: number;
  active: boolean;
}) => ReactNode;

export interface NavItem<K extends string = string> {
  key: K;
  label: string;
  /**
   * A glyph string, or a render function so vector icons follow the active
   * colour, e.g. `({ color, size }) => <Icon name="home" color={color} size={size} />`.
   */
  icon?: string | NavIconRender;
  /** Separate icon for the active state (e.g. a filled variant). */
  activeIcon?: string | NavIconRender;
  /** Count badge; numbers over 99 show as `99+`. `true` shows a dot. */
  badge?: number | boolean;
  /** Drawer only: items sharing a section are grouped under its heading. */
  section?: string;
  /** Drawer only: second line under the label. */
  description?: string;
  disabled?: boolean;
}

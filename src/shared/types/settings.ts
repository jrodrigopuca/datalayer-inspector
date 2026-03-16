/**
 * User settings and configuration types
 */

// Using const types pattern for theme
export const THEME = {
  AUTO: "auto",
  DARK: "dark",
  LIGHT: "light",
} as const;

export type Theme = (typeof THEME)[keyof typeof THEME];

/**
 * User-configurable settings
 */
export interface UserSettings {
  /** Global extension enabled state */
  readonly enabled: boolean;
  /** UI theme */
  readonly theme: Theme;
  /** DataLayer array names to monitor */
  readonly dataLayerNames: readonly string[];
  /** Auto-scroll to last event in timeline */
  readonly autoScroll: boolean;
  /** Max events to retain per tab (oldest are discarded) */
  readonly maxEventsPerTab: number;
  /** Default expansion depth for JSON tree */
  readonly defaultExpandDepth: number;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  theme: THEME.AUTO,
  dataLayerNames: ["dataLayer"],
  autoScroll: true,
  maxEventsPerTab: 500,
  defaultExpandDepth: 2,
} as const;

/**
 * Partial settings for updates
 */
export type SettingsUpdate = Partial<UserSettings>;

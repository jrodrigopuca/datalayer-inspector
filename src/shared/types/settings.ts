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
  /** Keep captured events across cross-origin navigations (like Network's "Preserve log") */
  readonly preserveLog: boolean;
}

/**
 * Default settings values
 */
/**
 * Capture is OFF until the user turns it on. Strata is used in short
 * sessions (open, capture a flow, export, close); wrapping dataLayer.push
 * and relaying events on every page all day is not what the user wants.
 * The badge and the panel's empty state say so (docs/TECH-DEBT.md, item 18).
 */
export const DEFAULT_SETTINGS: UserSettings = {
  enabled: false,
  theme: THEME.AUTO,
  dataLayerNames: ["dataLayer"],
  autoScroll: true,
  maxEventsPerTab: 500,
  defaultExpandDepth: 2,
  preserveLog: false,
} as const;

/**
 * Partial settings for updates
 */
export type SettingsUpdate = Partial<UserSettings>;

/**
 * Shared constants used across extension contexts
 */

/**
 * Extension identification
 * (version lives in manifest.json - read it via chrome.runtime.getManifest())
 */
export const EXTENSION_NAME = "Strata" as const;

/**
 * Performance limits
 */
export const LIMITS = {
  /** Maximum events to store per tab before pruning oldest */
  MAX_EVENTS_PER_TAB: 500,
  /** Minimum events to keep when pruning */
  MIN_EVENTS_AFTER_PRUNE: 400,
  /** Maximum size of a single event payload in bytes (approx) */
  MAX_EVENT_PAYLOAD_SIZE: 100_000,
  /** Service worker idle timeout before suspension (ms) */
  SW_IDLE_TIMEOUT: 30_000,
  /** DevTools panel reconnection: first delay (ms), doubled per attempt */
  RECONNECT_DELAY: 1000,
  /** DevTools panel reconnection: delay cap (ms). Never gives up. */
  RECONNECT_MAX_DELAY: 30_000,
} as const;

/**
 * Storage keys for chrome.storage
 */
export const STORAGE_KEYS = {
  /** User settings (local storage; migrated from sync once) */
  SETTINGS: "strata_settings",
  /** Per-tab state backup (session storage): `${TAB_STATE_PREFIX}${tabId}` */
  TAB_STATE_PREFIX: "strata_tab_",
  /** Pre-1.5 single-key backup, removed on restore */
  LEGACY_TAB_STATES: "strata_tab_states",
  /** Session marker: set on the first worker start of an extension process */
  SESSION_BOOTED: "strata_booted",
  /** Schemas for validation - Phase 2 (local storage) */
  SCHEMAS: "strata_schemas",
} as const;

/**
 * Persistence budgets for chrome.storage.session
 *
 * The session area is capped at 10 MB shared by every tab. Each tab gets a
 * slice of it; when a tab's serialized state exceeds the slice, the oldest
 * events are dropped and the panel is told (docs/TECH-DEBT.md, item 3).
 * Chrome measures quota as the JSON string length of value plus key.
 */
export const STORAGE_LIMITS = {
  /** Maximum serialized size of one tab's state (approx. bytes) */
  MAX_TAB_STATE_BYTES: 2_000_000,
} as const;

/**
 * Event type patterns for categorization
 */
export const EVENT_PATTERNS = {
  /** GTM internal events */
  GTM: /^gtm\./,
  /** GA4 recommended ecommerce events */
  ECOMMERCE:
    /^(add_to_cart|remove_from_cart|view_item|view_item_list|select_item|begin_checkout|add_payment_info|add_shipping_info|purchase|refund|view_cart|select_promotion|view_promotion)$/,
  /** GA4 recommended engagement events */
  ENGAGEMENT:
    /^(login|sign_up|share|search|select_content|page_view|screen_view|scroll|file_download|video_start|video_progress|video_complete)$/,
} as const;

/**
 * GTM container ID pattern
 */
export const GTM_CONTAINER_PATTERN = /^GTM-[A-Z0-9]{6,8}$/;

/**
 * Timing constants
 */
export const TIMING = {
  /** Debounce delay for search input (ms) */
  SEARCH_DEBOUNCE: 150,
  /** Animation duration for UI transitions (ms) */
  ANIMATION_DURATION: 200,
  /** Polling interval for container detection (ms) */
  CONTAINER_DETECT_INTERVAL: 1000,
  /** Maximum time to wait for container detection (ms) */
  CONTAINER_DETECT_TIMEOUT: 10_000,
} as const;

/**
 * Shared constants used across extension contexts
 */

/**
 * Extension identification
 */
export const EXTENSION_NAME = "Strata" as const;
export const EXTENSION_VERSION = "0.1.0" as const;

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
  /** DevTools panel reconnection delay (ms) */
  RECONNECT_DELAY: 1000,
  /** Maximum reconnection attempts */
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

/**
 * Storage keys for chrome.storage
 */
export const STORAGE_KEYS = {
  /** User settings (sync storage) */
  SETTINGS: "strata_settings",
  /** Tab states backup (session storage) */
  TAB_STATES: "strata_tab_states",
  /** Schemas for validation - Phase 2 (local storage) */
  SCHEMAS: "strata_schemas",
} as const;

/**
 * Event type patterns for categorization
 */
export const EVENT_PATTERNS = {
  /** GTM internal events */
  GTM: /^gtm\./,
  /** GA4 recommended ecommerce events */
  ECOMMERCE: /^(add_to_cart|remove_from_cart|view_item|view_item_list|select_item|begin_checkout|add_payment_info|add_shipping_info|purchase|refund|view_cart|select_promotion|view_promotion)$/,
  /** GA4 recommended engagement events */
  ENGAGEMENT: /^(login|sign_up|share|search|select_content|page_view|screen_view|scroll|file_download|video_start|video_progress|video_complete)$/,
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

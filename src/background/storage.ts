/**
 * Service Worker - Settings Storage
 *
 * Manages persistent user settings using chrome.storage.local.
 *
 * Settings used to live in chrome.storage.sync. That bought cross-device
 * sync nobody needed and cost two real problems: sync write quotas (a user
 * toggling capture a few times in a row can hit them) and a propagation gap
 * for changes arriving from another device. Existing values are migrated
 * from sync on first read (docs/TECH-DEBT.md, item 17 follow-up).
 */

import { STORAGE_KEYS } from "@shared/constants";
import { DEFAULT_SETTINGS, type UserSettings } from "@shared/types";

/**
 * Cached settings to avoid repeated storage reads
 */
let cachedSettings: UserSettings | null = null;

/**
 * Get current settings
 */
export async function getSettings(): Promise<UserSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const key = STORAGE_KEYS.SETTINGS;
    const local = await chrome.storage.local.get(key);
    let stored = local[key] as Partial<UserSettings> | undefined;

    if (stored === undefined) {
      stored = await migrateFromSync(key);
    }

    // Merge with defaults to ensure all fields exist
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
    };

    return cachedSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * One-time migration: copy settings saved by pre-1.5 versions in
 * chrome.storage.sync into local. The sync copy is left in place so other
 * devices of the same user migrate from it too.
 */
async function migrateFromSync(
  key: string
): Promise<Partial<UserSettings> | undefined> {
  try {
    const synced = await chrome.storage.sync.get(key);
    const stored = synced[key] as Partial<UserSettings> | undefined;
    if (stored !== undefined) {
      await chrome.storage.local.set({ [key]: stored });
    }
    return stored;
  } catch {
    return undefined;
  }
}

/**
 * Update settings (partial update)
 */
export async function updateSettings(
  updates: Partial<UserSettings>
): Promise<UserSettings> {
  const current = await getSettings();

  const newSettings: UserSettings = {
    ...current,
    ...updates,
  };

  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: newSettings,
    });

    cachedSettings = newSettings;
    return newSettings;
  } catch (error) {
    console.error("[Strata] Failed to save settings:", error);
    throw error;
  }
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<UserSettings> {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.SETTINGS);
    cachedSettings = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("[Strata] Failed to reset settings:", error);
    throw error;
  }
}

/**
 * Clear settings cache (for testing or after external changes)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
}

/**
 * Listen for external settings changes
 * Returns an unsubscribe function to remove the listener
 */
export function onSettingsChanged(
  callback: (settings: UserSettings) => void
): () => void {
  const key = STORAGE_KEYS.SETTINGS;

  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    const change = changes[key];
    if (areaName === "local" && change) {
      const newValue = change.newValue as Partial<UserSettings> | undefined;

      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...newValue,
      };

      callback(cachedSettings);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

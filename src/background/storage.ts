/**
 * Service Worker - Settings Storage
 *
 * Manages persistent user settings using chrome.storage.sync
 */

import { DEFAULT_SETTINGS, type UserSettings } from "@shared/types";
import { STORAGE_KEYS } from "@shared/constants";

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
    const result = await chrome.storage.sync.get(key);
    const stored = result[key] as Partial<UserSettings> | undefined;

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
    await chrome.storage.sync.set({
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
    await chrome.storage.sync.remove(STORAGE_KEYS.SETTINGS);
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
 */
export function onSettingsChanged(
  callback: (settings: UserSettings) => void
): void {
  const key = STORAGE_KEYS.SETTINGS;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const change = changes[key];
    if (areaName === "sync" && change) {
      const newValue = change.newValue as
        | Partial<UserSettings>
        | undefined;

      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...newValue,
      };

      callback(cachedSettings);
    }
  });
}

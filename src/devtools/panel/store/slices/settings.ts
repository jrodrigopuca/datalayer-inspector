/**
 * Settings slice - manages user preferences
 */

import type { StateCreator } from "zustand";
import type { UserSettings, Theme } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";

export interface SettingsSlice {
  /** User settings */
  settings: UserSettings;

  // Actions
  setTheme: (theme: Theme) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  setMaxEventsPerTab: (max: number) => void;
  setDefaultExpandDepth: (depth: number) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settings: DEFAULT_SETTINGS,

  setTheme: (theme) =>
    set((state) => ({
      settings: { ...state.settings, theme },
    })),

  setAutoScroll: (autoScroll) =>
    set((state) => ({
      settings: { ...state.settings, autoScroll },
    })),

  setMaxEventsPerTab: (maxEventsPerTab) =>
    set((state) => ({
      settings: { ...state.settings, maxEventsPerTab },
    })),

  setDefaultExpandDepth: (defaultExpandDepth) =>
    set((state) => ({
      settings: { ...state.settings, defaultExpandDepth },
    })),

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
});

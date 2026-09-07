/**
 * Service Worker - Action Badge
 *
 * Capture is off by default; the toolbar icon says so at a glance.
 */

const OFF_TEXT = "OFF";
const OFF_COLOR = "#6b7280";

export async function updateBadge(enabled: boolean): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: enabled ? "" : OFF_TEXT });
    if (!enabled) {
      await chrome.action.setBadgeBackgroundColor({ color: OFF_COLOR });
    }
  } catch (error) {
    console.error("[Strata] Failed to update badge:", error);
  }
}

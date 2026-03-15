/**
 * DevTools entry point
 *
 * This script runs in the DevTools context and creates the panel.
 * It's minimal - just registers the panel with Chrome DevTools.
 */

chrome.devtools.panels.create(
  "DataLayer", // Panel title
  "src/assets/icons/icon-32.png", // Icon path
  "src/devtools/panel.html", // Panel HTML
  (panel) => {
    // Panel created callback
    // We could track panel shown/hidden here if needed
    panel.onShown.addListener(() => {
      // Panel is now visible
    });

    panel.onHidden.addListener(() => {
      // Panel is now hidden
    });
  }
);

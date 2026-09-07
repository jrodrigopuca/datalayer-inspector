/**
 * DevTools Panel React entry point
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { describeCommandFailure } from "./lib/connection-policy";
import { usePanelStore } from "./store";
import "@/styles/globals.css";

// Anything that still slips past runCommand lands in the status bar, not
// only in chrome://extensions' error list (docs/TECH-DEBT.md, item 17).
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Strata] Unhandled rejection:", event.reason);
  usePanelStore
    .getState()
    .setWarningMessage(describeCommandFailure(event.reason, false));
});

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

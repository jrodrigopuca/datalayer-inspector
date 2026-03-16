# Privacy Policy for Strata

**Last updated:** March 2026

## Overview

Strata ("the Extension") is a Chrome DevTools extension that helps developers inspect and validate GTM dataLayer events. This privacy policy explains how we handle your data.

## Data Collection

**We do not collect any data.**

Strata operates entirely within your browser. The Extension:

- Does NOT collect personal information
- Does NOT track your browsing activity
- Does NOT transmit any data to external servers
- Does NOT use analytics or telemetry
- Does NOT store data outside your browser session

## How Strata Works

When you use Strata:

1. **Event Capture**: The Extension intercepts `dataLayer.push()` calls on the current page. This data is stored temporarily in your browser's memory.

2. **Schema Storage**: Validation schemas you create are stored locally using Chrome's `storage.local` API. This data never leaves your device.

3. **Data Lifecycle**: All captured events are cleared when you close the browser tab or click "Clear". Schemas persist until you delete them.

## Permissions Explained

Strata requests the following permissions:

| Permission | Why It's Needed |
|------------|-----------------|
| `activeTab` | To inject the dataLayer capture script into the current page |
| `scripting` | To run the capture script that intercepts dataLayer.push() calls |
| `storage` | To save your validation schemas locally |
| `host_permissions: <all_urls>` | To work on any website where you need to debug dataLayer |

## Third-Party Services

Strata does not integrate with any third-party services. All functionality runs locally in your browser.

## Data Security

Since all data remains local to your browser:

- Your dataLayer events are never transmitted anywhere
- Your validation schemas are stored only on your device
- There are no accounts, logins, or cloud sync features

## Children's Privacy

Strata does not knowingly collect any information from anyone, including children under 13 years of age.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last updated" date at the top of this document.

## Open Source

Strata is open source software. You can review the complete source code to verify our privacy practices:

https://github.com/YOUR_USERNAME/strata

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

---

**Summary**: Strata is a local-only tool. Your data stays in your browser. We don't collect, store, or transmit anything.

# Permission Justification for Chrome Web Store

When submitting to Chrome Web Store, you'll need to justify the permissions. Use these explanations:

## Permissions

### `activeTab`
**Justification**: Required to inject the dataLayer capture script into the currently active tab when the user opens DevTools. This is the minimal permission needed to run scripts on user request.

### `scripting`
**Justification**: Required to programmatically inject the page script that intercepts `window.dataLayer.push()` calls. The content script uses this to inject the capture mechanism into the page context.

### `storage`
**Justification**: Required to persist user-created validation schemas locally. Schemas are stored using `chrome.storage.local` and never transmitted externally. This allows users to keep their schemas between browser sessions.

## Host Permissions

### `<all_urls>`
**Justification**: This extension is a developer tool for debugging GTM dataLayer implementations. Developers need to test and debug dataLayer events on ANY website they're working on, including:
- Local development servers (localhost)
- Staging environments
- Production websites
- Client websites during audits

Restricting to specific URLs would make the tool unusable for its intended purpose. The extension only activates when the user explicitly opens DevTools and navigates to the Strata panel.

**Privacy Note**: Despite broad host permissions, the extension:
- Does NOT collect or transmit any data
- Does NOT run background processes on pages
- Only captures dataLayer events when DevTools is open
- All data stays local to the user's browser

## Content Scripts

### `matches: <all_urls>` + `run_at: document_start`
**Justification**: The content script must run at `document_start` to inject the dataLayer interceptor BEFORE any GTM code runs. If injected later, early dataLayer.push() calls would be missed. This is critical for capturing the complete sequence of tracking events.

## Optional Permissions

### `tabs` (optional)
**Justification**: Only requested when needed for advanced features like detecting tab navigation events. Not required for core functionality.

---

## Single Purpose Description

**Single Purpose**: Inspect, validate, and export Google Tag Manager dataLayer events for debugging and QA purposes.

This extension serves a single, focused purpose: helping developers and analysts debug GTM implementations by providing visibility into dataLayer events with validation and export capabilities.

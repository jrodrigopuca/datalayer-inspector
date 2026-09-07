# Permission Justification for Chrome Web Store

When submitting to Chrome Web Store, you'll need to justify the permissions. Use these explanations. They describe what the code actually does as of 1.5; keep them in sync with `manifest.json`.

## Permissions

### `scripting`
**Justification**: After the extension is installed, updated, reloaded or re-enabled, tabs that were already open still run the previous version's relay, which can no longer talk to the extension. Strata uses `chrome.scripting.executeScript` once per extension start to re-run its own relay content script in those tabs, so capture resumes without the user reloading every page. It never injects anything else and never injects into pages the user cannot see.

### `storage`
**Justification**: Required to persist, locally only:
- user settings (`storage.local`: capture on/off, monitored dataLayer names, display options);
- validation schemas the user creates (`storage.local`);
- the per-tab list of captured events for the current browser session (`storage.session`), so a suspended service worker can restore it.

Nothing is transmitted externally.

## Host Permissions

### `<all_urls>`
**Justification**: This extension is a developer tool for debugging GTM dataLayer implementations. Developers need to test and debug dataLayer events on ANY website they're working on, including:
- Local development servers (localhost)
- Staging environments
- Production websites
- Client websites during audits

Restricting to specific URLs would make the tool unusable for its intended purpose.

**Privacy Note**: Despite broad host permissions, the extension:
- Does NOT collect or transmit any data
- Captures dataLayer events ONLY while the user has turned capture on (it starts off; the toolbar icon shows `OFF`)
- While capture is off, the page-side interceptor stays silent and buffers nothing
- Keeps all data local to the user's browser

## Content Scripts

### `world: "MAIN"`, `run_at: document_start`
**Justification**: The interceptor must wrap `dataLayer.push` in the page's own JavaScript world, as early as possible, so the complete sequence of tracking events is observed (events already present when it attaches are reported as "Pre-existing"). Running as a MAIN-world content script avoids injecting `<script>` tags into the page and is not affected by the page's Content Security Policy.

### Isolated-world relay, `run_at: document_start`
**Justification**: Bridges the page-side interceptor and the extension: validates every message coming from the page and forwards it to the service worker, and tells the interceptor whether capture is on.

---

## Single Purpose Description

**Single Purpose**: Inspect, validate, and export Google Tag Manager dataLayer events for debugging and QA purposes.

This extension serves a single, focused purpose: helping developers and analysts debug GTM implementations by providing visibility into dataLayer events with validation and export capabilities.

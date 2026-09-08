# Changelog

All notable changes to Strata are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## [1.5.0] - 2026-09-07

### Added

- **dataLayer only export**: Export → "dataLayer only" downloads a plain JSON array of the pushed objects, in capture order, with nothing added. The full export is now labelled "Full JSON".
- **JSON export v2** (`formatVersion: 2`): every raw event now carries `trigger` (the same attribution shown in the timeline and PDF), `category`, and, when a schema matched, `validation` with per-schema status and errors. The payload opens with a `summary` (counts by category, by trigger type, and validation pass/fail/unchecked) so a session can be evaluated without opening DevTools.
- **Pre-existing attribution**: events already in the array when Strata attaches are marked `preload` instead of `page-load`.
- **Reload markers**: every event carries the id of the document load that captured it; the timeline shows "↻ Page reloaded" when the same page loads again (a back/forward restore is not a reload and gets no marker). The id is included in the JSON export.
- **Hard per-tab limit**: capture stops at `maxEventsPerTab` (default 500) or at the session-size budget, the status bar shows `captured / limit`, and a banner offers Clear. Nothing is dropped silently anymore (earlier builds pruned the oldest events).
- Session storage warning in the status bar when a tab's state cannot be saved.

### Changed

- **Capture is off by default.** Strata is used in short sessions (open, capture a flow, export), so it no longer wraps `dataLayer.push` output on every page all day. The toolbar icon shows `OFF`, the panel's empty state offers "Turn on capture", and turning it on picks up what the dataLayer already holds as "Pre-existing" (only what Strata has not captured yet, so toggling never duplicates). Users who never changed a setting will find capture off after this update; users with saved settings keep their choice.
- Page script runs as a `world: "MAIN"` content script (no script-tag injection, immune to page CSP). Capture starts before the settings round-trip; messages are buffered until the relay is ready.
- Schemas are owned by the service worker: every open panel stays in sync and concurrent edits no longer overwrite each other.
- Per-tab session persistence.

### Fixed

- Clean JSON export ignored `includeUrl` whenever `includeTimestamp` was on.
- **Panel reconnection**: after the extension is updated or reloaded, the open panel now says "Close and reopen DevTools to reconnect" instead of "Max reconnection attempts reached". Real disconnects (service worker asleep or restarted) retry forever with capped backoff, and the status bar offers a **Reconnect** button.
- After an install, update, reload or re-enable, Strata re-injects its relay into tabs that were already open, so capture resumes there without reloading the page, and the dataLayer history is listed again as "Pre-existing".
- Settings moved from `storage.sync` to `storage.local` (no cross-device sync, no sync write quotas). Existing values are migrated automatically on first run.
- Clear, Record, Enable and Settings failures now show in the status bar instead of surfacing as unhandled errors in `chrome://extensions`. The panel also reports any unhandled promise rejection there.
- **Privacy**: trigger labels no longer include the text of arbitrary clicked elements (table cells, paragraphs, containers). Text is recorded only from explicit accessible names, the `<label>` of a form field, or the caption of a real control. Form fields are described by their label, never their value or options. See PRIVACY.md.

## [1.4.0] - 2026-07

### Added

- **Trigger attribution**: every captured event now shows what caused it — `Click on button "Add to cart" (+130ms)`, form submit, field change, Enter key, page load, or script. Visible in the timeline, the detail view, and (optionally) in Evidence PDFs. Input values are never recorded.
- **Settings panel** (gear icon): monitored dataLayer names (supports renamed/multiple arrays like `customDataLayer`), preserve log, auto-scroll, max events per tab, tree expand depth.
- **Preserve log**: keep captured events across cross-origin navigations (payment gateways, SSO redirects).
- **Validation summary** in the status bar (`✓ 12 ✗ 2`), clickable to filter only failing events. New "Validation failed" filter.
- **Schema coverage**: the schema list shows which enabled schemas never fired during the session.
- **GA4 ecommerce presets**: load 11 ready-made schemas (view_item → purchase → refund) with one click.
- **Parameter table view** in the event detail: GA4-friendly rows and items table, no JSON braces.
- **Engagement category** (page_view, login, search, …) with its own color, filter and counters.
- **Timeline improvements**: page-navigation separators, time deltas between events (`+82ms`), copy-path button in the JSON tree.
- **Evidence event picker**: preview the exact payload of each event before exporting; rows show index, category and time.

### Changed

- Export actions consolidated into a single **Export ▾** menu; toolbar adapts to narrow DevTools panels (icon-only).
- Cleaner event rows: category badge only when meaningful, event name first, metadata second.
- Evidence "Include" options now feature an optional **Trigger attribution** line per event.
- Oversized dataLayer payloads (>100KB) are replaced with an explicit truncation marker instead of breaking capture silently.

### Fixed

- **Service worker connection drops** ("Receiving end does not exist"): listeners are now registered synchronously as Manifest V3 requires; the panel connection is significantly more stable and retries briefly during service worker startup.
- Deleting the last schema now persists (it previously reappeared when reopening the panel).
- Schema import shows visible success/error feedback and validates the file structure.
- Unhandled promise rejections across the service worker, popup and panel are now caught and reported. *(Correction, 2026-09: no such handler shipped in 1.4.0; the panel gained one in the next release, see Unreleased.)*
- Tree view values, container badges and long event names no longer overflow or overlap.

### Removed

- **PNG evidence export**: single-canvas rendering fails silently beyond the browser's canvas size limit, which long sessions always exceed. Evidence is now PDF-only (PDF paginates, so captures of any length work).

## [1.3.0] and earlier

See the [commit history](https://github.com/jrodrigopuca/datalayer-inspector/commits/main).

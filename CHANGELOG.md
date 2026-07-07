# Changelog

All notable changes to Strata are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

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
- Unhandled promise rejections across the service worker, popup and panel are now caught and reported.
- Tree view values, container badges and long event names no longer overflow or overlap.

### Removed

- **PNG evidence export**: single-canvas rendering fails silently beyond the browser's canvas size limit, which long sessions always exceed. Evidence is now PDF-only (PDF paginates, so captures of any length work).

## [1.3.0] and earlier

See the [commit history](https://github.com/jrodrigopuca/datalayer-inspector/commits/main).

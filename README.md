# Strata

> The Developer's DataLayer Inspector — Inspect, validate and export your GTM dataLayer in real-time.

A Chrome DevTools extension built for developers and technical analysts who need more than just a viewer.

## Features

### Real-time Event Capture

- Intercepts all `dataLayer.push()` calls as they happen
- Multi-container GTM support
- Pause/resume a tab's timeline while Strata keeps capturing elsewhere
- Event timeline with color-coded categories (GTM, Ecommerce, Custom, Errors), page and reload separators
- Explicit per-tab limit (500 by default, configurable): capture stops at the limit and asks you to clear; nothing is dropped silently

### Schema Validation

Validate your dataLayer events against JSON templates:

```json
{
	"event": "purchase",
	"ecommerce": {
		"transaction_id": "@string",
		"value": "@number",
		"currency": "@enum(USD, EUR, GBP)",
		"items": [{ "item_id": "@string", "price": "@number" }]
	}
}
```

- **Type placeholders**: `@string`, `@number`, `@boolean`, `@array`, `@object`, `@any`
- **Optional fields**: `@string?`, `@number?` (won't fail if missing)
- **Enum validation**: `@enum(val1, val2, val3)`
- **Auto-generate schemas**: Right-click any event to create a template
- **Import/Export**: Share schemas as JSON files

### Export Options

- **dataLayer only**: a plain JSON array of the pushed objects, in order, nothing added (what `JSON.stringify(dataLayer)` would give)
- **Full JSON**: events with trigger attribution, category and validation results, plus a session summary (machine-readable twin of the Evidence PDF)
- **Test Assertions**: Generate Playwright or Cypress test code
- **Evidence**: Create PDF documents for QA reports

### Developer Experience

- Keyboard shortcuts (`Alt+Shift+D` to turn Strata on/off)
- Search and filter events
- JSON tree view with syntax highlighting
- Copy events to clipboard

## Installation

### From Chrome Web Store

[Install Strata](https://chromewebstore.google.com/detail/strata/foboeokfpclddbplomimopfihhlfnebk) (coming soon)

### Manual Installation

1. Download the latest release from here
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extracted folder

## Usage

1. Open Chrome DevTools (`F12` or `Cmd+Opt+I`)
2. Navigate to the **Strata** tab
3. Turn capture **on** (it starts off; the toolbar icon shows `OFF`). Events already in the dataLayer are picked up as "Pre-existing"
4. Interact with the page to capture dataLayer events
5. Create schemas to validate event structure
6. Export events or test assertions as needed

## Development

### Prerequisites

- Node.js 20+
- pnpm 10 (`corepack enable` picks the pinned version from package.json)

### Setup

```bash
# Install dependencies
pnpm install

# Development mode (hot reload)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright)
```

### Smoke test in a real Chrome

`tests/fixtures/pages/strata-smoke.html` logs every Strata message that crosses the page (handshake, captured events with their trigger, containers), so you can verify the capture pipeline without opening DevTools.

```bash
pnpm smoke          # serve the fixtures on http://127.0.0.1:8765 and open the smoke page
pnpm smoke:status   # is it running?
pnpm smoke:stop     # stop it
```

Load the built extension, turn capture on, interact with the page and read the log on screen or `window.__strataLog` in the console. Export JSON from the panel to compare. Options: `--port <n>`, `--no-open`, `--fg` (foreground).

### Store screenshots and promo tiles

The Web Store wants 24-bit PNG (no alpha) at exact sizes: screenshots 1280×800, small tile 440×280, marquee 1400×560. Capture however you like and normalize:

```bash
pnpm store:image capture.png src/assets/screenshots/screenshot-1.png              # 1280x800
pnpm store:image tile.png src/assets/promo/promo-440x280.png --size small           # 440x280
pnpm store:image banner.png src/assets/promo/promo-1400x560.png --size marquee      # 1400x560
```

Options: `--fit cover` to fill instead of letterbox, `--bg #rrggbb` for the letterbox colour, `--trim` to drop the margin macOS adds around a window capture. macOS names captures with a narrow no-break space (U+202F) before "AM/PM", so a path typed by hand will not match: rename the capture first (e.g. `mv ~/Desktop/Screenshot*.png capture.png`) or pass it through a shell glob, and call `node scripts/store-image.mjs` directly, since `pnpm run` joins its arguments into one string and drops the quotes.

Suggested capture flow for the panel: `pnpm smoke`, turn capture on, interact until the timeline tells a story, undock DevTools into its own window (⋮ → Dock side → Undock), make that window wide, and capture it (macOS: ⌘⇧4, then Space, click the window; run with `--trim`). Screenshots and tiles are uploaded in the Web Store dashboard; they are not part of the extension zip.

### Releasing

1. Bump `version` in `manifest.json` and `package.json`, move the CHANGELOG's _Unreleased_ section under the new version.
2. Commit, then tag and push: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
3. CI builds the extension, creates the GitHub Release for the tag with that version's CHANGELOG section as notes, and attaches `strata-vX.Y.Z.zip` to it, ready for the Web Store. (The "Source code" archives GitHub adds are the repository, not the extension.)

### Project Structure

```
src/
├── page/           # Injected script (dataLayer interception)
├── content/        # Content script (message relay)
├── background/     # Service worker (state management)
├── devtools/       # DevTools panel (React UI)
├── popup/          # Popup quick view
└── shared/         # Shared types and utilities
```

### Documentation

- `docs/TECH-DEBT.md` — living document: findings, decisions and their status. Start here.
- `docs/SPEC.md`, `docs/DESIGN.md`, `docs/PLAN.md`, `docs/TEST-CASES.md` — the original design (March 2026), kept as a record of intent; each carries a note listing what the code has since changed.
- `PERMISSIONS.md`, `PRIVACY.md` — what the extension may do and what it records; kept in sync with `manifest.json`.
- `tests/fixtures/pages/strata-smoke.html` — manual smoke test that logs every Strata message crossing the page.

## Tech Stack

- TypeScript (strict mode)
- React 19
- Vite + CRXJS
- Tailwind CSS 4
- Zustand 5
- Vitest + Playwright

## Privacy

Strata operates entirely locally. No data is collected, transmitted, or stored externally. All captured events remain in your browser's memory and are cleared when you close the tab.

See our [Privacy Policy](./PRIVACY.md) for details.

## License

GNU General Public License v3.0 — see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome!

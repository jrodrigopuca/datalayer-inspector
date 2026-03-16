# Strata

> The Developer's DataLayer Inspector — Inspect, validate and export your GTM dataLayer in real-time.

A Chrome DevTools extension built for developers and technical analysts who need more than just a viewer.

## Features

### Real-time Event Capture

- Intercepts all `dataLayer.push()` calls as they happen
- Multi-container GTM support
- Pause/resume recording
- Event timeline with color-coded categories (GTM, Ecommerce, Custom, Errors)

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

- **JSON**: Export events for debugging or documentation
- **Test Assertions**: Generate Playwright or Cypress test code
- **Evidence**: Create PNG or PDF screenshots for QA reports

### Developer Experience

- Keyboard shortcuts (`Alt+Shift+D` to toggle recording)
- Search and filter events
- JSON tree view with syntax highlighting
- Copy events to clipboard

## Installation

### From Chrome Web Store

[Install Strata](https://chrome.google.com/webstore/detail/strata/YOUR_EXTENSION_ID) (coming soon)

### Manual Installation

1. Download the latest release from here
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extracted folder

## Usage

1. Open Chrome DevTools (`F12` or `Cmd+Opt+I`)
2. Navigate to the **Strata** tab
3. Interact with the page to capture dataLayer events
4. Create schemas to validate event structure
5. Export events or test assertions as needed

## Development

### Prerequisites

- Node.js 20+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
```

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

MIT — see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please read the documentation in the `docs/` folder before submitting PRs.

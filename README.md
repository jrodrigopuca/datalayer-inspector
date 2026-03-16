# Strata

> The Developer's DataLayer Inspector — Inspect, validate and export your GTM dataLayer in real-time.

A Chrome DevTools extension built for developers and technical analysts who need more than just a viewer.

## Status

**Phase 2 (Differentiation): In Progress**

### Phase 1 (Complete)

- Real-time dataLayer event capture
- DevTools panel with event timeline and JSON tree view
- Multi-container GTM support
- Search and filter events
- Copy events to clipboard
- Popup quick view

### Phase 2 (Current)

- ✅ Schema validation with template-based matching
- ✅ Export as JSON file
- ✅ Export as Playwright/Cypress test assertions
- ✅ Export evidence images (PNG/PDF)
- ⏳ Diff view for comparing snapshots

## Schema Validation

Strata includes a powerful schema validation system using JSON templates:

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

**Features:**
- **Template-based matching**: Schemas apply when all literal values match
- **Type placeholders**: `@string`, `@number`, `@boolean`, `@array`, `@object`, `@any`
- **Optional fields**: `@string?`, `@number?` or `@optional` (won't fail if missing)
- **Enum validation**: `@enum(val1, val2, val3)`
- **Nested object and array validation**
- **Create schema from event**: Right-click any event to auto-generate a template
- **Import/Export**: Share schemas as JSON files

## Development

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

### Setup

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Run tests
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

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

## Documentation

- [PLAN.md](./docs/PLAN.md) — Development roadmap
- [SPEC.md](./docs/SPEC.md) — Technical specification
- [DESIGN.md](./docs/DESIGN.md) — Architecture and patterns
- [TEST-CASES.md](./docs/TEST-CASES.md) — Test cases and fixtures

## Tech Stack

- TypeScript (strict mode)
- React 19
- Vite + CRXJS
- Tailwind CSS 4
- Zustand 5
- Vitest + Playwright

## Metrics

| Metric | Value |
|--------|-------|
| Page script size | 2.9 KB |
| Total bundle | ~285 KB |
| Unit tests | 150 passing |
| E2E tests | 18 passing |

## License

MIT

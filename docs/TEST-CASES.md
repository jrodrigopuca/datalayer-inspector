# Strata — Test Cases

> Derivado de [SPEC.md](./SPEC.md) — Marzo 2026

Este documento define todos los casos de prueba, mocks necesarios, y scripts para validar la implementación.

---

## Índice

1. [Estrategia de Testing](#1-estrategia-de-testing)
2. [Mocks y Fixtures](#2-mocks-y-fixtures)
3. [Unit Tests](#3-unit-tests)
4. [Integration Tests](#4-integration-tests)
5. [E2E Tests](#5-e2e-tests)
6. [Performance Tests](#6-performance-tests)
7. [Scripts de Testing](#7-scripts-de-testing)

---

## 1. Estrategia de Testing

### 1.1 Herramientas

| Herramienta | Uso |
|-------------|-----|
| **Vitest** | Unit tests, mocking, coverage |
| **Playwright** | E2E tests con extensión cargada |
| **@vitest/coverage-v8** | Coverage reports |

### 1.2 Estructura de Archivos

```
src/
├── page/
│   ├── index.ts
│   └── index.test.ts          # Unit tests del page script
├── content/
│   ├── index.ts
│   └── index.test.ts          # Unit tests del content script
├── background/
│   ├── index.ts
│   ├── tab-manager.ts
│   ├── tab-manager.test.ts    # Unit tests
│   ├── port-manager.ts
│   ├── port-manager.test.ts   # Unit tests
│   ├── storage.ts
│   └── storage.test.ts        # Unit tests
├── shared/
│   ├── types.ts
│   ├── messages.ts
│   ├── messages.test.ts       # Unit tests
│   └── constants.ts
├── devtools/panel/
│   ├── store.ts
│   ├── store.test.ts          # Unit tests
│   ├── lib/
│   │   ├── json-tree.ts
│   │   ├── json-tree.test.ts  # Unit tests
│   │   ├── search.ts
│   │   └── search.test.ts     # Unit tests
│   └── components/
│       └── *.test.tsx         # Component tests (opcional)
tests/
├── e2e/
│   ├── capture.spec.ts        # E2E: captura de eventos
│   ├── devtools.spec.ts       # E2E: panel de DevTools
│   ├── navigation.spec.ts     # E2E: navegación y SPAs
│   └── multi-container.spec.ts# E2E: múltiples containers
├── fixtures/
│   ├── pages/                 # HTML pages para tests
│   │   ├── gtm-basic.html
│   │   ├── gtm-multi-container.html
│   │   ├── gtm-preloaded.html
│   │   ├── no-gtm.html
│   │   └── spa-react.html
│   └── data/
│       ├── events.json        # Eventos de ejemplo
│       └── schemas.json       # Schemas de ejemplo (Fase 2)
└── mocks/
    ├── chrome-api.ts          # Mock de chrome.* APIs
    └── window.ts              # Mock de window para page script
```

### 1.3 Coverage Targets

| Módulo | Target | Razón |
|--------|--------|-------|
| `src/page/` | > 90% | Core crítico, interceptación |
| `src/background/` | > 85% | Gestión de estado central |
| `src/shared/` | > 95% | Contratos, deben ser bulletproof |
| `src/devtools/panel/lib/` | > 80% | Lógica de búsqueda y rendering |
| `src/devtools/panel/components/` | > 60% | UI, se valida más con E2E |

---

## 2. Mocks y Fixtures

### 2.1 Chrome API Mock (`tests/mocks/chrome-api.ts`)

```typescript
import { vi } from 'vitest';

// Types para el mock
interface MockPort {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  onMessage: {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
  onDisconnect: {
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
  disconnect: ReturnType<typeof vi.fn>;
  sender?: chrome.runtime.MessageSender;
}

interface MockStorage {
  data: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

// Factory para crear ports mockeados
export function createMockPort(name: string, tabId?: number): MockPort {
  return {
    name,
    postMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    disconnect: vi.fn(),
    sender: tabId ? { tab: { id: tabId } } : undefined,
  };
}

// Factory para storage mockeado
export function createMockStorage(): MockStorage {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn((keys: string | string[]) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: data[keys] });
      }
      const result: Record<string, unknown> = {};
      keys.forEach(k => { result[k] = data[k]; });
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(data, items);
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      const keysArr = typeof keys === 'string' ? [keys] : keys;
      keysArr.forEach(k => delete data[k]);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(data).forEach(k => delete data[k]);
      return Promise.resolve();
    }),
  };
}

// Mock completo de chrome.*
export function setupChromeMock() {
  const sessionStorage = createMockStorage();
  const syncStorage = createMockStorage();
  const localStorage = createMockStorage();

  const chrome = {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      connect: vi.fn(() => createMockPort('test')),
      onConnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
      id: 'mock-extension-id',
    },
    storage: {
      session: sessionStorage,
      sync: syncStorage,
      local: localStorage,
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    webNavigation: {
      onCommitted: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onBeforeNavigate: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    devtools: {
      inspectedWindow: {
        tabId: 123,
        eval: vi.fn(),
      },
      panels: {
        create: vi.fn(),
        themeName: 'dark',
      },
    },
    scripting: {
      executeScript: vi.fn(() => Promise.resolve([{ result: undefined }])),
    },
  };

  // @ts-expect-error - mock global
  globalThis.chrome = chrome;

  return chrome;
}

// Reset all mocks
export function resetChromeMock() {
  if (globalThis.chrome) {
    vi.clearAllMocks();
  }
}
```

### 2.2 Window Mock para Page Script (`tests/mocks/window.ts`)

```typescript
import { vi } from 'vitest';

interface MockDataLayer extends Array<Record<string, unknown>> {
  push: ReturnType<typeof vi.fn>;
}

interface MockGoogleTagManager {
  [containerId: string]: {
    dataLayer?: { name: string };
  };
}

export function createMockDataLayer(initialEvents: Record<string, unknown>[] = []): MockDataLayer {
  const arr = [...initialEvents] as MockDataLayer;
  const originalPush = Array.prototype.push.bind(arr);
  arr.push = vi.fn((...items) => originalPush(...items));
  return arr;
}

export function createMockGoogleTagManager(containers: string[]): MockGoogleTagManager {
  const gtm: MockGoogleTagManager = {};
  containers.forEach(id => {
    gtm[id] = { dataLayer: { name: 'dataLayer' } };
  });
  return gtm;
}

export function setupWindowMock(options: {
  dataLayer?: Record<string, unknown>[];
  containers?: string[];
  url?: string;
} = {}) {
  const mockDataLayer = createMockDataLayer(options.dataLayer);
  const mockGTM = options.containers ? createMockGoogleTagManager(options.containers) : undefined;

  const mockWindow = {
    dataLayer: mockDataLayer,
    google_tag_manager: mockGTM,
    location: {
      href: options.url || 'https://example.com/page',
      origin: 'https://example.com',
      pathname: '/page',
    },
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    crypto: {
      randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  };

  return mockWindow;
}
```

### 2.3 Event Fixtures (`tests/fixtures/data/events.json`)

```json
{
  "basicPageView": {
    "event": "page_view",
    "page_title": "Home Page",
    "page_location": "https://example.com/"
  },
  "ecommerceAddToCart": {
    "event": "add_to_cart",
    "ecommerce": {
      "currency": "USD",
      "value": 29.99,
      "items": [
        {
          "item_id": "SKU-123",
          "item_name": "Widget",
          "price": 29.99,
          "quantity": 1
        }
      ]
    }
  },
  "ecommercePurchase": {
    "event": "purchase",
    "ecommerce": {
      "transaction_id": "T-12345",
      "currency": "USD",
      "value": 59.98,
      "tax": 4.99,
      "shipping": 5.99,
      "items": [
        {
          "item_id": "SKU-123",
          "item_name": "Widget",
          "price": 29.99,
          "quantity": 2
        }
      ]
    }
  },
  "gtmInternal": {
    "event": "gtm.js",
    "gtm.start": 1710500000000
  },
  "customEvent": {
    "event": "custom_interaction",
    "category": "engagement",
    "action": "click",
    "label": "hero_button"
  },
  "pushWithoutEvent": {
    "user_id": "U-12345",
    "user_type": "premium"
  }
}
```

### 2.4 HTML Test Pages (`tests/fixtures/pages/`)

#### `gtm-basic.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>GTM Basic Test Page</title>
  <script>
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'event': 'gtm.js',
      'gtm.start': Date.now()
    });
  </script>
  <!-- Simulated GTM container -->
  <script>
    window.google_tag_manager = window.google_tag_manager || {};
    window.google_tag_manager['GTM-TEST01'] = {
      dataLayer: { name: 'dataLayer' }
    };
  </script>
</head>
<body>
  <h1>GTM Basic Test Page</h1>
  <button id="add-to-cart" onclick="pushAddToCart()">Add to Cart</button>
  <button id="purchase" onclick="pushPurchase()">Purchase</button>

  <script>
    function pushAddToCart() {
      dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          currency: 'USD',
          value: 29.99,
          items: [{ item_id: 'SKU-123', item_name: 'Widget', price: 29.99 }]
        }
      });
    }

    function pushPurchase() {
      dataLayer.push({
        event: 'purchase',
        ecommerce: {
          transaction_id: 'T-' + Date.now(),
          currency: 'USD',
          value: 59.98,
          items: [{ item_id: 'SKU-123', item_name: 'Widget', price: 29.99, quantity: 2 }]
        }
      });
    }
  </script>
</body>
</html>
```

#### `gtm-multi-container.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Multi Container Test Page</title>
  <script>
    window.dataLayer = window.dataLayer || [];
    window.dataLayer2 = window.dataLayer2 || [];
    
    window.google_tag_manager = {
      'GTM-AAAA01': { dataLayer: { name: 'dataLayer' } },
      'GTM-BBBB02': { dataLayer: { name: 'dataLayer2' } }
    };
  </script>
</head>
<body>
  <h1>Multi Container Test</h1>
  <button id="push-dl1" onclick="dataLayer.push({event:'from_dl1'})">Push to DL1</button>
  <button id="push-dl2" onclick="dataLayer2.push({event:'from_dl2'})">Push to DL2</button>
</body>
</html>
```

#### `gtm-preloaded.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Preloaded DataLayer Test</title>
  <script>
    // DataLayer created and populated BEFORE extension loads
    window.dataLayer = [
      { event: 'gtm.js', 'gtm.start': Date.now() },
      { event: 'page_view', page_title: 'Preloaded Page' },
      { user_id: 'U-PRELOAD', user_type: 'returning' }
    ];
    window.google_tag_manager = {
      'GTM-PRELOAD': { dataLayer: { name: 'dataLayer' } }
    };
  </script>
</head>
<body>
  <h1>Preloaded DataLayer Test</h1>
  <p>This page has 3 events already in dataLayer before extension injection.</p>
</body>
</html>
```

#### `no-gtm.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>No GTM Page</title>
</head>
<body>
  <h1>No GTM Installed</h1>
  <p>This page has no dataLayer or GTM.</p>
</body>
</html>
```

---

## 3. Unit Tests

### 3.1 Page Script Tests (`src/page/index.test.ts`)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupWindowMock } from '../../tests/mocks/window';

// Note: Import the actual module after setting up mocks
// import { initializeInterceptor } from './index';

describe('Page Script - DataLayer Interceptor', () => {
  let mockWindow: ReturnType<typeof setupWindowMock>;
  let postedMessages: Array<{ type: string; payload: unknown }>;

  beforeEach(() => {
    postedMessages = [];
    mockWindow = setupWindowMock({
      url: 'https://example.com/test',
      containers: ['GTM-TEST01'],
    });
    mockWindow.postMessage = vi.fn((msg) => {
      if (msg?.source === '__DATALAYER_INSPECTOR__') {
        postedMessages.push(msg);
      }
    });
    // @ts-expect-error - mock
    globalThis.window = mockWindow;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Push Interception', () => {
    it('TC-PAGE-001: should intercept dataLayer.push and emit DL_EVENT_CAPTURED', () => {
      // Arrange
      // initializeInterceptor();
      
      // Act
      mockWindow.dataLayer.push({ event: 'test_event', value: 123 });

      // Assert
      expect(postedMessages).toHaveLength(1);
      expect(postedMessages[0]).toMatchObject({
        source: '__DATALAYER_INSPECTOR__',
        type: 'DL_EVENT_CAPTURED',
        payload: expect.objectContaining({
          eventName: 'test_event',
          data: { event: 'test_event', value: 123 },
          url: 'https://example.com/test',
        }),
      });
    });

    it('TC-PAGE-002: should handle push without event key', () => {
      // initializeInterceptor();
      
      mockWindow.dataLayer.push({ user_id: 'U-123', segment: 'premium' });

      expect(postedMessages[0].payload).toMatchObject({
        eventName: null,
        data: { user_id: 'U-123', segment: 'premium' },
      });
    });

    it('TC-PAGE-003: should handle multiple arguments in single push call', () => {
      // initializeInterceptor();
      
      mockWindow.dataLayer.push(
        { event: 'event_1' },
        { event: 'event_2' },
        { event: 'event_3' }
      );

      expect(postedMessages).toHaveLength(3);
      expect(postedMessages.map(m => (m.payload as any).eventName)).toEqual([
        'event_1', 'event_2', 'event_3'
      ]);
    });

    it('TC-PAGE-004: should generate unique IDs for each event', () => {
      // initializeInterceptor();
      
      mockWindow.dataLayer.push({ event: 'e1' });
      mockWindow.dataLayer.push({ event: 'e2' });

      const id1 = (postedMessages[0].payload as any).id;
      const id2 = (postedMessages[1].payload as any).id;
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('TC-PAGE-005: should capture timestamp with Date.now()', () => {
      const before = Date.now();
      // initializeInterceptor();
      
      mockWindow.dataLayer.push({ event: 'timed' });
      
      const after = Date.now();
      const timestamp = (postedMessages[0].payload as any).timestamp;
      
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('TC-PAGE-006: should not break original push functionality', () => {
      // initializeInterceptor();
      
      const result = mockWindow.dataLayer.push({ event: 'test' });

      expect(result).toBe(1); // Array.push returns new length
      expect(mockWindow.dataLayer).toHaveLength(1);
      expect(mockWindow.dataLayer[0]).toEqual({ event: 'test' });
    });

    it('TC-PAGE-007: should assign sequential index to events', () => {
      // initializeInterceptor();
      
      mockWindow.dataLayer.push({ event: 'first' });
      mockWindow.dataLayer.push({ event: 'second' });
      mockWindow.dataLayer.push({ event: 'third' });

      expect((postedMessages[0].payload as any).index).toBe(1);
      expect((postedMessages[1].payload as any).index).toBe(2);
      expect((postedMessages[2].payload as any).index).toBe(3);
    });
  });

  describe('Container Detection', () => {
    it('TC-PAGE-008: should detect GTM containers from google_tag_manager', () => {
      // initializeInterceptor();
      
      mockWindow.dataLayer.push({ event: 'test' });

      expect((postedMessages[0].payload as any).containerIds).toContain('GTM-TEST01');
    });

    it('TC-PAGE-009: should detect multiple containers', () => {
      mockWindow = setupWindowMock({
        containers: ['GTM-AAAA', 'GTM-BBBB', 'GTM-CCCC'],
      });
      // @ts-expect-error - mock
      globalThis.window = mockWindow;
      // initializeInterceptor();
      
      mockWindow.dataLayer.push({ event: 'test' });

      const containers = (postedMessages[0].payload as any).containerIds;
      expect(containers).toContain('GTM-AAAA');
      expect(containers).toContain('GTM-BBBB');
      expect(containers).toContain('GTM-CCCC');
    });

    it('TC-PAGE-010: should handle page without GTM', () => {
      mockWindow = setupWindowMock({ containers: undefined });
      mockWindow.google_tag_manager = undefined;
      // @ts-expect-error - mock
      globalThis.window = mockWindow;
      // initializeInterceptor();
      
      mockWindow.dataLayer.push({ event: 'test' });

      expect((postedMessages[0].payload as any).containerIds).toEqual([]);
    });
  });

  describe('Existing Events Processing', () => {
    it('TC-PAGE-011: should process pre-existing events in dataLayer', () => {
      mockWindow = setupWindowMock({
        dataLayer: [
          { event: 'gtm.js' },
          { event: 'page_view' },
        ],
      });
      // @ts-expect-error - mock
      globalThis.window = mockWindow;
      // initializeInterceptor();

      // Should emit events for existing items
      expect(postedMessages).toHaveLength(2);
      expect((postedMessages[0].payload as any).eventName).toBe('gtm.js');
      expect((postedMessages[1].payload as any).eventName).toBe('page_view');
    });

    it('TC-PAGE-012: should mark pre-existing events with timestamp 0', () => {
      mockWindow = setupWindowMock({
        dataLayer: [{ event: 'existing' }],
      });
      // @ts-expect-error - mock
      globalThis.window = mockWindow;
      // initializeInterceptor();

      expect((postedMessages[0].payload as any).timestamp).toBe(0);
    });
  });

  describe('DataLayer Creation Detection', () => {
    it('TC-PAGE-013: should intercept dataLayer created after script injection', async () => {
      mockWindow = setupWindowMock();
      delete (mockWindow as any).dataLayer;
      // @ts-expect-error - mock
      globalThis.window = mockWindow;
      // initializeInterceptor();

      // Simulate dataLayer being created later
      mockWindow.dataLayer = [];
      mockWindow.dataLayer.push({ event: 'late_event' });

      // Note: This requires Object.defineProperty setter - implementation detail
      expect(postedMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('TC-PAGE-014: should not throw on malformed push data', () => {
      // initializeInterceptor();

      expect(() => {
        mockWindow.dataLayer.push(null as any);
        mockWindow.dataLayer.push(undefined as any);
        mockWindow.dataLayer.push(42 as any);
        mockWindow.dataLayer.push('string' as any);
      }).not.toThrow();
    });

    it('TC-PAGE-015: should handle circular references in data', () => {
      // initializeInterceptor();
      
      const circular: any = { event: 'circular' };
      circular.self = circular;

      expect(() => {
        mockWindow.dataLayer.push(circular);
      }).not.toThrow();
      
      // Should still emit the event (with circular ref handled)
      expect(postedMessages).toHaveLength(1);
    });
  });

  describe('Idempotency', () => {
    it('TC-PAGE-016: should not duplicate wrapper if called twice', () => {
      // initializeInterceptor();
      // initializeInterceptor(); // Call again
      
      mockWindow.dataLayer.push({ event: 'test' });

      // Should only have 1 event, not 2
      expect(postedMessages).toHaveLength(1);
    });
  });
});
```

### 3.2 Tab Manager Tests (`src/background/tab-manager.test.ts`)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupChromeMock, resetChromeMock } from '../../tests/mocks/chrome-api';

// import { TabManager } from './tab-manager';
// import type { DataLayerEvent, TabState } from '../shared/types';

describe('Tab Manager', () => {
  // let tabManager: TabManager;

  beforeEach(() => {
    resetChromeMock();
    setupChromeMock();
    // tabManager = new TabManager();
  });

  describe('Tab State Management', () => {
    it('TC-BG-001: should create new tab state on first event', () => {
      // const event = createMockEvent({ eventName: 'test' });
      // tabManager.addEvent(123, event);
      
      // const state = tabManager.getState(123);
      // expect(state).toBeDefined();
      // expect(state?.events).toHaveLength(1);
    });

    it('TC-BG-002: should accumulate events for same tab', () => {
      // tabManager.addEvent(123, createMockEvent({ eventName: 'e1' }));
      // tabManager.addEvent(123, createMockEvent({ eventName: 'e2' }));
      // tabManager.addEvent(123, createMockEvent({ eventName: 'e3' }));
      
      // const state = tabManager.getState(123);
      // expect(state?.events).toHaveLength(3);
    });

    it('TC-BG-003: should maintain separate state per tab', () => {
      // tabManager.addEvent(100, createMockEvent({ eventName: 'tab100' }));
      // tabManager.addEvent(200, createMockEvent({ eventName: 'tab200' }));
      
      // expect(tabManager.getState(100)?.events).toHaveLength(1);
      // expect(tabManager.getState(200)?.events).toHaveLength(1);
      // expect(tabManager.getState(100)?.events[0].eventName).toBe('tab100');
      // expect(tabManager.getState(200)?.events[0].eventName).toBe('tab200');
    });

    it('TC-BG-004: should enforce maxEventsPerTab limit (FIFO)', () => {
      // tabManager.setMaxEvents(5);
      // for (let i = 1; i <= 10; i++) {
      //   tabManager.addEvent(123, createMockEvent({ eventName: `e${i}` }));
      // }
      
      // const state = tabManager.getState(123);
      // expect(state?.events).toHaveLength(5);
      // expect(state?.events[0].eventName).toBe('e6'); // oldest kept
      // expect(state?.events[4].eventName).toBe('e10'); // newest
    });

    it('TC-BG-005: should assign sequential index to events', () => {
      // tabManager.addEvent(123, createMockEvent({}));
      // tabManager.addEvent(123, createMockEvent({}));
      
      // const state = tabManager.getState(123);
      // expect(state?.events[0].index).toBe(1);
      // expect(state?.events[1].index).toBe(2);
    });
  });

  describe('Tab Lifecycle', () => {
    it('TC-BG-006: should clear state when tab is removed', () => {
      // tabManager.addEvent(123, createMockEvent({}));
      // expect(tabManager.getState(123)).toBeDefined();
      
      // tabManager.removeTab(123);
      // expect(tabManager.getState(123)).toBeUndefined();
    });

    it('TC-BG-007: should reset events on navigation (keep containers)', () => {
      // tabManager.addEvent(123, createMockEvent({}));
      // tabManager.updateContainers(123, ['GTM-AAAA']);
      
      // tabManager.onNavigate(123, 'https://example.com/new-page');
      
      // const state = tabManager.getState(123);
      // expect(state?.events).toHaveLength(0);
      // expect(state?.url).toBe('https://example.com/new-page');
      // expect(state?.containers).toEqual(['GTM-AAAA']); // kept
    });
  });

  describe('Recording State', () => {
    it('TC-BG-008: should ignore events when recording is paused', () => {
      // tabManager.setRecording(123, false);
      // tabManager.addEvent(123, createMockEvent({}));
      
      // const state = tabManager.getState(123);
      // expect(state?.events).toHaveLength(0);
    });

    it('TC-BG-009: should resume capturing when recording is re-enabled', () => {
      // tabManager.setRecording(123, false);
      // tabManager.addEvent(123, createMockEvent({ eventName: 'ignored' }));
      
      // tabManager.setRecording(123, true);
      // tabManager.addEvent(123, createMockEvent({ eventName: 'captured' }));
      
      // const state = tabManager.getState(123);
      // expect(state?.events).toHaveLength(1);
      // expect(state?.events[0].eventName).toBe('captured');
    });
  });

  describe('Clear Events', () => {
    it('TC-BG-010: should clear events but keep metadata', () => {
      // tabManager.addEvent(123, createMockEvent({}));
      // tabManager.updateContainers(123, ['GTM-TEST']);
      
      // tabManager.clearEvents(123);
      
      // const state = tabManager.getState(123);
      // expect(state?.events).toHaveLength(0);
      // expect(state?.containers).toEqual(['GTM-TEST']);
      // expect(state?.isRecording).toBe(true);
    });

    it('TC-BG-011: should reset nextIndex after clear', () => {
      // tabManager.addEvent(123, createMockEvent({}));
      // tabManager.addEvent(123, createMockEvent({}));
      // tabManager.clearEvents(123);
      // tabManager.addEvent(123, createMockEvent({}));
      
      // const state = tabManager.getState(123);
      // expect(state?.events[0].index).toBe(1); // reset
    });
  });
});

// Helper
function createMockEvent(overrides: Partial<any> = {}): any {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    url: 'https://example.com',
    eventName: null,
    data: {},
    containerIds: [],
    source: 'dataLayer',
    index: 0,
    ...overrides,
  };
}
```

### 3.3 Message Validation Tests (`src/shared/messages.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';

// import { 
//   createDLEventMessage,
//   isValidPageToContentMessage,
//   isValidContentToBackgroundMessage,
//   MESSAGE_SOURCE
// } from './messages';

describe('Message Protocol', () => {
  describe('Message Creation', () => {
    it('TC-MSG-001: should create valid DL_EVENT_CAPTURED message', () => {
      // const msg = createDLEventMessage({
      //   id: 'test-id',
      //   timestamp: 12345,
      //   url: 'https://example.com',
      //   eventName: 'test',
      //   data: { event: 'test' },
      //   containerIds: ['GTM-XXX'],
      //   sourceName: 'dataLayer',
      //   index: 1,
      // });
      
      // expect(msg.source).toBe(MESSAGE_SOURCE);
      // expect(msg.type).toBe('DL_EVENT_CAPTURED');
      // expect(msg.payload.id).toBe('test-id');
    });
  });

  describe('Message Validation', () => {
    it('TC-MSG-002: should validate correct PageToContent message', () => {
      // const validMsg = {
      //   source: MESSAGE_SOURCE,
      //   type: 'DL_EVENT_CAPTURED',
      //   payload: { id: 'x', timestamp: 0, url: '', eventName: null, data: {}, containerIds: [], sourceName: '', index: 1 },
      // };
      
      // expect(isValidPageToContentMessage(validMsg)).toBe(true);
    });

    it('TC-MSG-003: should reject message without correct source', () => {
      // const invalidMsg = {
      //   source: 'other-extension',
      //   type: 'DL_EVENT_CAPTURED',
      //   payload: {},
      // };
      
      // expect(isValidPageToContentMessage(invalidMsg)).toBe(false);
    });

    it('TC-MSG-004: should reject message with unknown type', () => {
      // const invalidMsg = {
      //   source: MESSAGE_SOURCE,
      //   type: 'UNKNOWN_TYPE',
      //   payload: {},
      // };
      
      // expect(isValidPageToContentMessage(invalidMsg)).toBe(false);
    });

    it('TC-MSG-005: should handle null/undefined gracefully', () => {
      // expect(isValidPageToContentMessage(null)).toBe(false);
      // expect(isValidPageToContentMessage(undefined)).toBe(false);
      // expect(isValidPageToContentMessage({})).toBe(false);
    });
  });
});
```

### 3.4 Search Engine Tests (`src/devtools/panel/lib/search.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';

// import { searchEvents, highlightMatches } from './search';
// import type { DataLayerEvent } from '../../../shared/types';

describe('Search Engine', () => {
  const mockEvents: any[] = [
    { id: '1', eventName: 'page_view', data: { page_title: 'Home' } },
    { id: '2', eventName: 'add_to_cart', data: { ecommerce: { items: [{ item_id: 'SKU-123' }] } } },
    { id: '3', eventName: 'purchase', data: { ecommerce: { transaction_id: 'T-999' } } },
    { id: '4', eventName: null, data: { user_id: 'U-ABC' } },
  ];

  describe('Basic Search', () => {
    it('TC-SEARCH-001: should find events by event name', () => {
      // const results = searchEvents(mockEvents, 'page_view');
      // expect(results).toHaveLength(1);
      // expect(results[0].id).toBe('1');
    });

    it('TC-SEARCH-002: should find events by nested value', () => {
      // const results = searchEvents(mockEvents, 'SKU-123');
      // expect(results).toHaveLength(1);
      // expect(results[0].id).toBe('2');
    });

    it('TC-SEARCH-003: should be case-insensitive', () => {
      // const results = searchEvents(mockEvents, 'PAGE_VIEW');
      // expect(results).toHaveLength(1);
    });

    it('TC-SEARCH-004: should return all events for empty query', () => {
      // const results = searchEvents(mockEvents, '');
      // expect(results).toHaveLength(4);
    });

    it('TC-SEARCH-005: should return empty for no matches', () => {
      // const results = searchEvents(mockEvents, 'nonexistent');
      // expect(results).toHaveLength(0);
    });
  });

  describe('Multi-Token Search (AND)', () => {
    it('TC-SEARCH-006: should require all tokens to match', () => {
      // "ecommerce" AND "SKU" should only match add_to_cart
      // const results = searchEvents(mockEvents, 'ecommerce SKU');
      // expect(results).toHaveLength(1);
      // expect(results[0].id).toBe('2');
    });

    it('TC-SEARCH-007: should work with tokens in different fields', () => {
      // const results = searchEvents(mockEvents, 'purchase T-999');
      // expect(results).toHaveLength(1);
      // expect(results[0].id).toBe('3');
    });
  });

  describe('Search Performance', () => {
    it('TC-SEARCH-008: should search 500 events in < 10ms', () => {
      const manyEvents = Array.from({ length: 500 }, (_, i) => ({
        id: `${i}`,
        eventName: `event_${i}`,
        data: { index: i, value: `value_${i}`, nested: { deep: `deep_${i}` } },
      }));

      const start = performance.now();
      // searchEvents(manyEvents, 'value_499');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('Highlight Matches', () => {
    it('TC-SEARCH-009: should return paths of matching keys/values', () => {
      // const highlights = highlightMatches(mockEvents[1], 'SKU');
      // expect(highlights).toContain('ecommerce.items.0.item_id');
    });
  });
});
```

### 3.5 JSON Tree Logic Tests (`src/devtools/panel/lib/json-tree.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';

// import { 
//   getNodeType, 
//   getNodePreview, 
//   flattenTree, 
//   getValueAtPath 
// } from './json-tree';

describe('JSON Tree Logic', () => {
  describe('Type Detection', () => {
    it('TC-TREE-001: should detect string type', () => {
      // expect(getNodeType('hello')).toBe('string');
    });

    it('TC-TREE-002: should detect number type', () => {
      // expect(getNodeType(42)).toBe('number');
      // expect(getNodeType(3.14)).toBe('number');
    });

    it('TC-TREE-003: should detect boolean type', () => {
      // expect(getNodeType(true)).toBe('boolean');
      // expect(getNodeType(false)).toBe('boolean');
    });

    it('TC-TREE-004: should detect null type', () => {
      // expect(getNodeType(null)).toBe('null');
    });

    it('TC-TREE-005: should detect array type', () => {
      // expect(getNodeType([1, 2, 3])).toBe('array');
    });

    it('TC-TREE-006: should detect object type', () => {
      // expect(getNodeType({ a: 1 })).toBe('object');
    });
  });

  describe('Node Preview', () => {
    it('TC-TREE-007: should show array length in preview', () => {
      // expect(getNodePreview([1, 2, 3])).toBe('Array(3)');
    });

    it('TC-TREE-008: should show object key count in preview', () => {
      // expect(getNodePreview({ a: 1, b: 2 })).toBe('{2 keys}');
    });

    it('TC-TREE-009: should truncate long strings', () => {
      // const longString = 'a'.repeat(150);
      // const preview = getNodePreview(longString);
      // expect(preview.length).toBeLessThanOrEqual(103); // 100 + "..."
      // expect(preview.endsWith('...')).toBe(true);
    });

    it('TC-TREE-010: should show primitives as-is', () => {
      // expect(getNodePreview(42)).toBe('42');
      // expect(getNodePreview(true)).toBe('true');
      // expect(getNodePreview(null)).toBe('null');
    });
  });

  describe('Path Resolution', () => {
    const testObj = {
      ecommerce: {
        items: [
          { item_id: 'SKU-1', price: 10 },
          { item_id: 'SKU-2', price: 20 },
        ],
        value: 30,
      },
    };

    it('TC-TREE-011: should resolve simple path', () => {
      // expect(getValueAtPath(testObj, 'ecommerce.value')).toBe(30);
    });

    it('TC-TREE-012: should resolve array index path', () => {
      // expect(getValueAtPath(testObj, 'ecommerce.items.0.item_id')).toBe('SKU-1');
      // expect(getValueAtPath(testObj, 'ecommerce.items.1.price')).toBe(20);
    });

    it('TC-TREE-013: should return undefined for invalid path', () => {
      // expect(getValueAtPath(testObj, 'nonexistent.path')).toBeUndefined();
    });
  });
});
```

---

## 4. Integration Tests

### 4.1 Message Flow Integration (`tests/integration/message-flow.test.ts`)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupChromeMock, createMockPort } from '../mocks/chrome-api';

describe('Message Flow Integration', () => {
  beforeEach(() => {
    setupChromeMock();
  });

  it('TC-INT-001: Content Script receives and relays Page Script messages', () => {
    // Setup: Mock window.addEventListener
    // Trigger: Simulate postMessage from page
    // Assert: chrome.runtime.sendMessage called with correct payload
  });

  it('TC-INT-002: Service Worker receives and stores Content Script messages', () => {
    // Setup: Initialize service worker
    // Trigger: Simulate chrome.runtime.onMessage
    // Assert: Tab state updated with new event
  });

  it('TC-INT-003: Service Worker broadcasts to connected DevTools ports', () => {
    // Setup: Connect mock port
    // Trigger: Add event to tab
    // Assert: port.postMessage called with NEW_EVENT
  });

  it('TC-INT-004: Service Worker responds to GET_EVENTS request', () => {
    // Setup: Add events to tab
    // Trigger: Send GET_EVENTS message
    // Assert: Response contains all events
  });
});
```

---

## 5. E2E Tests

### 5.1 Capture Flow (`tests/e2e/capture.spec.ts`)

```typescript
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

// Path to the built extension
const EXTENSION_PATH = path.join(__dirname, '../../dist');

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

test.describe('DataLayer Capture', () => {
  test('TC-E2E-001: Should capture dataLayer.push events', async () => {
    const page = await context.newPage();
    await page.goto('file://' + path.join(__dirname, '../fixtures/pages/gtm-basic.html'));

    // Push an event
    await page.click('#add-to-cart');

    // Open DevTools panel (this is tricky - may need to use chrome.devtools APIs)
    // For now, verify via page console or storage
    
    const events = await page.evaluate(() => {
      // Access extension storage or exposed debug API
      return (window as any).__DATALAYER_INSPECTOR_DEBUG__?.events || [];
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('TC-E2E-002: Should capture pre-existing dataLayer events', async () => {
    const page = await context.newPage();
    await page.goto('file://' + path.join(__dirname, '../fixtures/pages/gtm-preloaded.html'));

    // Wait for extension to process
    await page.waitForTimeout(500);

    // Verify existing events were captured
    // This requires accessing extension state somehow
  });

  test('TC-E2E-003: Should handle page without dataLayer', async () => {
    const page = await context.newPage();
    await page.goto('file://' + path.join(__dirname, '../fixtures/pages/no-gtm.html'));

    // Extension should not crash, popup should show "No dataLayer detected"
  });

  test('TC-E2E-004: Should capture events after SPA navigation', async () => {
    // Test with React Router or similar SPA setup
  });
});
```

### 5.2 DevTools Panel (`tests/e2e/devtools.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('DevTools Panel', () => {
  test('TC-E2E-010: Should display event timeline', async () => {
    // Open page, capture events, verify timeline shows events
  });

  test('TC-E2E-011: Should select and display event details', async () => {
    // Click event in timeline, verify detail view shows JSON
  });

  test('TC-E2E-012: Should filter events by search query', async () => {
    // Type in search bar, verify filtered results
  });

  test('TC-E2E-013: Should clear events on button click', async () => {
    // Click clear, verify timeline is empty
  });

  test('TC-E2E-014: Should pause/resume recording', async () => {
    // Toggle recording, verify events are/aren't captured
  });

  test('TC-E2E-015: Should copy event to clipboard', async () => {
    // Click copy, verify clipboard content
  });

  test('TC-E2E-016: Should toggle between tree and raw view', async () => {
    // Click toggle, verify view changes
  });
});
```

### 5.3 Multi-Container (`tests/e2e/multi-container.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Multi-Container Support', () => {
  test('TC-E2E-020: Should detect multiple GTM containers', async () => {
    // Load multi-container page, verify all containers shown
  });

  test('TC-E2E-021: Should capture events from different dataLayer arrays', async () => {
    // Push to dataLayer and dataLayer2, verify both captured
  });

  test('TC-E2E-022: Should filter by container', async () => {
    // Apply container filter, verify only matching events shown
  });
});
```

---

## 6. Performance Tests

### 6.1 Performance Benchmarks (`tests/performance/benchmarks.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';

describe('Performance Benchmarks', () => {
  describe('Page Script Overhead', () => {
    it('TC-PERF-001: Push interception overhead < 1ms', () => {
      const iterations = 1000;
      // Setup interceptor
      
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        // dataLayer.push({ event: `test_${i}` });
      }
      const duration = performance.now() - start;
      const perPush = duration / iterations;

      expect(perPush).toBeLessThan(1);
    });
  });

  describe('Search Performance', () => {
    it('TC-PERF-002: Search 500 events < 10ms', () => {
      // Already covered in search.test.ts TC-SEARCH-008
    });
  });

  describe('Memory Usage', () => {
    it('TC-PERF-003: 500 events < 5MB memory', () => {
      // Create 500 events with ~2KB each
      const events = Array.from({ length: 500 }, (_, i) => ({
        id: `id-${i}`,
        timestamp: Date.now(),
        url: 'https://example.com/page',
        eventName: `event_${i}`,
        data: {
          ecommerce: {
            items: Array.from({ length: 5 }, (_, j) => ({
              item_id: `SKU-${j}`,
              item_name: `Product ${j}`,
              price: Math.random() * 100,
            })),
          },
        },
        containerIds: ['GTM-TEST'],
        source: 'dataLayer',
        index: i,
      }));

      const json = JSON.stringify(events);
      const sizeBytes = new Blob([json]).size;
      const sizeMB = sizeBytes / (1024 * 1024);

      expect(sizeMB).toBeLessThan(5);
    });
  });
});
```

---

## 7. Scripts de Testing

### 7.1 Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:all": "npm run test:coverage && npm run test:e2e"
  }
}
```

### 7.2 Vitest Config (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
        'src/devtools/panel/components/**', // Lower coverage target
      ],
      thresholds: {
        'src/page/': { lines: 90, branches: 85 },
        'src/background/': { lines: 85, branches: 80 },
        'src/shared/': { lines: 95, branches: 90 },
        'src/devtools/panel/lib/': { lines: 80, branches: 75 },
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
    },
  },
});
```

### 7.3 Playwright Config (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Extensions require sequential runs
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension tests
  reporter: [['html'], ['list']],
  timeout: 30000,
  use: {
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 7.4 Test Setup (`tests/setup.ts`)

```typescript
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupChromeMock, resetChromeMock } from './mocks/chrome-api';

beforeAll(() => {
  // Setup global mocks
  setupChromeMock();
});

afterEach(() => {
  // Clear mock call history between tests
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup
  resetChromeMock();
});
```

---

## 8. Test Case Summary

### 8.1 Por Módulo

| Módulo | Test Cases | IDs |
|--------|------------|-----|
| Page Script | 16 | TC-PAGE-001 to TC-PAGE-016 |
| Tab Manager | 11 | TC-BG-001 to TC-BG-011 |
| Messages | 5 | TC-MSG-001 to TC-MSG-005 |
| Search Engine | 9 | TC-SEARCH-001 to TC-SEARCH-009 |
| JSON Tree | 13 | TC-TREE-001 to TC-TREE-013 |
| Integration | 4 | TC-INT-001 to TC-INT-004 |
| E2E Capture | 4 | TC-E2E-001 to TC-E2E-004 |
| E2E DevTools | 7 | TC-E2E-010 to TC-E2E-016 |
| E2E Multi-Container | 3 | TC-E2E-020 to TC-E2E-022 |
| Performance | 3 | TC-PERF-001 to TC-PERF-003 |
| **Total** | **75** | |

### 8.2 Por Prioridad

| Prioridad | Test Cases | Descripción |
|-----------|------------|-------------|
| **P0 - Críticos** | 25 | Core capture, message flow, tab management |
| **P1 - Importantes** | 30 | Search, tree view, multi-container |
| **P2 - Nice-to-have** | 20 | Performance, edge cases, error handling |

### 8.3 Matriz de Trazabilidad

| SPEC Section | Test Cases |
|--------------|------------|
| §6 Page Script | TC-PAGE-* |
| §7 Content Script | TC-INT-001, TC-INT-002 |
| §8 Service Worker | TC-BG-*, TC-INT-003, TC-INT-004 |
| §9 DevTools Panel | TC-TREE-*, TC-SEARCH-*, TC-E2E-010 to TC-E2E-016 |
| §5 Message Protocol | TC-MSG-* |
| §14 Performance | TC-PERF-* |

---

## 9. Fase 2 — Test Cases Adicionales

> Los siguientes test cases se implementarán cuando se desarrolle la Fase 2.

### 9.1 Schema Validation

| ID | Descripción |
|----|-------------|
| TC-SCHEMA-001 | Validar evento que pasa todas las reglas |
| TC-SCHEMA-002 | Detectar campo required faltante |
| TC-SCHEMA-003 | Detectar tipo incorrecto |
| TC-SCHEMA-004 | Validar campos en arrays (items[].item_id) |
| TC-SCHEMA-005 | Match con pattern regex |
| TC-SCHEMA-006 | Warning para campos opcionales faltantes |
| TC-SCHEMA-007 | Import/export schemas JSON |

### 9.2 Diff Engine

| ID | Descripción |
|----|-------------|
| TC-DIFF-001 | Detectar keys agregadas |
| TC-DIFF-002 | Detectar keys eliminadas |
| TC-DIFF-003 | Detectar valores modificados |
| TC-DIFF-004 | Diff en objetos deeply nested |
| TC-DIFF-005 | Diff de arrays por índice |

### 9.3 Test Code Generator

| ID | Descripción |
|----|-------------|
| TC-GEN-001 | Generar Playwright con valores exactos |
| TC-GEN-002 | Generar Playwright con type-only assertions |
| TC-GEN-003 | Generar Cypress con valores exactos |
| TC-GEN-004 | Código generado compila sin errores |
| TC-GEN-005 | Incluir navigation y waits opcionales |

### 9.4 Export Evidence Image (Feature 2.5)

> Exportación de evidencias visuales (PNG/PDF) para documentación QA.

#### Unit Tests

| ID | Descripción |
|----|-------------|
| TC-EVIDENCE-001 | Generar PNG con un solo evento |
| TC-EVIDENCE-002 | Generar PNG con múltiples eventos |
| TC-EVIDENCE-003 | Generar PDF con metadata de proyecto |
| TC-EVIDENCE-004 | Incluir resumen de validación en evidence |
| TC-EVIDENCE-005 | Respetar tema (light/dark/system) |
| TC-EVIDENCE-006 | Excluir eventos no seleccionados |
| TC-EVIDENCE-007 | Summary level muestra solo event names |
| TC-EVIDENCE-008 | Full level muestra payloads completos |

#### Integration Tests

| ID | Descripción |
|----|-------------|
| TC-EVIDENCE-INT-001 | Exportar evidence desde panel con eventos filtrados |
| TC-EVIDENCE-INT-002 | Evidence incluye validation status de schema |
| TC-EVIDENCE-INT-003 | Evidence muestra container ID correcto |
| TC-EVIDENCE-INT-004 | Timestamp formatting consistente |

#### E2E Tests

| ID | Descripción |
|----|-------------|
| TC-EVIDENCE-E2E-001 | Click "Export Evidence" abre diálogo de opciones |
| TC-EVIDENCE-E2E-002 | Selección de formato (PNG/PDF) funciona |
| TC-EVIDENCE-E2E-003 | Download se dispara con nombre correcto |
| TC-EVIDENCE-E2E-004 | PNG generado tiene dimensiones razonables |
| TC-EVIDENCE-E2E-005 | PDF generado es válido y se puede abrir |

#### Visual Regression Tests

| ID | Descripción |
|----|-------------|
| TC-EVIDENCE-VIS-001 | Evidence PNG coincide con snapshot baseline |
| TC-EVIDENCE-VIS-002 | Evidence dark theme coincide con snapshot |
| TC-EVIDENCE-VIS-003 | Evidence con errores de validación tiene estilos correctos |

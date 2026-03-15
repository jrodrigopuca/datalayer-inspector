import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Mock chrome APIs globally
const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    connect: vi.fn(() => ({
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
    })),
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
    id: "mock-extension-id",
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  devtools: {
    inspectedWindow: {
      tabId: 1,
    },
    panels: {
      create: vi.fn(),
    },
  },
};

beforeAll(() => {
  vi.stubGlobal("chrome", chromeMock);
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

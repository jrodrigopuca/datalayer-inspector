/**
 * Handshake between the isolated relay and the MAIN-world page script
 * (docs/TECH-DEBT.md, item 5).
 */

import {
  BACKGROUND_TO_CONTENT_TYPE,
  CONTENT_TO_PAGE_TYPE,
  MESSAGE_SOURCE,
} from "@shared/types";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { postConfigToPage, setEnabled, startRelay, stopRelay } from "./relay";

const mocked = (fn: unknown): Mock => fn as Mock;

type BackgroundHandler = (message: unknown) => void;
type PageHandler = (event: MessageEvent<unknown>) => void;

describe("relay <-> page config handshake", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;
  let addListener: ReturnType<typeof vi.spyOn>;
  let backgroundHandler: BackgroundHandler;
  let pageHandler: PageHandler;

  beforeEach(() => {
    setEnabled(true);
    mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
    postMessage = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => undefined);
    addListener = vi.spyOn(window, "addEventListener");

    startRelay();

    backgroundHandler = mocked(chrome.runtime.onMessage.addListener).mock
      .calls[0]?.[0] as BackgroundHandler;
    const call = addListener.mock.calls.find(
      (c: unknown[]) => c[0] === "message"
    );
    pageHandler = call?.[1] as unknown as PageHandler;
  });

  afterEach(() => {
    stopRelay();
    postMessage.mockRestore();
    addListener.mockRestore();
  });

  it("posts DL_CONFIG to the page with the effective settings", () => {
    postConfigToPage({ enabled: true, dataLayerNames: ["dataLayer", "dl2"] });

    expect(postMessage).toHaveBeenCalledWith(
      {
        source: MESSAGE_SOURCE,
        type: CONTENT_TO_PAGE_TYPE.CONFIG,
        payload: { enabled: true, dataLayerNames: ["dataLayer", "dl2"] },
      },
      "*"
    );
  });

  it("forwards SET_ENABLED to the page, keeping the last dataLayer names", () => {
    postConfigToPage({ enabled: true, dataLayerNames: ["dataLayer", "dl2"] });
    postMessage.mockClear();

    backgroundHandler({
      type: BACKGROUND_TO_CONTENT_TYPE.SET_ENABLED,
      payload: { enabled: false },
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CONTENT_TO_PAGE_TYPE.CONFIG,
        payload: { enabled: false, dataLayerNames: ["dataLayer", "dl2"] },
      }),
      "*"
    );
  });

  it("does not relay its own DL_CONFIG message to the service worker", () => {
    pageHandler({
      source: window,
      data: {
        source: MESSAGE_SOURCE,
        type: CONTENT_TO_PAGE_TYPE.CONFIG,
        payload: { enabled: true, dataLayerNames: ["dataLayer"] },
      },
    } as unknown as MessageEvent<unknown>);

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

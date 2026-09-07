import { LIMITS } from "@shared/constants";
import { describe, expect, it, vi } from "vitest";
import {
  CONTEXT_INVALIDATED_MESSAGE,
  decideReconnect,
  describeCommandFailure,
  describeVersionChange,
  isContextInvalidatedError,
  isExtensionContextInvalidated,
  NO_RESPONSE_MESSAGE,
  runCommand,
} from "./connection-policy";

describe("isExtensionContextInvalidated", () => {
  it("is false for a live runtime", () => {
    expect(isExtensionContextInvalidated({ id: "abcdef" })).toBe(false);
  });

  it("is true when the runtime lost its id (extension reloaded)", () => {
    expect(isExtensionContextInvalidated({ id: undefined })).toBe(true);
    expect(isExtensionContextInvalidated({ id: "" })).toBe(true);
    expect(isExtensionContextInvalidated(null)).toBe(true);
  });

  it("reads the global chrome mock by default", () => {
    expect(isExtensionContextInvalidated()).toBe(false);
  });
});

describe("decideReconnect", () => {
  it("keeps retrying with an actionable message when the context looks invalidated", () => {
    const decision = decideReconnect({ attempt: 1, contextInvalidated: true });

    expect(decision).toEqual({
      delayMs: 1000,
      message: CONTEXT_INVALIDATED_MESSAGE,
    });
    expect(CONTEXT_INVALIDATED_MESSAGE).toContain("reopen DevTools");
  });

  it("retries immediately the first time (no timer to be throttled)", () => {
    expect(decideReconnect({ attempt: 0, contextInvalidated: false })).toEqual({
      delayMs: 0,
      message: null,
    });
  });

  it("then backs off exponentially from the base delay, silently", () => {
    const delays = [1, 2, 3, 4, 5].map((attempt) =>
      decideReconnect({ attempt, contextInvalidated: false })
    );

    expect(delays).toEqual([
      { delayMs: 1000, message: null },
      { delayMs: 2000, message: null },
      { delayMs: 4000, message: null },
      { delayMs: 8000, message: null },
      { delayMs: 16000, message: null },
    ]);
  });

  it("caps the delay and never gives up, whatever the hint says", () => {
    for (const attempt of [6, 7, 10, 50, 1000]) {
      for (const contextInvalidated of [false, true]) {
        expect(decideReconnect({ attempt, contextInvalidated }).delayMs).toBe(
          LIMITS.RECONNECT_MAX_DELAY
        );
      }
    }
  });
});

describe("describeVersionChange", () => {
  it("is silent when versions match or are unknown", () => {
    expect(describeVersionChange("1.5.0", "1.5.0")).toBeNull();
    expect(describeVersionChange(null, "1.5.0")).toBeNull();
    expect(describeVersionChange("1.5.0", null)).toBeNull();
  });

  it("tells the user to reopen DevTools when the extension changed underneath", () => {
    const message = describeVersionChange("1.4.0", "1.5.0");

    expect(message).toContain("1.4.0 → 1.5.0");
    expect(message).toContain("reopen DevTools");
  });
});

describe("isContextInvalidatedError", () => {
  it("recognises Chrome's error text", () => {
    expect(
      isContextInvalidatedError(new Error("Extension context invalidated."))
    ).toBe(true);
    expect(isContextInvalidatedError(new Error("Something else"))).toBe(false);
    expect(isContextInvalidatedError("Extension context invalidated.")).toBe(
      false
    );
  });
});

describe("describeCommandFailure", () => {
  it("explains an invalidated context", () => {
    expect(describeCommandFailure(new Error("x"), true)).toBe(
      CONTEXT_INVALIDATED_MESSAGE
    );
    expect(
      describeCommandFailure(new Error("Extension context invalidated."), false)
    ).toBe(CONTEXT_INVALIDATED_MESSAGE);
  });

  it("explains a missing answer", () => {
    expect(
      describeCommandFailure(
        new Error("No response from the service worker"),
        false
      )
    ).toBe(NO_RESPONSE_MESSAGE);
  });

  it("falls back to the error detail", () => {
    expect(describeCommandFailure(new Error("quota"), false)).toBe(
      "Command failed: quota"
    );
    expect(describeCommandFailure(undefined, false)).toBe(
      "Command failed: unknown error"
    );
  });
});

describe("runCommand", () => {
  it("reports nothing on success", async () => {
    const report = vi.fn();

    await runCommand(async () => undefined, report);

    expect(report).not.toHaveBeenCalled();
  });

  it("routes a failure to the reporter instead of rejecting", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = vi.fn();

    await expect(
      runCommand(
        async () => {
          throw new Error("No response from the service worker");
        },
        report,
        () => false
      )
    ).resolves.toBeUndefined();

    expect(report).toHaveBeenCalledWith(NO_RESPONSE_MESSAGE);
    errorSpy.mockRestore();
  });

  it("names the invalidated context when that is the cause", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = vi.fn();

    await runCommand(
      async () => {
        throw new Error("No response from the service worker");
      },
      report,
      () => true
    );

    expect(report).toHaveBeenCalledWith(CONTEXT_INVALIDATED_MESSAGE);
    errorSpy.mockRestore();
  });
});

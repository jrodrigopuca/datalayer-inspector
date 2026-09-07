import { LIMITS } from "@shared/constants";
import { describe, expect, it, vi } from "vitest";
import {
  CONTEXT_INVALIDATED_MESSAGE,
  decideReconnect,
  describeCommandFailure,
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
  it("stops with an actionable message when the context is invalidated", () => {
    const decision = decideReconnect({ attempt: 0, contextInvalidated: true });

    expect(decision).toEqual({
      action: "stop",
      message: CONTEXT_INVALIDATED_MESSAGE,
    });
    expect(CONTEXT_INVALIDATED_MESSAGE).toContain("reopen DevTools");
  });

  it("backs off exponentially from the base delay", () => {
    const delays = [0, 1, 2, 3, 4].map((attempt) =>
      decideReconnect({ attempt, contextInvalidated: false })
    );

    expect(delays).toEqual([
      { action: "retry", delayMs: 1000 },
      { action: "retry", delayMs: 2000 },
      { action: "retry", delayMs: 4000 },
      { action: "retry", delayMs: 8000 },
      { action: "retry", delayMs: 16000 },
    ]);
  });

  it("caps the delay and never gives up", () => {
    for (const attempt of [5, 6, 10, 50, 1000]) {
      expect(decideReconnect({ attempt, contextInvalidated: false })).toEqual({
        action: "retry",
        delayMs: LIMITS.RECONNECT_MAX_DELAY,
      });
    }
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

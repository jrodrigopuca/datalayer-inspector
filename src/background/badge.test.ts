import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { updateBadge } from "./badge";

const mocked = (fn: unknown): Mock => fn as Mock;

describe("updateBadge", () => {
  beforeEach(() => {
    mocked(chrome.action.setBadgeText).mockResolvedValue(undefined);
    mocked(chrome.action.setBadgeBackgroundColor).mockResolvedValue(undefined);
  });

  it("shows OFF while capture is disabled", async () => {
    await updateBadge(false);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "OFF" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalled();
  });

  it("clears the badge when capture is enabled", async () => {
    await updateBadge(true);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("never throws when the action API fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocked(chrome.action.setBadgeText).mockRejectedValue(new Error("nope"));

    await expect(updateBadge(false)).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});

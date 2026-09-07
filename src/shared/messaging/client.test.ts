import { beforeEach, describe, expect, it, type Mock } from "vitest";
import { CLIENT_REQUEST_TYPE, CLIENT_RESPONSE_TYPE } from "../types";
import { sendRequest } from "./client";

const mocked = (fn: unknown): Mock => fn as Mock;

describe("sendRequest", () => {
  beforeEach(() => {
    mocked(chrome.runtime.sendMessage).mockReset();
  });

  it("resolves with the typed response", async () => {
    const response = { type: CLIENT_RESPONSE_TYPE.OK };
    mocked(chrome.runtime.sendMessage).mockResolvedValue(response);

    const request = { type: CLIENT_REQUEST_TYPE.GET_SETTINGS } as const;
    await expect(sendRequest(request)).resolves.toEqual(response);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(request);
  });

  it("rejects when nobody answered", async () => {
    mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);

    await expect(
      sendRequest({ type: CLIENT_REQUEST_TYPE.GET_SETTINGS })
    ).rejects.toThrow("No response from the service worker");
  });

  it("propagates runtime errors (service worker unreachable)", async () => {
    mocked(chrome.runtime.sendMessage).mockRejectedValue(
      new Error("Receiving end does not exist")
    );

    await expect(
      sendRequest({ type: CLIENT_REQUEST_TYPE.GET_SETTINGS })
    ).rejects.toThrow("Receiving end does not exist");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  detectContainers,
  getContainerIds,
  shouldRedetectContainers,
} from "./container-detector";

describe("container-detector", () => {
  beforeEach(() => {
    // Clean up window
    const win = window as unknown as Record<string, unknown>;
    delete win.google_tag_manager;
  });

  describe("detectContainers", () => {
    it("returns empty array when google_tag_manager doesn't exist", () => {
      expect(detectContainers()).toEqual([]);
    });

    it("returns empty array when google_tag_manager is not an object", () => {
      const win = window as unknown as Record<string, unknown>;
      win.google_tag_manager = "string";

      expect(detectContainers()).toEqual([]);
    });

    it("detects GTM containers", () => {
      const win = window as unknown as Record<string, unknown>;
      win.google_tag_manager = {
        "GTM-ABCD123": {
          dataLayer: { name: "dataLayer" },
        },
        "GTM-XYZ9876": {
          dataLayer: { name: "customLayer" },
        },
      };

      const containers = detectContainers();

      expect(containers).toHaveLength(2);
      expect(containers).toContainEqual({
        id: "GTM-ABCD123",
        dataLayerName: "dataLayer",
      });
      expect(containers).toContainEqual({
        id: "GTM-XYZ9876",
        dataLayerName: "customLayer",
      });
    });

    it("detects GA4 measurement IDs (G-XXXXX)", () => {
      const win = window as unknown as Record<string, unknown>;
      win.google_tag_manager = {
        "G-ABC123DEF": {
          dataLayer: { name: "dataLayer" },
        },
      };

      const containers = detectContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0]?.id).toBe("G-ABC123DEF");
    });

    it("detects GT- prefix containers", () => {
      const win = window as unknown as Record<string, unknown>;
      win.google_tag_manager = {
        "GT-ABC123": {
          dataLayer: { name: "dataLayer" },
        },
      };

      const containers = detectContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0]?.id).toBe("GT-ABC123");
    });

    it("ignores non-container keys", () => {
      const win = window as unknown as Record<string, unknown>;
      win.google_tag_manager = {
        "GTM-VALID": { dataLayer: { name: "dataLayer" } },
        dataLayer: {},
        "some-random-key": {},
        "gtm-lowercase": {}, // lowercase doesn't match
      };

      const containers = detectContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0]?.id).toBe("GTM-VALID");
    });

    it("defaults dataLayerName to 'dataLayer' when not specified", () => {
      const win = window as unknown as Record<string, unknown>;
      win.google_tag_manager = {
        "GTM-NONAME": {}, // No dataLayer property
      };

      const containers = detectContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0]?.dataLayerName).toBe("dataLayer");
    });
  });

  describe("getContainerIds", () => {
    it("returns only container IDs", () => {
      const win = window as unknown as Record<string, unknown>;
      win.google_tag_manager = {
        "GTM-AAA": { dataLayer: { name: "dl1" } },
        "GTM-BBB": { dataLayer: { name: "dl2" } },
      };

      const ids = getContainerIds();

      expect(ids).toEqual(["GTM-AAA", "GTM-BBB"]);
    });
  });

  describe("shouldRedetectContainers", () => {
    it("returns true for gtm.js event", () => {
      expect(shouldRedetectContainers("gtm.js")).toBe(true);
    });

    it("returns false for other events", () => {
      expect(shouldRedetectContainers("page_view")).toBe(false);
      expect(shouldRedetectContainers("gtm.dom")).toBe(false);
      expect(shouldRedetectContainers(null)).toBe(false);
    });
  });
});

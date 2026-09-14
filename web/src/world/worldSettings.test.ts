import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasStoredWorldSettings,
  normalizeWorldCharacterImageUrl,
  normalizeWorldPrometheusUrl,
  normalizeWorldLongRoomTitleMode,
  normalizeWorldRoomAlignment,
  readWorldCeoImageUrl,
  readWorldCharacterImageUrls,
  readWorldLayoutSettings,
  readWorldLongRoomTitleMode,
  readWorldSettings,
  readWorldRoomAlignment,
  writeWorldCharacterImageUrl,
  writeWorldLayoutSettings,
  writeWorldLongRoomTitleMode,
  writeWorldRoomAlignment,
  writeWorldSettings,
} from "./worldSettings";
import {
  DEFAULT_OFFICE_CEO_IMAGE_URL,
  DEFAULT_OFFICE_CHARACTER_IMAGE_URLS,
} from "./officeCharacters";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Office settings", () => {
  it("normalizes an optional Prometheus endpoint without accepting credentials or query state", () => {
    expect(normalizeWorldPrometheusUrl(" http://127.0.0.1:9101 ")).toBe(
      "http://127.0.0.1:9101/",
    );
    expect(normalizeWorldPrometheusUrl("https://metrics.example.test/prometheus")).toBe(
      "https://metrics.example.test/prometheus/",
    );
    expect(normalizeWorldPrometheusUrl("  ")).toBeNull();
    expect(() => normalizeWorldPrometheusUrl("ftp://metrics.example.test")).toThrow(
      /http:\/\/ or https:\/\//iu,
    );
    expect(() => normalizeWorldPrometheusUrl("http://user@metrics.example.test")).toThrow(
      /credentials/iu,
    );
    expect(() => normalizeWorldPrometheusUrl("http://metrics.example.test/?token=secret")).toThrow(
      /query string/iu,
    );
  });

  it("stores Office settings separately for each bridge", () => {
    let value: string | null = null;
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => value),
      setItem: vi.fn((_key: string, next: string) => {
        value = next;
      }),
    });

    expect(hasStoredWorldSettings("bridge-a")).toBe(false);
    writeWorldSettings("bridge-a", { prometheusUrl: "http://127.0.0.1:9101/" });
    writeWorldSettings("bridge-b", { prometheusUrl: null });

    expect(readWorldSettings("bridge-a")).toEqual({ prometheusUrl: "http://127.0.0.1:9101/" });
    expect(readWorldSettings("bridge-b")).toEqual({ prometheusUrl: null });
    expect(hasStoredWorldSettings("bridge-b")).toBe(true);
  });

  it("persists a validated Office room alignment preference", () => {
    let value: string | null = null;
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => value),
      setItem: vi.fn((_key: string, next: string) => {
        value = next;
      }),
    });

    expect(readWorldRoomAlignment()).toBe("left");
    expect(normalizeWorldRoomAlignment("center")).toBe("center");
    expect(normalizeWorldRoomAlignment("unexpected")).toBe("left");
    writeWorldRoomAlignment("right");
    expect(readWorldRoomAlignment()).toBe("right");
  });

  it("preserves the complete layout record when either field changes", () => {
    let value: string | null = null;
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => value),
      setItem: vi.fn((_key: string, next: string) => {
        value = next;
      }),
    });

    writeWorldLayoutSettings({ roomAlignment: "center", longRoomTitleMode: "compact" });
    writeWorldRoomAlignment("right");
    expect(readWorldLayoutSettings()).toEqual({ roomAlignment: "right", longRoomTitleMode: "compact" });
    writeWorldLongRoomTitleMode("expand");
    expect(readWorldLayoutSettings()).toEqual({ roomAlignment: "right", longRoomTitleMode: "expand" });
    expect(readWorldLongRoomTitleMode()).toBe("expand");
  });

  it("stores optional character image replacements with safe normalization", () => {
    let value: string | null = null;
    vi.stubGlobal("location", { origin: "http://127.0.0.1:8787" });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => value),
      setItem: vi.fn((_key: string, next: string) => {
        value = next;
      }),
    });

    expect(readWorldCeoImageUrl()).toBe(DEFAULT_OFFICE_CEO_IMAGE_URL);
    expect(readWorldCharacterImageUrls()).toEqual(DEFAULT_OFFICE_CHARACTER_IMAGE_URLS);
    expect(normalizeWorldCharacterImageUrl(" /custom/pixel.png#ignored ")).toBe("/custom/pixel.png");
    expect(normalizeWorldCharacterImageUrl("https://cdn.example.test/agent.webp#v1")).toBe(
      "https://cdn.example.test/agent.webp",
    );
    expect(() => normalizeWorldCharacterImageUrl("file:///Users/me/agent.png")).toThrow(/http/u);
    expect(() => normalizeWorldCharacterImageUrl("https://user:secret@example.test/agent.png")).toThrow(
      /credentials/u,
    );

    writeWorldCharacterImageUrl(1, " /custom/agent-2.png?rev=1 ");
    const urls = readWorldCharacterImageUrls();
    expect(urls[0]).toBe(DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[0]);
    expect(urls[1]).toBe("/custom/agent-2.png?rev=1");
  });

  it("normalizes missing or malformed sibling values independently", () => {
    let value = JSON.stringify({ roomAlignment: "right", longRoomTitleMode: "invalid" });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => value),
      setItem: vi.fn((_key: string, next: string) => {
        value = next;
      }),
    });

    expect(readWorldLayoutSettings()).toEqual({ roomAlignment: "right", longRoomTitleMode: "expand" });
    expect(normalizeWorldLongRoomTitleMode("compact")).toBe("compact");
    writeWorldLayoutSettings({ longRoomTitleMode: "compact" });
    expect(readWorldLayoutSettings()).toEqual({ roomAlignment: "right", longRoomTitleMode: "compact" });
  });
});

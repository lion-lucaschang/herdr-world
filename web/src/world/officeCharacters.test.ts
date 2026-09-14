import { describe, expect, it } from "vitest";

import {
  DEFAULT_OFFICE_CHARACTER_GALLERY,
  DEFAULT_OFFICE_CHARACTER_IMAGE_URLS,
  flattenOfficeCharacterGallery,
  officeCharacterImageUrlAt,
  parseOfficeCharacterGallery,
} from "./officeCharacters";

describe("Office character gallery", () => {
  it("falls back to the default character set for malformed gallery data", () => {
    expect(parseOfficeCharacterGallery(null)).toEqual(DEFAULT_OFFICE_CHARACTER_GALLERY);
    expect(parseOfficeCharacterGallery({ collections: [{ id: "empty", label: "Empty", items: [] }] }))
      .toEqual(DEFAULT_OFFICE_CHARACTER_GALLERY);
  });

  it("parses valid gallery collections and flattens labels for selection", () => {
    const gallery = parseOfficeCharacterGallery({
      collections: [
        {
          id: "robots",
          label: "Robots",
          items: [
            { id: "spark", label: "Spark", url: "/world/character-gallery/herdr/spark.svg" },
            { id: "broken", label: "Broken" },
          ],
        },
      ],
    });

    expect(gallery.collections).toHaveLength(1);
    expect(flattenOfficeCharacterGallery(gallery)).toEqual([
      {
        id: "spark",
        label: "Spark",
        collectionLabel: "Robots",
        url: "/world/character-gallery/herdr/spark.svg",
      },
    ]);
  });

  it("uses default character URLs for out-of-range image slots", () => {
    expect(officeCharacterImageUrlAt(["/custom.svg"], 0)).toBe("/custom.svg");
    expect(officeCharacterImageUrlAt(["/custom.svg"], 1)).toBe(
      DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[1],
    );
  });
});

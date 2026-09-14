export const OFFICE_CHARACTER_COUNT = 12;
export const DEFAULT_OFFICE_CEO_IMAGE_URL = "/world/characters/ceo-lobster.png";

export const DEFAULT_OFFICE_CHARACTER_IMAGE_URLS = Object.freeze(
  Array.from(
    { length: OFFICE_CHARACTER_COUNT },
    (_, index) => `/world/characters/${index + 1}-D-1.png`,
  ),
);

export const OFFICE_CHARACTER_GALLERY_URL = "/world/character-gallery/gallery.json";

export type OfficeCharacterImageUrls = readonly string[];

export type OfficeCharacterGalleryItem = {
  id: string;
  label: string;
  url: string;
};

export type OfficeCharacterGalleryCollection = {
  id: string;
  label: string;
  items: OfficeCharacterGalleryItem[];
};

export type OfficeCharacterGallery = {
  collections: OfficeCharacterGalleryCollection[];
};

export const DEFAULT_OFFICE_CHARACTER_GALLERY: OfficeCharacterGallery = Object.freeze({
  collections: [
    {
      id: "default",
      label: "Default characters",
      items: DEFAULT_OFFICE_CHARACTER_IMAGE_URLS.map((url, index) => ({
        id: `default-${index + 1}`,
        label: `Default ${index + 1}`,
        url,
      })),
    },
  ],
});

export function flattenOfficeCharacterGallery(gallery: OfficeCharacterGallery) {
  return gallery.collections.flatMap((collection) =>
    collection.items.map((item) => ({ ...item, collectionLabel: collection.label }))
  );
}

export function parseOfficeCharacterGallery(value: unknown): OfficeCharacterGallery {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_OFFICE_CHARACTER_GALLERY;
  }
  const collections = Array.isArray((value as { collections?: unknown }).collections)
    ? (value as { collections: unknown[] }).collections
    : [];
  const parsedCollections = collections.flatMap((collection): OfficeCharacterGalleryCollection[] => {
    if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
      return [];
    }
    const record = collection as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.label !== "string" || !Array.isArray(record.items)) {
      return [];
    }
    const items = record.items.flatMap((item): OfficeCharacterGalleryItem[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }
      const itemRecord = item as Record<string, unknown>;
      if (
        typeof itemRecord.id !== "string" ||
        typeof itemRecord.label !== "string" ||
        typeof itemRecord.url !== "string"
      ) {
        return [];
      }
      return [{ id: itemRecord.id, label: itemRecord.label, url: itemRecord.url }];
    });
    return items.length > 0 ? [{ id: record.id, label: record.label, items }] : [];
  });
  return parsedCollections.length > 0
    ? { collections: parsedCollections }
    : DEFAULT_OFFICE_CHARACTER_GALLERY;
}

export function officeCharacterImageUrlAt(
  urls: OfficeCharacterImageUrls,
  characterIndex: number,
) {
  return urls[characterIndex] ?? DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[characterIndex] ?? "";
}

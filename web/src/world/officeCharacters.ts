export const OFFICE_CHARACTER_COUNT = 12;

export const DEFAULT_OFFICE_CHARACTER_IMAGE_URLS = Object.freeze(
  Array.from(
    { length: OFFICE_CHARACTER_COUNT },
    (_, index) => `/world/characters/${index + 1}-D-1.png`,
  ),
);

export type OfficeCharacterImageUrls = readonly string[];

export function officeCharacterImageUrlAt(
  urls: OfficeCharacterImageUrls,
  characterIndex: number,
) {
  return urls[characterIndex] ?? DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[characterIndex] ?? "";
}

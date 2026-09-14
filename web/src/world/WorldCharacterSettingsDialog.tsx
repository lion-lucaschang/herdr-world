import { Image, RotateCcw, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { trapFocusWithin, useFocusReturn } from "../overlayFocus";
import {
  DEFAULT_OFFICE_CEO_IMAGE_URL,
  DEFAULT_OFFICE_CHARACTER_GALLERY,
  DEFAULT_OFFICE_CHARACTER_IMAGE_URLS,
  OFFICE_CHARACTER_GALLERY_URL,
  flattenOfficeCharacterGallery,
  parseOfficeCharacterGallery,
} from "./officeCharacters";
import {
  normalizeWorldCharacterImageUrl,
  readWorldCeoImageUrl,
  readWorldCharacterImageUrls,
  writeWorldCharacterSettings,
} from "./worldSettings";

type Props = {
  onClose: () => void;
  onSaved?: () => void;
};

export function WorldCharacterSettingsDialog({ onClose, onSaved }: Props) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [ceoImageUrl, setCeoImageUrl] = useState(readWorldCeoImageUrl);
  const [characterImageUrls, setCharacterImageUrls] = useState(readWorldCharacterImageUrls);
  const [characterGallery, setCharacterGallery] = useState(DEFAULT_OFFICE_CHARACTER_GALLERY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useFocusReturn();

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    let disposed = false;
    void fetch(OFFICE_CHARACTER_GALLERY_URL)
      .then((response) => response.ok ? response.json() : null)
      .then((value) => {
        if (!disposed) {
          setCharacterGallery(parseOfficeCharacterGallery(value));
        }
      })
      .catch(() => {
        if (!disposed) {
          setCharacterGallery(DEFAULT_OFFICE_CHARACTER_GALLERY);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const galleryItems = flattenOfficeCharacterGallery(characterGallery);

  const setCharacterImageUrl = (index: number, value: string) => {
    setCharacterImageUrls((current) => current.map((url, itemIndex) => itemIndex === index ? value : url));
  };

  const resetCharacterImageUrl = (index: number) => {
    setCharacterImageUrl(index, DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]);
  };

  const resetCeoImage = () => setCeoImageUrl(DEFAULT_OFFICE_CEO_IMAGE_URL);

  const loadImageFile = async (
    file: File | null,
    onLoaded: (dataUrl: string) => void,
  ) => {
    if (!file) {
      return;
    }
    if (!/^image\/(?:gif|jpeg|png|webp)$/u.test(file.type)) {
      setMessage("Character image files must be PNG, JPEG, GIF, or WebP.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      onLoaded(await readFileAsDataUrl(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load character image");
    } finally {
      setBusy(false);
    }
  };

  const loadCeoImageFile = (file: File | null) => loadImageFile(file, (dataUrl) => {
    setCeoImageUrl(normalizeWorldCharacterImageUrl(dataUrl) ?? DEFAULT_OFFICE_CEO_IMAGE_URL);
  });

  const loadCharacterImageFile = (index: number, file: File | null) => loadImageFile(file, (dataUrl) => {
    setCharacterImageUrl(index, normalizeWorldCharacterImageUrl(dataUrl) ?? DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]);
  });

  const save = () => {
    setBusy(true);
    setMessage(null);
    try {
      const normalizedCeoImageUrl = normalizeWorldCharacterImageUrl(ceoImageUrl) ?? DEFAULT_OFFICE_CEO_IMAGE_URL;
      const normalizedCharacterImageUrls = characterImageUrls.map((url, index) =>
        normalizeWorldCharacterImageUrl(url) ?? DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]
      );
      writeWorldCharacterSettings({ ceoImageUrl: normalizedCeoImageUrl, imageUrls: normalizedCharacterImageUrls });
      setCeoImageUrl(normalizedCeoImageUrl);
      setCharacterImageUrls(normalizedCharacterImageUrls);
      onSaved?.();
      setMessage("Character images saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save character settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay-root">
      <button className="overlay-scrim" type="button" aria-label="Close Character settings" onClick={onClose} />
      <form
        className="modal backend-modal world-character-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          trapFocusWithin(event);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <button
          className="modal-close icon-btn"
          ref={closeButtonRef}
          type="button"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        >
          <X size={15} />
        </button>
        <div id={titleId} className="modal-title">
          <Image size={17} aria-hidden="true" /> Character settings
        </div>
        <div className="settings-section settings-section-flat world-character-settings-content">
          <p className="settings-help">
            Replace the CEO and twelve Pixel Office character slots with image URLs, gallery items,
            or uploaded PNG, JPEG, GIF, or WebP files. Uploaded images are stored in this browser only.
          </p>
          <div className="world-character-settings-grid">
            <CharacterSettingCard
              title="CEO"
              imageUrl={ceoImageUrl}
              placeholder={DEFAULT_OFFICE_CEO_IMAGE_URL}
              busy={busy}
              galleryItems={galleryItems}
              galleryLabel="Choose CEO from gallery…"
              inputLabel="CEO image URL"
              resetDisabled={ceoImageUrl === DEFAULT_OFFICE_CEO_IMAGE_URL}
              onChange={setCeoImageUrl}
              onReset={resetCeoImage}
              onFile={(file) => void loadCeoImageFile(file)}
            />
            {characterImageUrls.map((imageUrl, index) => (
              <CharacterSettingCard
                key={index + 1}
                title={`Character ${index + 1}`}
                imageUrl={imageUrl}
                placeholder={DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]}
                busy={busy}
                galleryItems={galleryItems}
                galleryLabel="Choose from gallery…"
                inputLabel={`Character ${index + 1} image URL`}
                resetDisabled={imageUrl === DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]}
                onChange={(value) => setCharacterImageUrl(index, value)}
                onReset={() => resetCharacterImageUrl(index)}
                onFile={(file) => void loadCharacterImageFile(index, file)}
              />
            ))}
          </div>
          {message ? <div className="modal-message">{message}</div> : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

type GalleryItem = ReturnType<typeof flattenOfficeCharacterGallery>[number];

type CharacterSettingCardProps = {
  title: string;
  imageUrl: string;
  placeholder: string;
  busy: boolean;
  galleryItems: readonly GalleryItem[];
  galleryLabel: string;
  inputLabel: string;
  resetDisabled: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onFile: (file: File | null) => void;
};

function CharacterSettingCard({
  title,
  imageUrl,
  placeholder,
  busy,
  galleryItems,
  galleryLabel,
  inputLabel,
  resetDisabled,
  onChange,
  onReset,
  onFile,
}: CharacterSettingCardProps) {
  return (
    <div className="world-character-setting">
      <img
        className="world-character-setting-preview"
        src={imageUrl}
        alt=""
        aria-hidden="true"
      />
      <label className="field-label world-character-setting-field">
        <span>{title}</span>
        <input
          className="field"
          aria-label={inputLabel}
          value={imageUrl}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <details className="world-character-gallery-picker">
        <summary>{galleryLabel}</summary>
        <div className="world-character-gallery-options">
          {galleryItems.map((item) => (
            <button
              className="world-character-gallery-option"
              type="button"
              key={`${title}:${item.collectionLabel}:${item.id}`}
              aria-pressed={item.url === imageUrl}
              title={`${item.collectionLabel} · ${item.label}`}
              disabled={busy}
              onClick={() => onChange(item.url)}
            >
              <img src={item.url} alt="" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </details>
      <div className="world-character-setting-actions">
        <label className="btn btn-small world-character-upload">
          <Upload size={13} aria-hidden="true" /> Upload
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              onFile(file);
            }}
          />
        </label>
        <button
          className="btn btn-small"
          type="button"
          disabled={busy || resetDisabled}
          onClick={onReset}
        >
          <RotateCcw size={13} aria-hidden="true" /> Reset
        </button>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read character image"));
      }
    }, { once: true });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read character image")), {
      once: true,
    });
    reader.readAsDataURL(file);
  });
}

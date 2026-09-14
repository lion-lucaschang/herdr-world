import { Building2, CheckCircle2, CircleOff, RotateCcw, Upload, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SAME_ORIGIN_BRIDGE_ID, useBridge } from "../bridge";
import type { BridgeId } from "../bridge";
import {
  fetchWorldObservabilityConfiguration,
  hasStoredWorldSettings,
  normalizeWorldCharacterImageUrl,
  normalizeWorldPrometheusUrl,
  readWorldCeoImageUrl,
  readWorldCharacterImageUrls,
  readWorldLongRoomTitleMode,
  readWorldRoomAlignment,
  readWorldSettings,
  updateWorldObservabilityConfiguration,
  writeWorldCharacterSettings,
  writeWorldLayoutSettings,
  writeWorldSettings,
} from "./worldSettings";
import type { WorldObservabilityConfiguration } from "./worldSettings";
import type { OfficeLongRoomTitleMode, OfficeRoomAlignment } from "./officeGeometry";
import {
  DEFAULT_OFFICE_CEO_IMAGE_URL,
  DEFAULT_OFFICE_CHARACTER_GALLERY,
  DEFAULT_OFFICE_CHARACTER_IMAGE_URLS,
  OFFICE_CHARACTER_GALLERY_URL,
  flattenOfficeCharacterGallery,
  parseOfficeCharacterGallery,
} from "./officeCharacters";
import { trapFocusWithin, useFocusReturn } from "../overlayFocus";

type Props = {
  onClose: () => void;
  onSaved?: () => void;
};

export function WorldSettingsDialog({ onClose, onSaved }: Props) {
  const bridge = useBridge();
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const bridgeIds = useMemo(
    () => bridge.enabledRuntimes.map(({ id }) => id),
    [bridge.enabledRuntimes],
  );
  const [selectedBridgeId, setSelectedBridgeId] = useState<BridgeId | null>(
    () => bridge.lastSelectedBridgeId ?? bridgeIds[0] ?? null,
  );
  const [prometheusUrl, setPrometheusUrl] = useState("");
  const [roomAlignment, setRoomAlignment] = useState<OfficeRoomAlignment>(readWorldRoomAlignment);
  const [longRoomTitleMode, setLongRoomTitleMode] = useState<OfficeLongRoomTitleMode>(
    readWorldLongRoomTitleMode,
  );
  const [ceoImageUrl, setCeoImageUrl] = useState(readWorldCeoImageUrl);
  const [characterImageUrls, setCharacterImageUrls] = useState(readWorldCharacterImageUrls);
  const [characterGallery, setCharacterGallery] = useState(DEFAULT_OFFICE_CHARACTER_GALLERY);
  const [configuration, setConfiguration] = useState<WorldObservabilityConfiguration | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (selectedBridgeId && bridgeIds.includes(selectedBridgeId)) {
      return;
    }
    setSelectedBridgeId(bridge.lastSelectedBridgeId ?? bridgeIds[0] ?? null);
  }, [bridge.lastSelectedBridgeId, bridgeIds, selectedBridgeId]);

  const runtime = selectedBridgeId ? bridge.getRuntime(selectedBridgeId) : null;
  const galleryItems = flattenOfficeCharacterGallery(characterGallery);

  useEffect(() => {
    if (!runtime) {
      setPrometheusUrl("");
      setConfiguration(null);
      return;
    }
    let disposed = false;
    setLoading(true);
    setMessage(null);
    const stored = hasStoredWorldSettings(runtime.id) ? readWorldSettings(runtime.id) : null;
    if (stored) {
      setPrometheusUrl(stored.prometheusUrl ?? "");
    }
    void fetchWorldObservabilityConfiguration(runtime)
      .then((next) => {
        if (disposed) {
          return;
        }
        setConfiguration(next);
        if (!stored) {
          setPrometheusUrl(next.endpoint ?? "");
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setMessage(error instanceof Error ? error.message : "Could not load Office settings");
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, [runtime]);

  const setCharacterImageUrl = (index: number, value: string) => {
    setCharacterImageUrls((current) => current.map((url, itemIndex) => itemIndex === index ? value : url));
  };

  const resetCharacterImageUrl = (index: number) => {
    setCharacterImageUrl(index, DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]);
  };

  const setCeoImage = (value: string) => setCeoImageUrl(value);

  const resetCeoImage = () => setCeoImageUrl(DEFAULT_OFFICE_CEO_IMAGE_URL);

  const loadCharacterImageFile = async (index: number, file: File | null) => {
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
      const dataUrl = await readFileAsDataUrl(file);
      setCharacterImageUrl(index, normalizeWorldCharacterImageUrl(dataUrl) ?? DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load character image");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const normalizedCeoImageUrl = normalizeWorldCharacterImageUrl(ceoImageUrl) ?? DEFAULT_OFFICE_CEO_IMAGE_URL;
      const normalizedCharacterImageUrls = characterImageUrls.map((url, index) =>
        normalizeWorldCharacterImageUrl(url) ?? DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]
      );
      let normalized: string | null = null;
      if (runtime) {
        normalized = normalizeWorldPrometheusUrl(prometheusUrl);
        const next = await updateWorldObservabilityConfiguration(runtime, normalized);
        writeWorldSettings(runtime.id, { prometheusUrl: normalized });
        setPrometheusUrl(next.endpoint ?? "");
        setConfiguration(next);
      }
      writeWorldLayoutSettings({ roomAlignment, longRoomTitleMode });
      writeWorldCharacterSettings({ ceoImageUrl: normalizedCeoImageUrl, imageUrls: normalizedCharacterImageUrls });
      setCeoImageUrl(normalizedCeoImageUrl);
      setCharacterImageUrls(normalizedCharacterImageUrls);
      onSaved?.();
      setMessage(runtime
        ? normalized ? "Office settings saved." : "Office settings saved; Prometheus provider disabled."
        : "Office layout and characters saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save Office settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay-root">
      <button className="overlay-scrim" type="button" aria-label="Close Office settings" onClick={onClose} />
      <form
        className="modal backend-modal world-settings-modal"
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
          void save();
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
          <Building2 size={17} aria-hidden="true" /> Office settings
        </div>
        <div className="settings-section settings-section-flat world-settings-content">
          <div className="settings-label">Office host</div>
          {bridgeIds.length > 0 ? (
            <label className="field-label">
              <span>Bridge</span>
              <select
                className="field"
                value={selectedBridgeId ?? ""}
                onChange={(event) => setSelectedBridgeId(event.target.value)}
              >
                {bridgeIds.map((bridgeId) => {
                  const item = bridge.getRuntime(bridgeId);
                  return (
                    <option key={bridgeId} value={bridgeId}>
                      {item?.label ?? (bridgeId === SAME_ORIGIN_BRIDGE_ID ? "localhost" : bridgeId)}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : (
            <div className="backend-static">Enable a connected bridge to configure Office.</div>
          )}

          <div className="settings-label">Observability provider</div>
          <p className="settings-help">
            Optional Prometheus URL used by the bridge to populate the Economy board. Office
            sessions and terminals work without it. The browser never queries Prometheus directly.
          </p>
          <label className="field-label">
            <span>Prometheus URL</span>
            <input
              className="field"
              value={prometheusUrl}
              placeholder="http://127.0.0.1:9101"
              autoComplete="off"
              spellCheck={false}
              disabled={!runtime || loading || busy}
              onChange={(event) => setPrometheusUrl(event.target.value)}
            />
          </label>
          <label className="field-label">
            <span>Long room titles</span>
            <select
              className="field"
              value={longRoomTitleMode}
              disabled={busy}
              onChange={(event) => setLongRoomTitleMode(event.target.value as OfficeLongRoomTitleMode)}
            >
              <option value="expand">Expand long room titles</option>
              <option value="compact">Compact long room titles</option>
            </select>
          </label>
          <div className="world-settings-health" data-status={configuration?.configured ? "available" : "unavailable"}>
            {configuration?.configured ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
            <span>
              {loading
                ? "Loading provider configuration…"
                : configuration?.configured
                  ? `Configured: ${configuration.providerId}`
                  : "Not configured; Economy will show no data"}
            </span>
          </div>
          <div className="settings-label">Office layout</div>
          <p className="settings-help">
            Choose how room rows align inside the Office scene. This affects rooms only; the CEO
            Office and Agent Bar keep their dedicated positions.
          </p>
          <label className="field-label">
            <span>Room alignment</span>
            <select
              className="field"
              value={roomAlignment}
              disabled={busy}
              onChange={(event) => setRoomAlignment(event.target.value as OfficeRoomAlignment)}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>

          <div className="settings-label">Character images</div>
          <p className="settings-help">
            Replace the twelve Pixel Office character slots with image URLs or uploaded PNG, JPEG,
            GIF, or WebP files. Uploaded images are stored in this browser only.
          </p>
          <div className="world-character-settings-grid">
            <div className="world-character-setting world-character-setting-ceo">
              <img
                className="world-character-setting-preview"
                src={ceoImageUrl}
                alt=""
                aria-hidden="true"
              />
              <label className="field-label world-character-setting-field">
                <span>CEO</span>
                <input
                  className="field"
                  aria-label="CEO image URL"
                  value={ceoImageUrl}
                  placeholder={DEFAULT_OFFICE_CEO_IMAGE_URL}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  onChange={(event) => setCeoImage(event.target.value)}
                />
              </label>
              <details className="world-character-gallery-picker">
                <summary>Choose CEO from gallery…</summary>
                <div className="world-character-gallery-options">
                  {galleryItems.map((item) => (
                    <button
                      className="world-character-gallery-option"
                      type="button"
                      key={`ceo:${item.collectionLabel}:${item.id}`}
                      aria-pressed={item.url === ceoImageUrl}
                      title={`${item.collectionLabel} · ${item.label}`}
                      disabled={busy}
                      onClick={() => setCeoImage(item.url)}
                    >
                      <img src={item.url} alt="" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </details>
              <div className="world-character-setting-actions">
                <button
                  className="btn btn-small"
                  type="button"
                  disabled={busy || ceoImageUrl === DEFAULT_OFFICE_CEO_IMAGE_URL}
                  onClick={resetCeoImage}
                >
                  <RotateCcw size={13} aria-hidden="true" /> Reset
                </button>
              </div>
            </div>
            {characterImageUrls.map((imageUrl, index) => (
              <div className="world-character-setting" key={index + 1}>
                <img
                  className="world-character-setting-preview"
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                />
                <label className="field-label world-character-setting-field">
                  <span>Character {index + 1}</span>
                  <input
                    className="field"
                    aria-label={`Character ${index + 1} image URL`}
                    value={imageUrl}
                    placeholder={DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                    onChange={(event) => setCharacterImageUrl(index, event.target.value)}
                  />
                </label>
                <details className="world-character-gallery-picker">
                  <summary>Choose from gallery…</summary>
                  <div className="world-character-gallery-options">
                    {galleryItems.map((item) => (
                      <button
                        className="world-character-gallery-option"
                        type="button"
                        key={`${item.collectionLabel}:${item.id}`}
                        aria-pressed={item.url === imageUrl}
                        title={`${item.collectionLabel} · ${item.label}`}
                        disabled={busy}
                        onClick={() => setCharacterImageUrl(index, item.url)}
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
                        void loadCharacterImageFile(index, file);
                      }}
                    />
                  </label>
                  <button
                    className="btn btn-small"
                    type="button"
                    disabled={busy || imageUrl === DEFAULT_OFFICE_CHARACTER_IMAGE_URLS[index]}
                    onClick={() => resetCharacterImageUrl(index)}
                  >
                    <RotateCcw size={13} aria-hidden="true" /> Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
          {message ? <div className="modal-message">{message}</div> : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || loading}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
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

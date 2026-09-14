import { Building2, CheckCircle2, CircleOff, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { SAME_ORIGIN_BRIDGE_ID, useBridge } from "../bridge";
import type { BridgeId } from "../bridge";
import { trapFocusWithin, useFocusReturn } from "../overlayFocus";
import type { OfficeLongRoomTitleMode, OfficeRoomAlignment } from "./officeGeometry";
import {
  fetchWorldObservabilityConfiguration,
  hasStoredWorldSettings,
  normalizeWorldPrometheusUrl,
  readWorldLongRoomTitleMode,
  readWorldRoomAlignment,
  readWorldSettings,
  updateWorldObservabilityConfiguration,
  writeWorldLayoutSettings,
  writeWorldSettings,
} from "./worldSettings";
import type { WorldObservabilityConfiguration } from "./worldSettings";

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
  const [configuration, setConfiguration] = useState<WorldObservabilityConfiguration | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useFocusReturn();

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedBridgeId && bridgeIds.includes(selectedBridgeId)) {
      return;
    }
    setSelectedBridgeId(bridge.lastSelectedBridgeId ?? bridgeIds[0] ?? null);
  }, [bridge.lastSelectedBridgeId, bridgeIds, selectedBridgeId]);

  const runtime = selectedBridgeId ? bridge.getRuntime(selectedBridgeId) : null;

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

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let normalized: string | null = null;
      if (runtime) {
        normalized = normalizeWorldPrometheusUrl(prometheusUrl);
        const next = await updateWorldObservabilityConfiguration(runtime, normalized);
        writeWorldSettings(runtime.id, { prometheusUrl: normalized });
        setPrometheusUrl(next.endpoint ?? "");
        setConfiguration(next);
      }
      writeWorldLayoutSettings({ roomAlignment, longRoomTitleMode });
      onSaved?.();
      setMessage(runtime
        ? normalized ? "Office settings saved." : "Office settings saved; Prometheus provider disabled."
        : "Office layout saved.");
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

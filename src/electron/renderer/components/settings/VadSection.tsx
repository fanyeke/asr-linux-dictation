import { useCallback, useEffect, useRef, useState } from "react";
import type { BackendConfig } from "../../settings/types.js";
import { Card } from "../ui/Card.js";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VadSectionProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  t: (key: string) => string;
}

export function VadSection({
  backendConfig,
  onToast,
  t,
}: VadSectionProps): JSX.Element {
  const [vadEnabled, setVadEnabled] = useState(true);
  const [vadThreshold, setVadThreshold] = useState(0.005);
  const [vadDuration, setVadDuration] = useState(2000);
  const loadedRef = useRef(false);

  // Load VAD config
  useEffect(() => {
    if (!backendConfig || loadedRef.current) return;
    const bc = backendConfig;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${bc!.url}/config`, {
          headers: { "x-token": bc!.token },
        });
        if (cancelled || !res.ok) return;
        const cfg = await res.json();
        // Defaults if backend doesn't return these
        setVadEnabled(cfg.vad_enabled !== undefined ? cfg.vad_enabled : true);
        if (typeof cfg.silence_threshold === "number") setVadThreshold(cfg.silence_threshold);
        if (typeof cfg.silence_duration_ms === "number") setVadDuration(cfg.silence_duration_ms);
        loadedRef.current = true;
      } catch (err) {
        console.error("Failed to load VAD config:", err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  const handleToggleVad = useCallback(
    async (enabled: boolean) => {
      setVadEnabled(enabled);
      if (!backendConfig) return;
      try {
        await fetch(`${backendConfig.url}/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-token": backendConfig.token,
          },
          body: JSON.stringify({ vad_enabled: enabled }),
        });
      } catch (err) {
        console.error("Failed to set VAD:", err);
      }
    },
    [backendConfig],
  );

  return (
    <Card padding="md">
      <h2 className="text-[16px] font-semibold text-[var(--foreground)] mb-4">
        {t("vad_title")}
      </h2>

      {/* VAD Enable Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <input
          id="vad-enabled-input"
          type="checkbox"
          checked={vadEnabled}
          onChange={(e) => handleToggleVad(e.target.checked)}
          className="rounded border-[var(--border)] text-[var(--brand-600)] focus:ring-[var(--brand-500)]"
        />
        <label
          htmlFor="vad-enabled-input"
          className="text-sm text-[var(--muted-foreground)] cursor-pointer select-none"
        >
          {t("vad_enable_label")}
        </label>
      </div>

      {/* VAD Threshold */}
      {vadEnabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
               {t("vad_threshold_label")}: {vadThreshold.toFixed(3)}
             </label>
            <input
              type="range"
              min="0.001"
              max="0.05"
              step="0.001"
              value={vadThreshold}
              onChange={async (e) => {
                const val = parseFloat(e.target.value);
                setVadThreshold(val);
                if (backendConfig) {
                  await fetch(`${backendConfig.url}/config`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-token": backendConfig.token,
                    },
                    body: JSON.stringify({ silence_threshold: val }),
                  }).catch(() => {});
                }
              }}
              className="w-full accent-[var(--brand-600)]"
            />
            <span className="text-xs text-[var(--muted-foreground)]">{t("vad_threshold_hint")}</span>
          </div>

          {/* VAD Duration */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
              {t("vad_duration_label")}: {vadDuration}ms
            </label>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={vadDuration}
              onChange={async (e) => {
                const val = parseInt(e.target.value, 10);
                setVadDuration(val);
                if (backendConfig) {
                  await fetch(`${backendConfig.url}/config`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-token": backendConfig.token,
                    },
                    body: JSON.stringify({ silence_duration_ms: val }),
                  }).catch(() => {});
                }
              }}
              className="w-full accent-[var(--brand-600)]"
            />
            <span className="text-xs text-[var(--muted-foreground)]">{t("vad_duration_hint")}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

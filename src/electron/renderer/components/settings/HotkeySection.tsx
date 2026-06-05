import { useCallback, useEffect, useRef, useState } from "react";
import type { BackendConfig } from "../../settings/types.js";
import type { VoiceAPI } from "../../overlay/types.js";
import { Card } from "../ui/Card.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVoiceAPI(): VoiceAPI {
  return window.voiceAPI!;
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function normalizeAcceleratorKey(
  event: React.KeyboardEvent<HTMLInputElement>,
): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  if (event.key === " ") return "Space";
  if (event.key === "Escape") return "Esc";
  if (event.key.startsWith("Arrow"))
    return event.key.replace("Arrow", "");
  if (event.key.length === 1) return event.key.toUpperCase();
  return event.key;
}

function formatAccelerator(
  event: React.KeyboardEvent<HTMLInputElement>,
): string | null {
  const key = normalizeAcceleratorKey(event);
  if (!key) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");
  parts.push(key);
  return parts.join("+");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HotkeySectionProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  onHotkeyChange: (hotkey: string) => void;
  t: (key: string) => string;
}

export function HotkeySection({
  backendConfig,
  onToast,
  onHotkeyChange,
  t,
}: HotkeySectionProps): JSX.Element {
  const [hotkey, setHotkey] = useState("Alt+=");
  const isCapturingHotkeyRef = useRef(false);

  // Load hotkey from backend config
  useEffect(() => {
    if (!backendConfig) return;
    const bc = backendConfig;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${bc.url}/config`, {
          headers: { "x-token": bc.token },
        });
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.hotkey) setHotkey(cfg.hotkey);
        }
      } catch (err) {
        console.error("Failed to load hotkey:", err);
      }
    }
    load();
  }, [backendConfig]);

  const handleSaveHotkey = useCallback(async () => {
    try {
      const registered = await getVoiceAPI().setHotkey(hotkey);
      if (registered) {
        setHotkey(registered);
        onHotkeyChange(registered);
        onToast(t("hotkey_changed"), 3000);
      } else {
        onToast(t("hotkey_failed"), 3000);
      }
    } catch (err) {
      console.error("Failed to set hotkey:", err);
      onToast(
        `Failed to set hotkey: ${err instanceof Error ? err.message : "unknown error"}`,
        3000,
      );
    }
  }, [hotkey, onToast, onHotkeyChange, t]);

  const handleHotkeyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      isCapturingHotkeyRef.current = true;
      const next = formatAccelerator(e);
      if (next) setHotkey(next);
    },
    [],
  );

  return (
    <Card padding="md">
      <h2 className="text-[16px] font-semibold text-dark-900 mb-4">
        {t("global_hotkey")}
      </h2>
      <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
        <Input
          id="hotkey-input"
          label={t("global_hotkey")}
          type="text"
          value={hotkey}
          readOnly
          onFocus={() => {
            isCapturingHotkeyRef.current = true;
          }}
          onBlur={() => {
            isCapturingHotkeyRef.current = false;
          }}
          onKeyDown={handleHotkeyKeyDown}
          placeholder="Alt+="
        />
        <div className="pt-6">
          <Button variant="secondary" size="sm" onClick={handleSaveHotkey}>
            {t("save_hotkey")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

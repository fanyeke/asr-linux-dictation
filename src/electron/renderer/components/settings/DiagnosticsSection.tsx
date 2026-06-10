import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { BackendConfig } from "../../settings/types.js";
import type { VoiceAPI } from "../../overlay/types.js";
import { Card } from "../ui/Card.js";
import { Button } from "../ui/Button.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVoiceAPI(): VoiceAPI {
  return window.voiceAPI!;
}

function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 4) + "••••" + token.slice(-4);
}

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) return body.detail;
    } catch (err) {
      console.error("Failed to read error detail:", err);
      // fall through
    }
  }
  return response.text().catch(() => "");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DiagnosticsSectionProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  t: (key: string) => string;
}

export function DiagnosticsSection({
  backendConfig,
  onToast,
  t,
}: DiagnosticsSectionProps): JSX.Element {
  const [registeredHotkey, setRegisteredHotkey] = useState<string | null>(null);

  // Load registered hotkey
  useEffect(() => {
    getVoiceAPI()
      .getHotkey()
      .then((k) => setRegisteredHotkey(k))
      .catch(() => setRegisteredHotkey(null));
  }, []);

  const handleOpenLogs = useCallback(() => {
    const home = typeof process !== "undefined" ? process.env.HOME || process.env.USERPROFILE : undefined;
    const logDir = `${home || "/tmp"}/.local/share/asr-linux/logs`;
    window.open(`file://${logDir}`, "_blank");
    onToast(`Log folder: ${logDir}`, 5000);
  }, [onToast]);

  const handleExportDiagnostics = useCallback(async () => {
    if (!backendConfig) return;
    try {
      const res = await fetch(`${backendConfig.url}/diagnostics/export`, {
        headers: {
          "x-token": backendConfig.token,
        },
      });
      if (!res.ok) {
        const body = await readErrorDetail(res);
        onToast(`${t("diagnostics_failed")}: ${res.status} ${body}`, 5000);
        return;
      }
      // Download the ZIP blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asr-diagnostics-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(t("diagnostics_exported"), 3000);
    } catch (err) {
      console.error("Failed to export diagnostics:", err);
      onToast(
        `${t("diagnostics_failed")}: ${err instanceof Error ? err.message : "network error"}`,
        5000,
      );
    }
  }, [backendConfig, onToast, t]);

  return (
    <Card padding="md">
      <h2 className="text-[16px] font-semibold text-[var(--foreground)] mb-4">
        {t("diagnostics")}
      </h2>
      {backendConfig ? (
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--muted-foreground)] min-w-[100px]">
              {t("backend_url")}:
            </span>
            <span className="text-sm font-mono text-[var(--muted-foreground)]">
              {backendConfig.url}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--muted-foreground)] min-w-[100px]">
              {t("token")}:
            </span>
            <span className="text-sm font-mono text-[var(--text-tertiary)]">
              {maskToken(backendConfig.token)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          No backend configuration available.
        </p>
      )}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-[var(--muted-foreground)] min-w-[100px]">
          {t("hotkey")}:
        </span>
        <span className="text-sm text-[var(--muted-foreground)]">
          {registeredHotkey ?? t("not_registered")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleOpenLogs}>
          {t("open_logs")}
        </Button>
        <Button variant="primary" size="sm" onClick={handleExportDiagnostics}>
          <Download size={14} />
          {t("export_diagnostics")}
        </Button>
      </div>
    </Card>
  );
}

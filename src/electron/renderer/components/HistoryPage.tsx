import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Clock, Download } from "lucide-react";
import type { BackendConfig, HistorySession } from "../settings/types.js";
import { Button } from "./ui/Button.js";
import { EmptyState } from "./ui/EmptyState.js";
import { SessionListItem } from "./SessionListItem.js";
import { useTranslation } from "../lib/i18n.js";

interface HistoryPageProps {
  history: HistorySession[];
  backendConfig: BackendConfig | null;
  onRefresh: () => Promise<void>;
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
};

export function HistoryPage({
  history,
  backendConfig,
  onRefresh,
}: HistoryPageProps): JSX.Element {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(
    async (format: "txt" | "md") => {
      setShowExportDialog(false);
      if (!backendConfig) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/history/export?format=${format}`,
          {
            headers: { "x-token": backendConfig.token },
          },
        );
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `asr-linux-history.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Export failed:", err);
      }
    },
    [backendConfig],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleRetry = useCallback(
    async (sessionId: string) => {
      if (!backendConfig) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/history/${sessionId}/retry`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-token": backendConfig.token,
            },
          },
        );
        if (res.ok) {
          await onRefresh();
        }
      } catch (err) {
        console.error("Failed to retry session:", err);
      }
    },
    [backendConfig, onRefresh],
  );

  return (
    <div className="max-w-3xl mx-auto p-8 pb-20 sm:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-[28px] font-semibold m-0"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t("history_title")}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            size="md"
            onClick={() => setShowExportDialog(true)}
            data-testid="export-history-btn"
            aria-label={t("export_history")}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="icon"
            size="md"
            onClick={handleRefresh}
            isLoading={refreshing}
            data-testid="refresh-history-btn"
            aria-label={t("refresh")}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Export format dialog */}
      {showExportDialog && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => {
            if (e.target === dialogRef.current) setShowExportDialog(false);
          }}
        >
          <div className="bg-[var(--card)] rounded-xl shadow-xl p-6 min-w-[300px]">
            <h3 className="text-lg font-semibold text-dark-900 mb-4">
              {t("export_title")}
            </h3>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleExport("txt")}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-colors text-sm font-medium"
              >
                {t("export_format_txt")}
              </button>
              <button
                type="button"
                onClick={() => handleExport("md")}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-colors text-sm font-medium"
              >
                {t("export_format_md")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowExportDialog(false)}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {history.length === 0 ? (
        <EmptyState
          icon={
            <Clock
              className="w-6 h-6 text-brand-500"
              data-testid="empty-state-history-icon"
            />
          }
          title={t("no_history")}
          description={t("no_history_desc")}
        />
      ) : (
        <motion.div
          className="flex flex-col gap-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {history.map((session) => (
            <motion.div key={session.id} variants={staggerItem}>
              <SessionListItem
                session={session}
                onRetry={handleRetry}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default HistoryPage;

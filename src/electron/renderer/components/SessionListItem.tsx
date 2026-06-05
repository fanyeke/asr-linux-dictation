import { useState } from "react";
import { useTranslation } from "../lib/i18n.js";
import { motion, AnimatePresence } from "framer-motion";
import type { HistorySession } from "../settings/types.js";
import { Card } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

interface SessionListItemProps {
  session: HistorySession;
  onRetry?: (sessionId: string) => void;
}

function statusToBadgeVariant(
  status: string,
): "success" | "error" | "recording" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    default:
      return "recording";
  }
}

export function SessionListItem({
  session,
  onRetry,
}: SessionListItemProps): JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isFailed = session.status === "failed";

  const timingMs = session.timing_ms ?? 0;
  const charCount = (session.raw_text ?? "").length;
  const formattedTime = session.created_at
    ? new Date(session.created_at).toLocaleString()
    : "";

  return (
    <Card padding="md" hoverable className="cursor-pointer">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between w-full text-left focus:outline-none"
        data-testid={`session-header-${session.id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant={statusToBadgeVariant(session.status)} size="sm">
            {session.status}
          </Badge>
          {formattedTime && (
            <span className="text-[13px] text-gray-500 whitespace-nowrap">
              {formattedTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {session.timing_ms !== null && (
            <span className="text-[13px] text-gray-500">
              {(timingMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-[13px] text-gray-400">{charCount} {t("chars")}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key={`detail-${session.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
            data-testid={`session-detail-${session.id}`}
          >
            <div className="pt-4 space-y-3">
              {/* ASR raw text */}
              {session.raw_text && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="info" size="sm">
                      ASR
                    </Badge>
                    <span className="text-[11px] text-gray-500">
                      {t("result_raw")}
                    </span>
                  </div>
                  <pre className="font-mono text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap break-words m-0">
                    {session.raw_text}
                  </pre>
                </div>
              )}

              {/* LLM polished text */}
              {session.polished_text &&
                session.polished_text !== session.raw_text && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="info" size="sm">
                        LLM
                      </Badge>
                    <span className="text-[11px] text-gray-500">
                      {t("result_polished")}
                    </span>
                    </div>
                    <div className="text-sm bg-white p-3 rounded border border-purple-100">
                      {session.polished_text}
                    </div>
                  </div>
                )}

              {/* Error info */}
              {isFailed && session.error_type && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {t("result_error")}: {session.error_type}
                </div>
              )}

              {/* Session ID + retry button */}
              <div className="flex items-center justify-between pt-1">
                <code className="text-[11px] text-gray-400 font-mono">
                  {session.session_id}
                </code>

                {isFailed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    disabled={!onRetry}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry?.(session.session_id);
                    }}
                    data-testid={`retry-btn-${session.id}`}
                  >
                    {t("retry")}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default SessionListItem;

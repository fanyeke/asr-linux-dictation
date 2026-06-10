import { useCallback, useState } from "react";
import { useTranslation } from "../lib/i18n.js";
import { motion, AnimatePresence } from "framer-motion";
import type { HistorySession } from "../settings/types.js";
import { Card } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { ChevronDown, ChevronUp, RotateCcw, FileAudio2, Copy, Check } from "lucide-react";
import { computeDiff, type DiffSegment } from "../lib/diff.js";

interface SessionListItemProps {
  session: HistorySession;
  onRetry?: (sessionId: string) => void;
  onToast?: (msg: string, durationMs?: number) => void;
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

function textPreview(text: string | null, maxLen: number = 30): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

export function SessionListItem({
  session,
  onRetry,
  onToast,
}: SessionListItemProps): JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isFailed = session.status === "failed";

  const timingMs = session.timing_ms ?? 0;
  const charCount = (session.raw_text ?? "").length;
  const formattedTime = session.created_at
    ? new Date(session.created_at).toLocaleString()
    : "";

  const previewText =
    session.polished_text ?? session.raw_text ?? "";

  // Compute diff segments for expanded view
  const diffSegments: DiffSegment[] =
    expanded &&
    session.polished_text &&
    session.raw_text &&
    session.polished_text !== session.raw_text
      ? computeDiff(session.raw_text, session.polished_text)
      : [];

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const text = session.polished_text ?? session.raw_text ?? "";
      if (!text) return;
      try {
        if (window.voiceAPI?.copyToClipboard) {
          await window.voiceAPI.copyToClipboard(text);
        } else {
          await navigator.clipboard.writeText(text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        onToast?.(t("copy_failed"), 3000);
        // ignore
      }
    },
    [session],
  );

  return (
    <Card
      padding="md"
      hoverable
      className={`cursor-pointer ${isFailed ? "bg-[var(--error-bg)]/50 border-[var(--error-border)]" : ""}`}
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-start justify-between w-full text-left focus:outline-none gap-2"
        data-testid={`session-header-${session.id}`}
      >
        <div className="flex flex-col min-w-0 gap-1">
          <div className="flex items-center gap-2">
            <Badge variant={statusToBadgeVariant(session.status)} size="sm">
              {session.status === "completed"
                ? t("status_completed")
                : session.status === "failed"
                  ? t("status_failed")
                  : session.status}
            </Badge>
            {formattedTime && (
              <span className="text-[12px] text-[var(--muted-foreground)] whitespace-nowrap">
                {formattedTime}
              </span>
            )}
          </div>
          {/* Text preview - always visible */}
          <span className="text-[13px] text-[var(--muted-foreground)] truncate max-w-[250px] sm:max-w-[400px]">
            {textPreview(previewText, 40)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Always-visible copy button */}
          {previewText && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--brand-600)] hover:bg-[var(--brand-50)] transition-colors"
              data-testid={`copy-btn-${session.id}`}
              title={t("copy")}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {session.timing_ms !== null && (
            <span className="text-[12px] text-[var(--muted-foreground)] tabular-nums">
              {(timingMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-[12px] text-[var(--text-tertiary)]">{charCount}c</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
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
              {/* Diff-style comparison */}
              {diffSegments.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="info" size="sm">ASR → LLM</Badge>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      <span className="text-red-500">●</span> removed&nbsp;
                      <span className="text-green-500">●</span> added&nbsp;
                      <span className="text-yellow-500">●</span> changed
                    </span>
                  </div>
                  <div className="text-sm bg-[var(--card)] p-3 rounded border border-[var(--border)] leading-relaxed whitespace-pre-wrap break-words">
                    {diffSegments.map((seg, i) => {
                      let cls = "";
                      if (seg.type === "added") cls = "text-[var(--green-700)] bg-[var(--success-bg)]";
                      else if (seg.type === "removed") cls = "text-[var(--red-700)] bg-[var(--error-bg)] line-through";
                      else if (seg.type === "changed") cls = "text-[var(--warning-text)] bg-[var(--warning-bg)]";
                      return (
                        <span key={i} className={cls}>
                          {seg.text}{" "}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {/* Fallback: side-by-side */}
                  {session.raw_text && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="info" size="sm">ASR</Badge>
                        <span className="text-[11px] text-[var(--muted-foreground)]">{t("result_raw")}</span>
                      </div>
                      <pre className="font-mono text-sm bg-[var(--muted)] p-3 rounded whitespace-pre-wrap break-words m-0">
                        {session.raw_text}
                      </pre>
                    </div>
                  )}
                  {session.polished_text && session.polished_text !== session.raw_text && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="info" size="sm">LLM</Badge>
                        <span className="text-[11px] text-[var(--muted-foreground)]">{t("result_polished")}</span>
                      </div>
                      <div className="text-sm bg-[var(--card)] p-3 rounded border-[var(--border)]">
                        {session.polished_text}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Error info */}
              {isFailed && session.error_type && (
                <div className="bg-[var(--error-bg)] border border-[var(--error-border)] rounded p-3 text-sm text-[var(--error-text)]">
                  {t("result_error")}: {session.error_type}
                </div>
              )}

              {/* Session ID + action buttons */}
              <div className="flex items-center justify-between pt-1">
                <code className="text-[11px] text-[var(--text-tertiary)] font-mono">
                  {session.session_id}
                </code>

                <div className="flex items-center gap-2">
                  {isFailed && session.failed_audio_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<FileAudio2 className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.voiceAPI?.revealFile(session.failed_audio_path!);
                      }}
                      data-testid={`reveal-audio-btn-${session.id}`}
                    >
                      {t("open_audio")}
                    </Button>
                  )}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default SessionListItem;

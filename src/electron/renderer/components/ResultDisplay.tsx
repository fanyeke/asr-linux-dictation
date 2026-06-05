import { motion } from "framer-motion";
import type { DictationResultData } from "../settings/types.js";
import { Card } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { useTranslation } from "../lib/i18n.js";

interface ResultDisplayProps {
  result: DictationResultData | null;
  error: { message: string; errorType?: string; rawText?: string } | null;
}

export function ResultDisplay({
  result,
  error,
}: ResultDisplayProps): JSX.Element | null {
  const { t } = useTranslation();
  if (!result && !error) return null;

  return (
    <motion.div
      data-testid="result-display"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Card padding="md" className="space-y-4">
        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 rounded-md p-3"
            data-testid="result-error"
          >
            <p className="text-red-700 font-semibold text-sm">
              {error.errorType
                ? `${t("result_error")}: ${error.errorType}`
                : t("result_error")}
            </p>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
            {error.rawText && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">{t("result_raw")}:</p>
                <pre className="text-sm font-mono bg-white p-3 rounded border border-red-200 overflow-x-auto whitespace-pre-wrap">
                  {error.rawText}
                </pre>
              </div>
            )}
          </motion.div>
        )}

        {/* Success state */}
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {/* ASR result */}
            <div>
              <div
                className="border-l-3 pl-3"
                style={{ borderLeftWidth: "3px", borderColor: "#6366f1" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="info">ASR</Badge>
                  <span className="text-xs text-gray-400">
                    {t("result_raw")}
                  </span>
                </div>
                <div
                  data-testid="result-raw-text"
                  className="font-mono text-sm bg-gray-50 p-3 rounded"
                >
                  {result.rawText || "(empty)"}
                </div>
              </div>
            </div>

            {/* LLM polished text (only if different from raw) */}
            {result.polishedText &&
              result.polishedText !== result.rawText && (
                <div>
                  <div
                    className="border-l-3 pl-3"
                    style={{
                      borderLeftWidth: "3px",
                      borderColor: "#8b5cf6",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="processing">LLM</Badge>
                      <span className="text-xs text-gray-400">
                        {t("result_polished")}
                      </span>
                    </div>
                    <div
                      data-testid="result-polished-text"
                      className="text-sm bg-white p-3 rounded border border-purple-100"
                    >
                      {result.polishedText}
                    </div>
                  </div>
                </div>
              )}

            {/* Timing */}
            {result.timingMs !== null && (
              <p
                data-testid="result-timing"
                className="text-xs text-gray-400 text-right"
              >
                Total: {result.timingMs}ms
              </p>
            )}
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}

export default ResultDisplay;

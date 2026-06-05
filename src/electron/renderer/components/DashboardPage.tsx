import { useMemo } from "react";
import { useTranslation } from "../lib/i18n.js";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle,
  Clock,
  Type,
  Sparkles,
} from "lucide-react";
import type { BackendConfig, HistorySession } from "../settings/types.js";
import { Card } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { EmptyState } from "./ui/EmptyState.js";

interface DashboardPageProps {
  backendConfig: BackendConfig | null;
  history: HistorySession[];
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

interface Stats {
  activeSessions: number;
  successRate: number;
  avgDuration: string;
  totalChars: number;
}

function computeStats(history: HistorySession[]): Stats {
  const total = history.length;
  if (total === 0) {
    return { activeSessions: 0, successRate: 0, avgDuration: "0s", totalChars: 0 };
  }

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const activeSessions = history.filter(
    (h) => h.status === "recording" || (h.created_at && (now - new Date(h.created_at).getTime()) < oneDayMs),
  ).length;

  const completed = history.filter((h) => h.status === "completed").length;
  const successRate = Math.round((completed / total) * 100);

  const timings = history
    .filter((h) => h.timing_ms != null)
    .map((h) => h.timing_ms as number);
  const avgTiming =
    timings.length > 0
      ? timings.reduce((a, b) => a + b, 0) / timings.length
      : 0;
  const avgDuration =
    avgTiming >= 1000
      ? `${(avgTiming / 1000).toFixed(1)}s`
      : `${Math.round(avgTiming)}ms`;

  const totalChars = history.reduce((acc, h) => {
    const text = h.raw_text ?? h.polished_text ?? "";
    return acc + text.length;
  }, 0);

  return { activeSessions, successRate, avgDuration, totalChars };
}

// ---------------------------------------------------------------------------
// StatCard sub-component
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  colorClass: string;
}

function StatCard({ icon, value, label, colorClass }: StatCardProps) {
  return (
    <Card padding="sm" className="flex flex-col items-center gap-2 py-4">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}
      >
        {icon}
      </div>
      <span className="font-display text-[32px] font-semibold leading-none text-dark-900">
        {value}
      </span>
      <span className="text-[13px] text-gray-500">{label}</span>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SessionListItem sub-component
// ---------------------------------------------------------------------------

interface SessionListItemProps {
  session: HistorySession;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed":
      return "error" as const;
    case "recording":
      return "recording" as const;
    default:
      return "neutral" as const;
  }
}

function SessionListItem({ session }: SessionListItemProps) {
  const { t } = useTranslation();
  const charCount = (session.raw_text ?? session.polished_text ?? "").length;
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-gray-500 font-mono">
          {formatTime(session.created_at)}
        </span>
        <span className="text-xs text-gray-400">
          {charCount > 0 ? `${charCount} ${t("chars")}` : "—"}
        </span>
      </div>
      <Badge variant={statusBadgeVariant(session.status)} size="sm" dot={session.status === "recording"}>
        {t(`status_${session.status}`)}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

export function DashboardPage({
  backendConfig: _backendConfig,
  history,
}: DashboardPageProps): JSX.Element {
  const { t } = useTranslation();
  const stats = useMemo(() => computeStats(history), [history]);
  const recentSessions = useMemo(() => history.slice(0, 5), [history]);

  return (
    <motion.div
      className="max-w-3xl mx-auto p-8 flex flex-col gap-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.h1
        className="font-display text-[28px] font-semibold text-dark-900 m-0"
        variants={itemVariants}
      >
        {t("dashboard_title")}
      </motion.h1>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-4 gap-4"
        variants={itemVariants}
      >
        <StatCard
          icon={<Activity size={20} className="text-brand-500" />}
          value={stats.activeSessions}
          label={t("stat_active_sessions")}
          colorClass="bg-brand-50"
        />
        <StatCard
          icon={<CheckCircle size={20} className="text-green-500" />}
          value={`${stats.successRate}%`}
          label={t("stat_success_rate")}
          colorClass="bg-green-50"
        />
        <StatCard
          icon={<Clock size={20} className="text-amber-500" />}
          value={stats.avgDuration}
          label={t("stat_avg_duration")}
          colorClass="bg-amber-50"
        />
        <StatCard
          icon={<Type size={20} className="text-purple-500" />}
          value={stats.totalChars.toLocaleString()}
          label={t("stat_total_chars")}
          colorClass="bg-purple-50"
        />
      </motion.div>

      {/* Recent Sessions */}
      <motion.div variants={itemVariants}>
        <Card padding="md">
          <h2 className="text-[16px] font-semibold text-dark-900 mb-3">
            {t("recent_sessions")}
          </h2>
          {recentSessions.length === 0 ? (
            <EmptyState
              icon={<Clock size={24} className="text-brand-500" />}
              title={t("no_sessions")}
              description={t("no_sessions_desc")}
              size="sm"
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {recentSessions.map((session) => (
                <SessionListItem key={session.id} session={session} />
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default DashboardPage;

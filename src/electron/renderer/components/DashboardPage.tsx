import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../lib/i18n.js";
import type { BackendConfig, HistorySession } from "../settings/types.js";
import { Card } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { BarChart } from "./ui/BarChart.js";
import { LineChart } from "./ui/LineChart.js";
import { EmptyState } from "./ui/EmptyState.js";
import { BarChart3, Clock, Zap, Type } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DashboardStats {
  daily_usage: Array<{ day: string; count: number; successes: number }>;
  hourly_distribution: Record<string, number>;
  avg_latency: { asr_ms: number | null; polish_ms: number | null; total_ms: number | null };
  latency_trend: Array<{ asr_ms: number; polish_ms: number; total_ms: number; created_at: string }>;
}

interface DashboardPageProps {
  backendConfig: BackendConfig | null;
  history: HistorySession[];
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}h`);

// ---------------------------------------------------------------------------
// StatCard
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
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
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
// Main component
// ---------------------------------------------------------------------------
export function DashboardPage({
  backendConfig,
  history,
}: DashboardPageProps): JSX.Element {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  // Load dashboard stats
  useEffect(() => {
    if (!backendConfig) {
      setLoading(false);
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;
    fetch(`${backendConfig.url}/dashboard/stats`, {
      headers: { "x-token": backendConfig.token },
    })
      .then((r) => r.json())
      .then((data) => {
        setStats(data as DashboardStats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [backendConfig]);

  // Compute stats from local history as fallback
  const total = history.length;
  const completed = history.filter((h) => h.status === "completed").length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const avgTiming =
    history.length > 0
      ? history.reduce((acc, h) => acc + (h.timing_ms ?? 0), 0) / history.length
      : 0;
  const totalChars = history.reduce((acc, h) => {
    const text = h.raw_text ?? h.polished_text ?? "";
    return acc + text.length;
  }, 0);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <p className="text-sm text-gray-500">{t("loading")}</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <EmptyState
          icon={<BarChart3 className="w-6 h-6 text-brand-500" />}
          title={t("no_sessions")}
          description={t("no_sessions_desc")}
        />
      </div>
    );
  }

  // Build chart data from stats
  const dailyData = stats?.daily_usage?.map((d) => {
    const date = new Date(d.day);
    const dayLabel = dayNames[date.getDay()] ?? d.day.slice(5);
    return { label: dayLabel, value: d.count };
  }) ?? [];

  const latencyData = stats?.latency_trend?.map((l) => ({
    label: l.created_at ? new Date(l.created_at).toLocaleDateString() : "",
    value: l.total_ms,
  })) ?? [];

  const asrLatencyData = stats?.latency_trend?.map((l) => ({
    label: "",
    value: l.asr_ms,
  })) ?? [];

  return (
    <div className="max-w-3xl mx-auto p-8 pb-20 sm:pb-8 space-y-6">
      <h1 className="font-display text-[28px] font-semibold text-dark-900 m-0">
        {t("dashboard_title")}
      </h1>

      {/* Row 1: Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Zap className="w-5 h-5 text-brand-600" />}
          value={total}
          label={t("stat_active_sessions")}
          colorClass="bg-brand-50"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 text-green-600" />}
          value={`${successRate}%`}
          label={t("stat_success_rate")}
          colorClass="bg-green-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          value={avgTiming >= 1000 ? `${(avgTiming / 1000).toFixed(1)}s` : `${Math.round(avgTiming)}ms`}
          label={t("stat_avg_duration")}
          colorClass="bg-amber-50"
        />
        <StatCard
          icon={<Type className="w-5 h-5 text-purple-600" />}
          value={totalChars}
          label={t("stat_total_chars")}
          colorClass="bg-purple-50"
        />
      </div>

      {/* Row 2: Usage trend + latency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-dark-900 mb-3">Daily Usage (7d)</h3>
          {dailyData.length > 0 ? (
            <BarChart data={dailyData} height={100} barColor="bg-brand-500" />
          ) : (
            <p className="text-xs text-gray-400">No data</p>
          )}
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-dark-900 mb-3">Latency Trend</h3>
          {latencyData.length > 1 ? (
            <LineChart data={latencyData} height={100} color="#6366f1" />
          ) : (
            <p className="text-xs text-gray-400">Insufficient data</p>
          )}
          {stats?.avg_latency && (
            <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
              {stats.avg_latency.asr_ms !== null && (
                <span>ASR: <strong>{stats.avg_latency.asr_ms}ms</strong></span>
              )}
              {stats.avg_latency.polish_ms !== null && (
                <span>LLM: <strong>{stats.avg_latency.polish_ms}ms</strong></span>
              )}
              {stats.avg_latency.total_ms !== null && (
                <span>Total: <strong>{stats.avg_latency.total_ms}ms</strong></span>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;

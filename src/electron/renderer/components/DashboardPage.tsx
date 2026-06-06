import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../lib/i18n.js";
import type { BackendConfig } from "../settings/types.js";
import { Card } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { BarChart } from "./ui/BarChart.js";
import { LineChart } from "./ui/LineChart.js";
import { EmptyState } from "./ui/EmptyState.js";
import { BarChart3, Clock, Zap, Type, Activity } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DashboardRange = "today" | "7d" | "30d";

interface DashboardSummary {
  total_sessions: number;
  success_count: number;
  fail_count: number;
  total_chars: number;
  avg_asr_ms: number | null;
  avg_polish_ms: number | null;
  avg_total_ms: number | null;
}

interface TimelineEntry {
  slot: string;
  count: number;
  successes: number;
}

interface LatencyPoint {
  asr_ms: number;
  polish_ms: number | null;
  total_ms: number | null;
  created_at: string;
}

interface DashboardStats {
  summary: DashboardSummary;
  timeline: TimelineEntry[];
  latency_trend: LatencyPoint[];
}

// ---------------------------------------------------------------------------
// Range tabs config
// ---------------------------------------------------------------------------

const RANGE_OPTIONS: { value: DashboardRange; labelKey: string }[] = [
  { value: "today", labelKey: "range_today" },
  { value: "7d", labelKey: "range_7d" },
  { value: "30d", labelKey: "range_30d" },
];

const RANGE_ICONS: Record<DashboardRange, string> = {
  today: "📅",
  "7d": "📊",
  "30d": "📈",
};

// ---------------------------------------------------------------------------
// Stat card with subtext support
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  colorClass: string;
  subtext?: string;
}

function StatCard({ icon, value, label, colorClass, subtext }: StatCardProps) {
  return (
    <Card padding="sm" className="flex flex-col items-center gap-2 py-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <span className="font-display text-[32px] font-semibold leading-none text-dark-900">
        {value}
      </span>
      <span className="text-[13px] text-gray-500">{label}</span>
      {subtext && (
        <span className="text-[11px] text-gray-400">{subtext}</span>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card placeholder
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card padding="sm" className="flex flex-col items-center gap-2 py-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200" />
      <div className="h-8 w-16 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-200 rounded" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DashboardPageProps {
  backendConfig: BackendConfig | null;
}

export function DashboardPage({
  backendConfig,
}: DashboardPageProps): JSX.Element {
  const { t } = useTranslation();
  const [range, setRange] = useState<DashboardRange>("today");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const fetchIdRef = useRef(0);

  // Fetch stats whenever range or backendConfig changes
  const fetchStats = useCallback(async (r: DashboardRange) => {
    if (!backendConfig) {
      setLoading(false);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setLoading(true);

    // Safety timeout: show dashboard even if API hangs (2s)
    const safetyTimer = setTimeout(() => {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }, 2000);

    try {
      const res = await fetch(
        `${backendConfig.url}/dashboard/stats?range=${r}`,
        { headers: { "x-token": backendConfig.token } },
      );
      if (fetchId !== fetchIdRef.current) return;

      if (res.ok) {
        const data = (await res.json()) as DashboardStats;
        setStats(data);
        setHasFetched(true);
      }
    } catch {
      // network error — keep showing previous data or empty
    } finally {
      if (fetchId === fetchIdRef.current) {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    }
  }, [backendConfig]);

  // Fetch on mount and when range changes
  useEffect(() => {
    fetchStats(range);
  }, [range, fetchStats]);

  const handleRangeChange = useCallback((r: DashboardRange) => {
    setRange(r);
  }, []);

  // --- Derived data ---

  const summary = stats?.summary;
  const hasData = summary != null && summary.total_sessions > 0;

  // Build success rate with color
  const successRate = summary && summary.total_sessions > 0
    ? Math.round((summary.success_count / summary.total_sessions) * 100)
    : null;

  const successRateColor =
    successRate === null
      ? "text-gray-400"
      : successRate >= 90
        ? "text-green-600"
        : successRate >= 70
          ? "text-amber-500"
          : "text-red-500";

  // Build avg duration breakdown
  const avgTotal = summary?.avg_total_ms;
  const avgDurationDisplay = avgTotal != null
    ? avgTotal >= 1000
      ? `${(avgTotal / 1000).toFixed(1)}s`
      : `${Math.round(avgTotal)}ms`
    : "--";

  // Subtext: show ASR · LLM breakdown when available; fall back to
  // a generic hint when only total timing is known.
  const latencySubtext =
    summary?.avg_asr_ms != null || summary?.avg_polish_ms != null
      ? `ASR ${summary.avg_asr_ms ?? "--"}ms · LLM ${summary.avg_polish_ms ?? "--"}ms`
      : avgTotal != null
        ? "暂无 ASR/LLM 分阶段数据"   // old sessions before Phase 11
        : undefined;

  // Convert timeline → bar chart data.
  // For "today" mode, trim to only the hours that have already elapsed
  // (current hour + earlier), so empty future hours don't waste space.
  const barData = useMemo(() => {
    const raw = stats?.timeline ?? [];
    if (range !== "today" || raw.length === 0) {
      return raw.map((e) => ({ label: e.slot, value: e.count }));
    }
    const currentHour = new Date().getHours();
    // Backend returns 24 hourly slots "00".."23"
    const maxSlot = currentHour;
    const trimmed = raw.filter((e) => {
      const h = parseInt(e.slot, 10);
      return !isNaN(h) && h <= maxSlot;
    });
    return trimmed.map((e) => ({ label: e.slot, value: e.count }));
  }, [stats?.timeline, range]);

  // Convert latency trend → line chart series
  const trend = stats?.latency_trend ?? [];
  const asrData = trend.map((l) => l.asr_ms);
  const llmData = trend.map((l) => l.polish_ms ?? 0);

  // Range-aware empty message
  const emptyMessages: Record<DashboardRange, { title: string; desc: string }> = {
    today: { title: t("empty_today_title"), desc: t("empty_today_desc") },
    "7d": { title: t("empty_7d_title"), desc: t("empty_7d_desc") },
    "30d": { title: t("empty_30d_title"), desc: t("empty_30d_desc") },
  };

  return (
    <div className="max-w-3xl mx-auto p-8 pb-20 sm:pb-8 space-y-6">
      {/* Title */}
      <h1 className="font-display text-[28px] font-semibold text-dark-900 m-0">
        {t("dashboard_title")}
      </h1>

      {/* ── Range selector tabs ── */}
      <div className="flex gap-2" role="tablist">
        {RANGE_OPTIONS.map((opt) => {
          const active = range === opt.value;
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={active}
              onClick={() => handleRangeChange(opt.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{RANGE_ICONS[opt.value]}</span>
              <span>{t(opt.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && !hasFetched && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !hasData && hasFetched && (
        <EmptyState
          icon={<BarChart3 className="w-6 h-6 text-brand-500" />}
          title={emptyMessages[range].title}
          description={emptyMessages[range].desc}
        />
      )}

      {/* ── Stats cards (animated) ── */}
      <AnimatePresence mode="wait">
        {hasData && (
          <motion.div
            key={range}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Row 1: Overview stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Zap className="w-5 h-5 text-brand-600" />}
                value={summary!.total_sessions}
                label={t("stat_total_sessions")}
                colorClass="bg-brand-50"
                subtext={`${summary!.success_count} ✅ · ${summary!.fail_count} ❌`}
              />
              <StatCard
                icon={<Activity className={`w-5 h-5 ${successRateColor}`} />}
                value={successRate != null ? `${successRate}%` : "--"}
                label={t("stat_success_rate")}
                colorClass="bg-green-50"
              />
              <StatCard
                icon={<Clock className="w-5 h-5 text-amber-600" />}
                value={avgDurationDisplay}
                label={t("stat_avg_duration")}
                colorClass="bg-amber-50"
                subtext={latencySubtext}
              />
              <StatCard
                icon={<Type className="w-5 h-5 text-purple-600" />}
                value={summary!.total_chars}
                label={t("stat_total_chars")}
                colorClass="bg-purple-50"
              />
            </div>

            {/* Row 2: Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card padding="md">
                <h3 className="text-sm font-semibold text-dark-900 mb-3">
                  {range === "today" ? t("chart_today_usage") : t("chart_trend")}
                </h3>
                {barData.length > 0 && barData.some((d) => d.value > 0) ? (
                  <BarChart data={barData} height={100} barColor="bg-brand-500" yLabel={t("chart_y_label")} />
                ) : (
                  <p className="text-xs text-gray-400">{t("chart_no_data")}</p>
                )}
              </Card>

              <Card padding="md">
                <h3 className="text-sm font-semibold text-dark-900 mb-3">
                  {t("chart_latency")}
                </h3>
                {asrData.length > 1 ? (
                  <LineChart
                    series={[
                      { label: "ASR", data: asrData, color: "#6366f1" },
                      { label: "LLM", data: llmData, color: "#a855f7" },
                    ]}
                    height={100}
                    xLabels={trend.map((_, i) => `#${i + 1}`)}
                  />
                ) : (
                  <p className="text-xs text-gray-400">{t("chart_insufficient_data")}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-2">
                  {t("stats_since_hint")}
                </p>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DashboardPage;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../lib/i18n.js";
import type { BackendConfig } from "../settings/types.js";
import { Card } from "./ui/Card.js";
import { BarChart } from "./ui/BarChart.js";
import { LineChart } from "./ui/LineChart.js";
import { EmptyState } from "./ui/EmptyState.js";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  TrendingUp,
  Type,
  XCircle,
  Zap,
} from "lucide-react";

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

const RANGE_CONFIG: Record<
  DashboardRange,
  { icon: React.ReactNode; labelKey: string }
> = {
  today: { icon: <CalendarDays className="w-4 h-4" />, labelKey: "range_today" },
  "7d": { icon: <BarChart3 className="w-4 h-4" />, labelKey: "range_7d" },
  "30d": { icon: <TrendingUp className="w-4 h-4" />, labelKey: "range_30d" },
};

// ---------------------------------------------------------------------------
// Stat card with subtext support
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  colorClass: string;
  accentClass: string;
  subtext?: React.ReactNode;
  delay?: number;
}

function StatCard({
  icon,
  value,
  label,
  colorClass,
  accentClass,
  subtext,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <Card
        padding="md"
        className="relative overflow-hidden group h-full"
      >
        {/* Top accent line */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${accentClass}`} />

        <div className="flex items-start gap-3 pt-1">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-display text-[26px] font-bold leading-none text-[var(--foreground)] tracking-tight block">
              {value}
            </span>
            <span className="text-[12px] text-[var(--muted-foreground)] mt-1.5 block leading-tight">
              {label}
            </span>
            {subtext && (
              <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60">
                {subtext}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card placeholder
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card
      padding="md"
      className="relative overflow-hidden h-full"
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--muted)]" />
      <div className="flex items-start gap-3 pt-1 animate-pulse">
        <div className="w-11 h-11 rounded-xl bg-[var(--muted)] flex-shrink-0" />
        <div className="flex-1">
          <div className="h-7 w-16 bg-[var(--muted)] rounded mt-1" />
          <div className="h-4 w-20 bg-[var(--muted)] rounded mt-2" />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Chart card header
// ---------------------------------------------------------------------------

function ChartCardHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-[var(--brand-50)] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DashboardPageProps {
  backendConfig: BackendConfig | null;
  onToast?: (msg: string, durationMs?: number) => void;
}

export function DashboardPage({
  backendConfig,
  onToast,
}: DashboardPageProps): JSX.Element {
  const { t } = useTranslation();
  const [range, setRange] = useState<DashboardRange>("today");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const fetchIdRef = useRef(0);

  // Fetch stats whenever range or backendConfig changes
  const fetchStats = useCallback(
    async (r: DashboardRange) => {
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
        onToast?.(t("load_failed"), 3000);
        // network error — keep showing previous data or empty
      } finally {
        if (fetchId === fetchIdRef.current) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    },
    [backendConfig],
  );

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
  const successRate =
    summary && summary.total_sessions > 0
      ? Math.round((summary.success_count / summary.total_sessions) * 100)
      : null;

  const successRateIconColor =
    successRate === null
      ? "text-[var(--muted-foreground)]"
      : successRate >= 90
        ? "text-[var(--green-600)]"
        : successRate >= 70
          ? "text-[var(--amber-600)]"
          : "text-[var(--red-500)]";

  const successRateAccent =
    successRate === null
      ? "bg-[var(--muted)]"
      : successRate >= 90
        ? "bg-[var(--green-600)]"
        : successRate >= 70
          ? "bg-[var(--amber-500)]"
          : "bg-[var(--red-500)]";

  // Build avg duration breakdown
  const avgTotal = summary?.avg_total_ms;
  const avgDurationDisplay =
    avgTotal != null
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
        ? "暂无 ASR/LLM 分阶段数据" // old sessions before Phase 11
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
  const emptyMessages: Record<DashboardRange, { title: string; desc: string }> =
    {
      today: { title: t("empty_today_title"), desc: t("empty_today_desc") },
      "7d": { title: t("empty_7d_title"), desc: t("empty_7d_desc") },
      "30d": { title: t("empty_30d_title"), desc: t("empty_30d_desc") },
    };

  return (
    <div className="max-w-6xl mx-auto p-8 pb-20 sm:pb-8 space-y-6">
      {/* ── Range selector tabs ── */}
      <div className="flex gap-2" role="tablist">
        {(Object.keys(RANGE_CONFIG) as DashboardRange[]).map((key) => {
          const opt = RANGE_CONFIG[key];
          const active = range === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => handleRangeChange(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-[var(--brand-50)] text-[var(--brand-700)] ring-1 ring-[var(--brand-200)] shadow-sm"
                  : "bg-[var(--muted)]/60 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              {opt.icon}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Row 1: Overview stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={
                  <Zap className="w-5 h-5 text-[var(--brand-600)]" />
                }
                value={summary!.total_sessions}
                label={t("stat_total_sessions")}
                colorClass="bg-[var(--brand-50)]"
                accentClass="bg-[var(--brand-500)]"
                delay={0}
                subtext={
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--green-600)]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {summary!.success_count}
                    </span>
                    <span className="w-px h-3 bg-[var(--border)]" />
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--red-500)]">
                      <XCircle className="w-3.5 h-3.5" />
                      {summary!.fail_count}
                    </span>
                  </div>
                }
              />
              <StatCard
                icon={
                  <TrendingUp className={`w-5 h-5 ${successRateIconColor}`} />
                }
                value={successRate != null ? `${successRate}%` : "--"}
                label={t("stat_success_rate")}
                colorClass="bg-[var(--success-bg)]"
                accentClass={successRateAccent}
                delay={0.08}
              />
              <StatCard
                icon={
                  <Clock className="w-5 h-5 text-[var(--amber-600)]" />
                }
                value={avgDurationDisplay}
                label={t("stat_avg_duration")}
                colorClass="bg-[var(--warning-bg)]"
                accentClass="bg-[var(--amber-500)]"
                delay={0.16}
                subtext={
                  latencySubtext ? (
                    <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
                      {latencySubtext}
                    </span>
                  ) : undefined
                }
              />
              <StatCard
                icon={
                  <Type className="w-5 h-5 text-[var(--purple-600)]" />
                }
                value={summary!.total_chars}
                label={t("stat_total_chars")}
                colorClass="bg-[var(--info-bg)]"
                accentClass="bg-[var(--purple-600)]"
                delay={0.24}
              />
            </div>

            {/* Row 2: Charts */}
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card padding="md">
                <ChartCardHeader
                  icon={
                    <BarChart3 className="w-4 h-4 text-[var(--brand-500)]" />
                  }
                  title={
                    range === "today"
                      ? t("chart_today_usage")
                      : t("chart_trend")
                  }
                  subtitle={
                    range === "today"
                      ? "每小时调用次数分布"
                      : "最近调用趋势统计"
                  }
                />
                {barData.length > 0 &&
                barData.some((d) => d.value > 0) ? (
                  <BarChart
                    data={barData}
                    height={200}
                    yLabel={t("chart_y_label")}
                  />
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t("chart_no_data")}
                  </p>
                )}
              </Card>

              <Card padding="md">
                <ChartCardHeader
                  icon={
                    <TrendingUp className="w-4 h-4 text-[var(--brand-500)]" />
                  }
                  title={t("chart_latency")}
                  subtitle="ASR 与 LLM 处理耗时趋势"
                />
                {asrData.length > 1 ? (
                  <LineChart
                    series={[
                      { label: "ASR", data: asrData, color: "#6366f1" },
                      { label: "LLM", data: llmData, color: "#a855f7" },
                    ]}
                    height={200}
                    xLabels={trend.map((_, i) => `#${i + 1}`)}
                  />
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t("chart_insufficient_data")}
                  </p>
                )}
                <p className="text-[10px] text-[var(--text-tertiary)] mt-3">
                  {t("stats_since_hint")}
                </p>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DashboardPage;

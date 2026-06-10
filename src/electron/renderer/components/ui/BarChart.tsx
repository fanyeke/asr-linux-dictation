/** Lightweight bar chart with Y-axis label — no external dependencies.
 *
 * Dynamically sizes bars to fit the container; all labels always visible.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  barColor?: string;
  yLabel?: string; // Y-axis label (e.g. "调用次数" / "calls")
}

export function BarChart({
  data,
  height = 180,
  barColor,
  yLabel,
}: BarChartProps): JSX.Element {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Y-axis: compute a nice round max
  const yMax = useMemo(() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
    const normalized = maxValue / magnitude;
    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
  }, [maxValue]);

  const yLabels = [yMax, Math.round(yMax / 2), 0];

  const AXIS_WIDTH = 40;

  // Gap between bars based on data density
  const gap = data.length > 30 ? 1 : data.length > 16 ? 2 : data.length > 8 ? 3 : 4;

  if (data.length === 0) {
    return <div className="text-xs text-[var(--text-tertiary)]">No data</div>;
  }

  return (
    <div className="relative flex" style={{ height }}>
      {/* ── Y-axis ── */}
      <div
        className="relative flex flex-col justify-between items-end pr-2.5 text-[10px] text-[var(--muted-foreground)] select-none font-mono"
        style={{ width: AXIS_WIDTH, paddingBottom: 22 }}
      >
        {yLabels.map((v) => (
          <span key={v}>{v}</span>
        ))}
        {yLabel && (
          <span
            className="text-[9px] text-[var(--text-tertiary)] absolute bottom-0 left-0 text-center"
            style={{ width: AXIS_WIDTH }}
          >
            {yLabel}
          </span>
        )}
      </div>

      {/* ── Chart area ── */}
      <div
        className="relative flex-1 flex items-end"
        style={{ gap }}
      >
        {data.map((d, i) => {
          const barHeight = (d.value / yMax) * 100;
          const isHovered = hoveredIndex === i;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end min-w-[3px] relative"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg z-10 whitespace-nowrap pointer-events-none">
                  <div className="font-semibold">{d.label}</div>
                  <div className="text-[var(--muted-foreground)]">
                    {d.value}
                    {yLabel ? ` ${yLabel}` : ""}
                  </div>
                </div>
              )}

              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${barHeight}%`, opacity: 1 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.015,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className={`w-full rounded-t-md cursor-pointer min-h-[2px] relative overflow-hidden ${
                  barColor || ""
                }`}
                style={
                  !barColor
                    ? {
                        background:
                          "linear-gradient(180deg, var(--brand-500) 0%, var(--brand-600) 100%)",
                      }
                    : undefined
                }
              >
                {/* Subtle shine on hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 transition-opacity duration-300 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                />
              </motion.div>

              <span
                className="text-[var(--muted-foreground)] mt-1.5 text-center overflow-hidden font-mono"
                style={{
                  fontSize: data.length > 24 ? 6 : data.length > 16 ? 7 : data.length > 8 ? 9 : 10,
                  lineHeight: 1.2,
                }}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

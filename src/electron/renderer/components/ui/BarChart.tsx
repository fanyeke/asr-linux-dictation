/** Lightweight bar chart with Y-axis label — no external dependencies.
 *
 * Dynamically sizes bars to fit the container; all labels always visible.
 */

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  barColor?: string;
  yLabel?: string;          // Y-axis label (e.g. "调用次数" / "calls")
}

export function BarChart({
  data,
  height = 120,
  barColor = "bg-brand-500",
  yLabel,
}: BarChartProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Label column width accounts for axis text
  const AXIS_WIDTH = 36;

  const { gap, barWidth, labelFontSize } = useMemo(() => {
    const count = data.length;
    if (count <= 1) return { gap: 4, barWidth: 30, labelFontSize: 10 };

    const chartWidth = 280 - AXIS_WIDTH;
    const gap = count > 20 ? 1 : count > 12 ? 2 : 4;
    const totalGaps = gap * (count - 1);
    const barWidth = Math.min(
      Math.max(Math.floor((chartWidth - totalGaps) / count), 4),
      30,
    );
    const labelFontSize = count > 20 ? 7 : count > 12 ? 8 : 10;
    return { gap, barWidth, labelFontSize };
  }, [data.length]);

  if (data.length === 0) {
    return <div className="text-xs text-gray-400">No data</div>;
  }

  return (
    <div className="relative flex" style={{ height }} ref={containerRef}>
      {/* ── Y-axis label ── */}
      <div className="flex flex-col justify-between items-end pr-2 text-[10px] text-gray-400 select-none"
        style={{ width: AXIS_WIDTH, paddingBottom: 16 }}>
        <span>{maxValue}</span>
        <span>{Math.round(maxValue / 2)}</span>
        <span>0</span>
        {yLabel && (
          <span className="text-[9px] text-gray-400 mt-1">{yLabel}</span>
        )}
      </div>

      {/* ── Chart area ── */}
      <div className="relative flex-1">
        {/* Tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute bg-dark-900 text-white text-[11px] px-2 py-1 rounded shadow-md z-10 whitespace-nowrap pointer-events-none"
            style={{
              bottom: "100%",
              left: `${(hoveredIndex / data.length) * 100 + 50 / data.length}%`,
              transform: "translateX(-50%)",
              marginBottom: "4px",
            }}
          >
            {data[hoveredIndex].label}: {data[hoveredIndex].value}
          </div>
        )}

        <div
          className="flex items-end h-full"
          style={{ gap, overflowX: "hidden" }}
        >
          {data.map((d, i) => (
            <div
              key={i}
              className="flex flex-col items-center h-full flex-shrink-0"
              style={{
                width: barWidth,
                justifyContent: "flex-end",
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.value / maxValue) * 100}%` }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.02,
                  ease: "easeOut",
                }}
                className={`w-full rounded-t ${barColor} min-h-[2px] cursor-pointer hover:opacity-80`}
              />
              <span
                className="text-gray-500 mt-0.5 text-center overflow-hidden"
                style={{
                  width: barWidth + 8,
                  fontSize: labelFontSize,
                  lineHeight: 1.1,
                }}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Lightweight multi-series SVG line chart with Y-axis ms scale and hover tooltip. */

import { useState } from "react";
import { motion } from "framer-motion";

interface Series {
  label: string;
  data: number[];
  color: string;
}

interface LineChartProps {
  series: Series[];
  height?: number;
  xLabels?: string[];
}

const AXIS_WIDTH = 42;

export function LineChart({
  series,
  height = 100,
  xLabels,
}: LineChartProps): JSX.Element {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (series.length === 0 || series[0].data.length < 2) {
    return <div className="text-xs text-gray-400">Insufficient data</div>;
  }

  const dataLen = series[0].data.length;
  const allValues = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allValues, 1);

  // Round max up to a nice number for axis labels
  const axisMax = Math.ceil(maxVal / 500) * 500 || 500;

  const pad = { top: 4, right: 4, bottom: 16, left: 0 };
  const chartW = 280 - AXIS_WIDTH - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const axisLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(axisMax * f));

  return (
    <div className="flex" style={{ height }}>
      {/* ── Y-axis ── */}
      <div
        className="flex flex-col justify-between items-end pr-1 text-[10px] text-gray-400 select-none"
        style={{ width: AXIS_WIDTH, paddingTop: pad.top, paddingBottom: pad.bottom }}
      >
        {axisLabels.map((v) => (
          <span key={v}>{v}ms</span>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="relative flex-1">
        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute bg-dark-900 text-white text-[11px] px-2 py-1.5 rounded shadow-md z-10 whitespace-nowrap pointer-events-none"
            style={{
              bottom: "100%",
              left: `${(pad.left + (hoveredIndex / (dataLen - 1)) * chartW) / (chartW + pad.left + pad.right) * 100}%`,
              transform: "translateX(-50%)",
              marginBottom: 4,
            }}
          >
            <div className="font-medium mb-0.5">
              {xLabels?.[hoveredIndex] ?? `#${hoveredIndex + 1}`}
            </div>
            {series.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span>{s.label}: <strong>{s.data[hoveredIndex]}ms</strong></span>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-3 mb-1 text-[10px] text-gray-500">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>

        <svg
          width={chartW + pad.left + pad.right}
          height={height}
          className="overflow-visible"
        >
          {/* Grid lines + labels */}
          {axisLabels.map((v, vi) => {
            const y = pad.top + chartH - (v / axisMax) * chartH;
            return (
              <line
                key={v}
                x1={pad.left}
                y1={y}
                x2={chartW + pad.left}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            );
          })}

          {/* Series lines */}
          {series.map((s) => {
            const pts = s.data.map((v, i) => ({
              x: pad.left + (i / (dataLen - 1)) * chartW,
              y: pad.top + chartH - (v / axisMax) * chartH,
            }));
            const d = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");

            return (
              <g key={s.label}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                />
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={hoveredIndex === i ? 5 : 2}
                    fill={s.color}
                    className="cursor-pointer"
                    style={{ transition: "r 0.15s" }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                ))}
              </g>
            );
          })}

          {/* X axis hover guide line */}
          {hoveredIndex !== null && (
            <line
              x1={pad.left + (hoveredIndex / (dataLen - 1)) * chartW}
              y1={pad.top}
              x2={pad.left + (hoveredIndex / (dataLen - 1)) * chartW}
              y2={pad.top + chartH}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

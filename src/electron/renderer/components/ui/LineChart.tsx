/** Lightweight multi-series SVG line chart — no external dependencies. */

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
  xLabels?: string[];  // optional labels for X axis
}

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
  const width = 280;
  const pad = 4;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  return (
    <div className="relative">
      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="absolute bg-dark-900 text-white text-[11px] px-2 py-1 rounded shadow-md z-10 whitespace-nowrap pointer-events-none"
          style={{
            bottom: "100%",
            left: `${(pad + (hoveredIndex / (dataLen - 1)) * chartW) / width * 100}%`,
            transform: "translateX(-50%)",
            marginBottom: 4,
          }}
        >
          {xLabels?.[hoveredIndex] ?? `#${hoveredIndex + 1}`}
          {series.map((s) => (
            <div key={s.label}>
              {s.label}: {s.data[hoveredIndex]}ms
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

      <svg width={width} height={height} className="overflow-visible">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={pad}
            y1={pad + chartH - frac * chartH}
            x2={width - pad}
            y2={pad + chartH - frac * chartH}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        ))}

        {/* Series lines */}
        {series.map((s) => {
          const pts = s.data.map((v, i) => ({
            x: pad + (i / (dataLen - 1)) * chartW,
            y: pad + chartH - (v / maxVal) * chartH,
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
            x1={pad + (hoveredIndex / (dataLen - 1)) * chartW}
            y1={pad}
            x2={pad + (hoveredIndex / (dataLen - 1)) * chartW}
            y2={pad + chartH}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>
    </div>
  );
}

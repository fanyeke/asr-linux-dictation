/** Lightweight SVG line chart — no external dependencies. */

import { useState } from "react";
import { motion } from "framer-motion";

interface LineChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
}

export function LineChart({
  data,
  height = 100,
  color = "#6366f1",
}: LineChartProps): JSX.Element {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length < 2) return <div className="text-xs text-gray-500">Insufficient data</div>;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const width = 280;
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartW;
    const y = padding + chartH - (d.value / maxVal) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");

  return (
    <div className="relative">
      {/* Tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="absolute bg-dark-900 text-white text-[11px] px-2 py-1 rounded shadow-md z-10 whitespace-nowrap pointer-events-none"
          style={{
            bottom: `${100 - (points[hoveredIndex].y / height) * 100 + 5}%`,
            left: `${(points[hoveredIndex].x / width) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          {points[hoveredIndex].value}ms
          {points[hoveredIndex].label && ` (${points[hoveredIndex].label})`}
        </div>
      )}
      <svg width={width} height={height} className="overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={padding}
            y1={padding + chartH - frac * chartH}
            x2={width - padding}
            y2={padding + chartH - frac * chartH}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        ))}
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 5 : 3}
            fill={color}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
    </div>
  );
}

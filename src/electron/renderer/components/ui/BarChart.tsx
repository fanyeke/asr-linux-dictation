/** Lightweight SVG bar chart — no external dependencies. */

import { useState } from "react";
import { motion } from "framer-motion";

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  barColor?: string;
}

export function BarChart({
  data,
  height = 120,
  barColor = "bg-brand-500",
}: BarChartProps): JSX.Element {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative" style={{ height }}>
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
      <div className="flex items-end gap-2 h-full">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-col items-center flex-1 h-full"
            style={{ justifyContent: "flex-end" }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(d.value / maxValue) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
              className={`w-full rounded-t ${barColor} min-h-[2px] cursor-pointer hover:opacity-80`}
              style={{ maxWidth: 30 }}
            />
            <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

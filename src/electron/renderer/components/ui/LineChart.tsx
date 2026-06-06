/** Lightweight SVG line chart — no external dependencies. */

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
  if (data.length < 2) return <div className="text-xs text-gray-500">Insufficient data</div>;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const width = 280;
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartW;
    const y = padding + chartH - (d.value / maxVal) * chartH;
    return `${x},${y}`;
  });

  const pathD = points.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
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
      {/* Line */}
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
      {/* Dots */}
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * chartW;
        const y = padding + chartH - (d.value / maxVal) * chartH;
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
    </svg>
  );
}

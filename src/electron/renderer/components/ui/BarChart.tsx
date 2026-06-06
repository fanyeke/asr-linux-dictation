/** Lightweight SVG bar chart — no external dependencies. */

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
  const barWidth = Math.max(20, Math.min(40, 400 / data.length));

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex flex-col items-center flex-1"
          style={{ height: "100%", justifyContent: "flex-end" }}
        >
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / maxValue) * 100}%` }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
            className={`w-full rounded-t ${barColor} min-h-[2px]`}
            style={{ maxWidth: barWidth }}
          />
          <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

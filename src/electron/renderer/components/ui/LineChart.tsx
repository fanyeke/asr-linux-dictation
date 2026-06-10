/** Lightweight multi-series SVG line chart with Y-axis ms scale, hover tooltip,
 *  area fill, and responsive width via ResizeObserver. */

import { useState, useEffect, useRef, useMemo } from "react";
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

const AXIS_WIDTH = 46;

export function LineChart({
  series,
  height = 180,
  xLabels,
}: LineChartProps): JSX.Element {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => setContainerWidth(el.clientWidth);
    update();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }

    // Fallback for environments without ResizeObserver (e.g. jsdom)
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (series.length === 0 || series[0].data.length < 2) {
    return (
      <div className="text-xs text-[var(--text-tertiary)]">
        Insufficient data
      </div>
    );
  }

  const dataLen = series[0].data.length;
  const allValues = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allValues, 1);

  // Round max up to a nice number for axis labels
  const axisMax = useMemo(() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const normalized = maxVal / magnitude;
    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
  }, [maxVal]);

  // Only 3 labels: max, half, 0
  const axisLabels = [axisMax, Math.round(axisMax / 2), 0];

  const pad = { top: 8, right: 8, bottom: 20, left: 0 };
  const chartW = Math.max(containerWidth - pad.right, 100);
  const chartH = height - pad.top - pad.bottom;

  return (
    <div className="flex" style={{ height }}>
      {/* ── Y-axis ── */}
      <div
        className="flex flex-col justify-between items-end pr-2 text-[10px] text-[var(--muted-foreground)] select-none font-mono"
        style={{
          width: AXIS_WIDTH,
          paddingTop: pad.top,
          paddingBottom: pad.bottom,
        }}
      >
        {axisLabels.map((v) => (
          <span key={v}>{v}ms</span>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="relative flex-1" ref={containerRef}>
        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-[11px] px-3 py-2 rounded-lg shadow-lg z-10 whitespace-nowrap pointer-events-none"
            style={{
              bottom: "100%",
              left: `${(pad.left + (hoveredIndex / (dataLen - 1)) * chartW) / (chartW + pad.left + pad.right) * 100}%`,
              transform: "translateX(-50%)",
              marginBottom: 6,
            }}
          >
            <div className="font-semibold mb-1 text-[var(--foreground)]">
              {xLabels?.[hoveredIndex] ?? `#${hoveredIndex + 1}`}
            </div>
            {series.map((s) => (
              <div key={s.label} className="flex items-center gap-2 py-0.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-[var(--muted-foreground)]">
                  {s.label}:
                </span>
                <span className="font-mono font-semibold">
                  {s.data[hoveredIndex]}ms
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 mb-2 text-[11px] text-[var(--muted-foreground)]">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: s.color }}
              />
              <span className="font-medium">{s.label}</span>
            </span>
          ))}
        </div>

        <svg
          width={chartW + pad.left + pad.right}
          height={height}
          className="overflow-visible"
        >
          {/* Grid lines */}
          {axisLabels.map((v) => {
            const y = pad.top + chartH - (v / axisMax) * chartH;
            return (
              <line
                key={v}
                x1={pad.left}
                y1={y}
                x2={chartW + pad.left}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.5}
              />
            );
          })}

          {/* Series lines + area + points */}
          {series.map((s) => {
            const pts = s.data.map((v, i) => ({
              x: pad.left + (i / (dataLen - 1)) * chartW,
              y: pad.top + chartH - (v / axisMax) * chartH,
            }));
            const lineD = pts
              .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
              .join(" ");
            const areaD = `${lineD} L${pts[pts.length - 1].x},${pad.top + chartH} L${pts[0].x},${pad.top + chartH} Z`;

            return (
              <g key={s.label}>
                {/* Area fill */}
                <motion.path
                  d={areaD}
                  fill={s.color}
                  fillOpacity={0.06}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />

                {/* Line */}
                <motion.path
                  d={lineD}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                />

                {/* Points */}
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hoveredIndex === i ? 6 : 3}
                      fill={s.color}
                      className="cursor-pointer"
                      style={{ transition: "r 0.2s ease" }}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                    {/* Hover glow ring */}
                    {hoveredIndex === i && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={10}
                        fill={s.color}
                        fillOpacity={0.12}
                        pointerEvents="none"
                        style={{ transition: "r 0.2s ease" }}
                      />
                    )}
                  </g>
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
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.4}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

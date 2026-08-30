import React, { useState } from 'react';
import { motion } from 'motion/react';

export interface TrendPoint {
  date: string;
  high: number;
  medium: number;
  low: number;
}

export interface LineTrendChartProps {
  data: TrendPoint[];
  height?: number;
  className?: string;
}

export const LineTrendChart: React.FC<LineTrendChartProps> = ({
  data,
  height = 200,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 500;
  const padding = { top: 20, right: 20, bottom: 30, left: 35 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Max scale calculation
  const maxY = 200; // Ceiling for demo

  const getX = (index: number) => padding.left + (index / (data.length - 1)) * graphWidth;
  const getY = (val: number) => padding.top + graphHeight - (val / maxY) * graphHeight;

  const createPath = (key: 'high' | 'medium' | 'low') => {
    return data.reduce((acc, curr, idx) => {
      const x = getX(idx);
      const y = getY(curr[key]);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  const highPath = createPath('high');
  const mediumPath = createPath('medium');
  const lowPath = createPath('low');

  return (
    <div className={`w-full ${className}`}>
      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-xs font-medium text-slate-600 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>High Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Low Risk</span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Horizontal Grid lines */}
          {[0, 50, 100, 150, 200].map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94a3b8"
                  className="font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Paths */}
          <motion.path
            d={lowPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.path
            d={mediumPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
          />
          <motion.path
            d={highPath}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          />

          {/* Points & Interactive Nodes */}
          {data.map((item, idx) => {
            const x = getX(idx);
            const yHigh = getY(item.high);
            const yMed = getY(item.medium);
            const yLow = getY(item.low);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Invisible hover bar */}
                <rect
                  x={x - 15}
                  y={padding.top}
                  width="30"
                  height={graphHeight}
                  fill="transparent"
                />

                {isHovered && (
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + graphHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Circles for values */}
                <circle cx={x} cy={yHigh} r={isHovered ? 4.5 : 2.5} fill="#f43f5e" />
                <circle cx={x} cy={yMed} r={isHovered ? 4 : 2.5} fill="#f59e0b" />
                <circle cx={x} cy={yLow} r={isHovered ? 4 : 2.5} fill="#10b981" />

                {/* X-axis date labels */}
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isHovered ? '#0f172a' : '#64748b'}
                  fontWeight={isHovered ? '600' : '400'}
                >
                  {item.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip display */}
        {hoveredIdx !== null && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md flex items-center gap-3 z-10 pointer-events-none"
          >
            <span className="font-semibold">{data[hoveredIdx].date}:</span>
            <span className="text-rose-300">High: {data[hoveredIdx].high}</span>
            <span className="text-amber-300">Med: {data[hoveredIdx].medium}</span>
            <span className="text-emerald-300">Low: {data[hoveredIdx].low}</span>
          </div>
        )}
      </div>
    </div>
  );
};

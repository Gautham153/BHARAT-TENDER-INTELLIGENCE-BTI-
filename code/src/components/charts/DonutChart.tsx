import React from 'react';
import { motion } from 'motion/react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percentage?: number;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  totalLabel?: string;
  totalValue?: string | number;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  totalLabel = 'Total Projects',
  totalValue,
  size = 180,
  strokeWidth = 24,
  showLegend = true,
  className = '',
}) => {
  const total = segments.reduce((acc, seg) => acc + seg.value, 0);
  const displayTotal = totalValue !== undefined ? totalValue : total;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = -90; // Start from 12 o'clock

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-6 ${className}`}>
      {/* SVG Donut Circle */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-0">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Render Segments */}
          {segments.map((seg, idx) => {
            const segmentPct = total > 0 ? seg.value / total : 0;
            const strokeDasharray = `${circumference * segmentPct} ${circumference * (1 - segmentPct)}`;
            const rotate = currentAngle;
            currentAngle += segmentPct * 360;

            return (
              <motion.circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={0}
                transform={`rotate(${rotate} ${size / 2} ${size / 2})`}
                strokeLinecap="round"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1, delay: idx * 0.15, ease: 'easeOut' }}
              />
            );
          })}
        </svg>

        {/* Center Total Count Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
          <span className="text-xl font-bold text-slate-900 tracking-tight leading-none">
            {displayTotal}
          </span>
          <span className="text-[10px] uppercase font-semibold text-slate-400 mt-1">
            {totalLabel}
          </span>
        </div>
      </div>

      {/* Legend Column */}
      {showLegend && (
        <div className="flex flex-col gap-2.5 min-w-[140px]">
          {segments.map((seg, idx) => {
            const pct = seg.percentage !== undefined ? seg.percentage : Math.round((seg.value / (total || 1)) * 100);
            return (
              <div key={idx} className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-slate-700 font-medium">{seg.label}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900">{seg.value}</span>
                  <span className="text-[11px] text-slate-400 ml-1">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

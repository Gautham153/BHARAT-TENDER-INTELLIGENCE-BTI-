import React from 'react';
import { motion } from 'motion/react';

export const HeroArtwork: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`relative w-full h-[360px] sm:h-[400px] lg:h-[440px] flex items-center justify-center select-none overflow-hidden ${className}`}
      aria-label="Illustration of the Parliament of India with Indian National Flag and BTI Monitoring Network"
    >
      {/* Background Soft Atmospheric Radiance */}
      <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-orange-100/40 blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-emerald-100/35 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-blue-50/60 blur-3xl pointer-events-none -z-10" />

      {/* SVG Canvas */}
      <svg
        viewBox="0 0 640 440"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[600px] drop-shadow-sm"
      >
        <defs>
          {/* Subtle gradients */}
          <linearGradient id="parliamentDomeGrad" x1="330" y1="90" x2="330" y2="230" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#002B49" stopOpacity="0.14" />
            <stop offset="60%" stopColor="#002B49" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#002B49" stopOpacity="0.02" />
          </linearGradient>

          <linearGradient id="colonnadeGrad" x1="160" y1="210" x2="500" y2="210" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#002B49" stopOpacity="0.04" />
            <stop offset="50%" stopColor="#002B49" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#002B49" stopOpacity="0.04" />
          </linearGradient>

          <linearGradient id="telemetryLineGrad" x1="80" y1="220" x2="560" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF671F" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#002B49" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#046A38" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id="flagWave" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#F8FAFC" stopOpacity="1" />
            <stop offset="100%" stopColor="#F1F5F9" stopOpacity="0.9" />
          </linearGradient>

          {/* Filter for subtle drop shadows */}
          <filter id="shadowFlag" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#001D33" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* ========================================================================= */}
        {/* 1. SUBTLE DATA NETWORK & SATELLITE TELEMETRY ARCS (BACKGROUND) */}
        {/* ========================================================================= */}
        <motion.path
          d="M 60 370 Q 330 130 580 340"
          stroke="url(#telemetryLineGrad)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />
        <motion.path
          d="M 120 380 Q 330 190 540 370"
          stroke="#002B49"
          strokeWidth="1"
          strokeDasharray="2 3"
          strokeOpacity="0.2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, delay: 0.2 }}
        />

        {/* ========================================================================= */}
        {/* 2. INDIAN PARLIAMENT BUILDING (SANSAD BHAVAN / SAMVIDHAN SADAN ELEVATION) */}
        {/* ========================================================================= */}
        <g id="parliament-building" className="transition-transform">
          {/* Central Dome Background Elevation */}
          {/* Outer Dome Drum & Arch */}
          <path
            d="M 245 220 C 245 100 415 100 415 220 Z"
            fill="url(#parliamentDomeGrad)"
            stroke="#002B49"
            strokeWidth="1.8"
            strokeOpacity="0.65"
          />

          {/* Inner Architectural Dome Ribbing */}
          <path
            d="M 270 220 C 270 125 390 125 390 220"
            stroke="#002B49"
            strokeWidth="1"
            strokeDasharray="3 2"
            strokeOpacity="0.4"
            fill="none"
          />
          <path
            d="M 298 220 C 298 140 362 140 362 220"
            stroke="#002B49"
            strokeWidth="0.8"
            strokeOpacity="0.3"
            fill="none"
          />

          {/* Dome Drum Clerestory Arches (Window Row on Drum) */}
          <g id="dome-clerestory" opacity="0.6">
            <rect x="252" y="195" width="156" height="25" fill="#002B49" fillOpacity="0.06" stroke="#002B49" strokeWidth="0.8" />
            {[262, 276, 290, 304, 318, 332, 346, 360, 374, 388].map((x, i) => (
              <path
                key={i}
                d={`M ${x} 220 L ${x} 204 C ${x} 200 ${x + 8} 200 ${x + 8} 204 L ${x + 8} 220`}
                stroke="#002B49"
                strokeWidth="0.9"
                fill="#002B49"
                fillOpacity="0.12"
              />
            ))}
          </g>

          {/* Dome Finial / Kalash / Spires */}
          <line x1="330" y1="102" x2="330" y2="72" stroke="#002B49" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="330" cy="70" r="4" fill="#FF671F" stroke="#002B49" strokeWidth="1" />
          <circle cx="330" cy="62" r="2" fill="#046A38" />

          {/* Circular Parliament Colonnade Upper Entablature (Roof Ring & Chhajja) */}
          <path
            d="M 130 220 C 130 205 530 205 530 220 L 535 232 C 535 232 125 232 125 232 Z"
            fill="#002B49"
            fillOpacity="0.12"
            stroke="#002B49"
            strokeWidth="1.4"
          />
          {/* Classical Jaali / Parapet Line */}
          <line x1="128" y1="225" x2="532" y2="225" stroke="#002B49" strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.6" />

          {/* Colonnade Background Fill */}
          <rect x="135" y="232" width="390" height="92" fill="url(#colonnadeGrad)" />

          {/* The Famous 24+ Circular Colonnade Pillars of Sansad Bhavan */}
          {[
            145, 161, 177, 193, 209, 225, 241, 257, 273, 289,
            305, 321, 339, 355, 371, 387, 403, 419, 435, 451,
            467, 483, 499, 515
          ].map((x, idx) => {
            const isCenterPillar = x >= 305 && x <= 355;
            return (
              <g key={idx} opacity={isCenterPillar ? 0.95 : 0.75}>
                {/* Column Shaft */}
                <line x1={x} y1="232" x2={x} y2="324" stroke="#002B49" strokeWidth={isCenterPillar ? "2" : "1.7"} />
                {/* Column Capital & Base */}
                <rect x={x - 3.5} y="232" width="7" height="3" fill="#002B49" fillOpacity="0.8" rx="0.5" />
                <rect x={x - 3.5} y="321" width="7" height="3" fill="#002B49" fillOpacity="0.8" rx="0.5" />
              </g>
            );
          })}

          {/* Central Ceremonial Portico / Entrance Pavilion */}
          <rect x="295" y="222" width="70" height="102" fill="#FFFFFF" fillOpacity="0.4" stroke="#002B49" strokeWidth="1.2" strokeOpacity="0.7" />
          <path d="M 292 222 L 330 206 L 368 222 Z" fill="#002B49" fillOpacity="0.18" stroke="#002B49" strokeWidth="1.2" />

          {/* Ashoka Chakra in Central Portico Pediment */}
          <circle cx="330" cy="216" r="5" stroke="#002B49" strokeWidth="0.9" fill="#FFFFFF" />
          <circle cx="330" cy="216" r="1.5" fill="#046A38" />

          {/* Central Entrance Portal Archway */}
          <path
            d="M 314 324 L 314 275 C 314 263 346 263 346 275 L 346 324 Z"
            fill="#002B49"
            fillOpacity="0.15"
            stroke="#002B49"
            strokeWidth="1.2"
          />

          {/* Multi-tier Red & Buff Sandstone Plinth Foundation (Stepped Base) */}
          <rect x="110" y="324" width="440" height="12" fill="#002B49" fillOpacity="0.16" stroke="#002B49" strokeWidth="1.4" />
          <rect x="90" y="336" width="480" height="10" fill="#002B49" fillOpacity="0.10" stroke="#002B49" strokeWidth="1.1" />
          <rect x="70" y="346" width="520" height="8" fill="#002B49" fillOpacity="0.06" stroke="#002B49" strokeWidth="0.9" />

          {/* Ceremonial Central Grand Staircase Steps */}
          {[
            { y: 324, w: 90, h: 4 },
            { y: 328, w: 104, h: 4 },
            { y: 332, w: 118, h: 4 },
            { y: 336, w: 132, h: 4 },
            { y: 340, w: 146, h: 4 },
            { y: 344, w: 160, h: 4 },
            { y: 348, w: 174, h: 6 },
          ].map((step, idx) => (
            <rect
              key={idx}
              x={330 - step.w / 2}
              y={step.y}
              width={step.w}
              height={step.h}
              fill="#002B49"
              fillOpacity={0.12 + idx * 0.02}
              stroke="#002B49"
              strokeWidth="0.8"
              strokeOpacity="0.5"
            />
          ))}
        </g>

        {/* ========================================================================= */}
        {/* 3. INDIAN NATIONAL FLAG (TIRANGA) WITH ASHOKA CHAKRA ON VISIBLE MAST */}
        {/* ========================================================================= */}
        <g id="indian-national-flag" filter="url(#shadowFlag)">
          {/* Flagpole Base Plinth */}
          <rect x="68" y="348" width="18" height="6" fill="#002B49" fillOpacity="0.4" rx="1" />
          <rect x="71" y="342" width="12" height="6" fill="#002B49" fillOpacity="0.6" rx="0.5" />

          {/* Silver/Navy Flag Mast */}
          <line x1="77" y1="344" x2="77" y2="76" stroke="#001D33" strokeWidth="3" strokeLinecap="round" />
          <line x1="78" y1="344" x2="78" y2="76" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />

          {/* Flagpole Golden Finial Spearhead */}
          <path d="M 77 66 L 80 76 L 74 76 Z" fill="#FFB81C" stroke="#B45309" strokeWidth="0.8" />
          <circle cx="77" cy="76" r="2.5" fill="#FFB81C" />

          {/* Halyard Cord */}
          <line x1="79" y1="78" x2="79" y2="340" stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="2 2" />

          {/* Flying Indian Tricolour Flag Waves */}
          {/* Band 1: Saffron (#FF671F / India Saffron) */}
          <motion.path
            d="M 77 78 C 110 74 135 84 175 79 L 175 97 C 135 102 110 92 77 96 Z"
            fill="#FF671F"
            stroke="#D97706"
            strokeWidth="0.5"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />

          {/* Band 2: White (#FFFFFF) with Navy Ashoka Chakra */}
          <motion.path
            d="M 77 96 C 110 92 135 102 175 97 L 175 115 C 135 120 110 110 77 114 Z"
            fill="url(#flagWave)"
            stroke="#E2E8F0"
            strokeWidth="0.5"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />

          {/* 24-Spoked Ashoka Chakra in White Band Center */}
          <g id="flag-ashoka-chakra" transform="translate(126, 105.5)">
            {/* Outer Chakra Ring */}
            <circle cx="0" cy="0" r="5.5" stroke="#000080" strokeWidth="0.85" fill="none" />
            {/* Inner Chakra Hub */}
            <circle cx="0" cy="0" r="1.2" fill="#000080" />
            {/* 24 Characteristic Spokes */}
            {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((angle, idx) => (
              <line
                key={idx}
                x1="0"
                y1="0"
                x2={5.2 * Math.cos((angle * Math.PI) / 180)}
                y2={5.2 * Math.sin((angle * Math.PI) / 180)}
                stroke="#000080"
                strokeWidth="0.45"
              />
            ))}
          </g>

          {/* Band 3: Green (#046A38 / India Green) */}
          <motion.path
            d="M 77 114 C 110 110 135 120 175 115 L 175 133 C 135 138 110 128 77 132 Z"
            fill="#046A38"
            stroke="#065F46"
            strokeWidth="0.5"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          />
        </g>

        {/* ========================================================================= */}
        {/* 4. RESTRAINED BTI TELEMETRY NODES & SYSTEM MONITORING DATA BADGES */}
        {/* ========================================================================= */}
        {/* Telemetry Node 1: MPLADS Sanction */}
        <g transform="translate(110, 165)">
          <line x1="0" y1="0" x2="45" y2="45" stroke="#FF671F" strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.5" />
          <circle cx="0" cy="0" r="4" fill="#FF671F" />
          <circle cx="0" cy="0" r="8" stroke="#FF671F" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 2" />
          <rect x="-36" y="-22" width="72" height="16" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" filter="url(#shadowFlag)" />
          <text x="0" y="-11" fill="#002B49" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
            MPLADS ₹5 Cr
          </text>
        </g>

        {/* Telemetry Node 2: AI Triage & Anomaly Scan */}
        <g transform="translate(530, 145)">
          <line x1="0" y1="0" x2="-65" y2="60" stroke="#002B49" strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.5" />
          <circle cx="0" cy="0" r="4.5" fill="#002B49" />
          <circle cx="0" cy="0" r="9" stroke="#002B49" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 2" />
          <rect x="-38" y="-22" width="76" height="16" rx="4" fill="#001D33" stroke="#334155" strokeWidth="0.8" filter="url(#shadowFlag)" />
          <text x="0" y="-11" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
            AI Triage Scan
          </text>
        </g>

        {/* Telemetry Node 3: Geo-Audit Verification */}
        <g transform="translate(555, 280)">
          <line x1="0" y1="0" x2="-60" y2="20" stroke="#046A38" strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.5" />
          <circle cx="0" cy="0" r="4" fill="#046A38" />
          <circle cx="0" cy="0" r="8" stroke="#046A38" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 2" />
          <rect x="-42" y="-22" width="84" height="16" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" filter="url(#shadowFlag)" />
          <text x="0" y="-11" fill="#046A38" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
            GIS Geo-Verified
          </text>
        </g>
      </svg>
    </div>
  );
};

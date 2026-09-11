import React from 'react';

export const HeroArtwork: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`relative w-full flex items-center justify-center select-none ${className}`}
      aria-label="Illustration of the Parliament of India with Indian National Flag and BTI Monitoring Network"
    >
      {/* Background Soft Atmospheric Radiance */}
      <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-orange-100/40 blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-emerald-100/35 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-blue-50/60 blur-3xl pointer-events-none -z-10" />

      {/* Authoritative Parliament Illustration Image Asset */}
      <img
        src="/assets/parliament-illustration.png"
        alt="Stylized Indian Parliament illustration with tricolor brush-stroke elements"
        className="w-full h-auto max-w-full object-contain drop-shadow-sm transition-transform duration-500 hover:scale-[1.01]"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes('image.png')) {
            target.src = '/assets/image.png';
          }
        }}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Layers, ZoomIn, ZoomOut, Maximize2, ExternalLink, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Project } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { RiskBadge } from '../ui/RiskBadge';
import { Button } from '../ui/Button';

export interface ProjectMapProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (project: Project) => void;
  height?: string;
  showFilters?: boolean;
  portalMode?: 'government' | 'public' | 'agency';
  className?: string;
}

export const ProjectMap: React.FC<ProjectMapProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  height = '480px',
  showFilters = true,
  portalMode = 'public',
  className = '',
}) => {
  const [mapLayer, setMapLayer] = useState<'map' | 'satellite'>('map');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedState, setSelectedState] = useState<string>('All');
  const [activeProject, setActiveProject] = useState<Project | null>(
    projects.find((p) => p.id === selectedProjectId) || null
  );

  const filteredProjects = projects.filter((p) => {
    if (selectedState !== 'All' && p.state !== selectedState) return false;
    return true;
  });

  // Calculate coordinates mapping to SVG viewbox (approx India bounding box: Lat 8-37, Lng 68-97)
  const mapCoordinatesToSvg = (lat: number, lng: number) => {
    const minLng = 68.0;
    const maxLng = 97.0;
    const minLat = 8.0;
    const maxLat = 37.0;

    const x = ((lng - minLng) / (maxLng - minLng)) * 700 + 50;
    // Y inverted for SVG
    const y = ((maxLat - lat) / (maxLat - minLat)) * 600 + 40;

    return { x, y };
  };

  const states = ['All', 'Uttar Pradesh', 'Rajasthan', 'Bihar', 'Madhya Pradesh', 'Maharashtra', 'Karnataka', 'Delhi'];

  return (
    <div className={`relative bg-slate-100 border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs flex flex-col ${className}`} style={{ height }}>
      {/* Top Map Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Layer Switcher */}
        <div className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-slate-200 shadow-sm text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMapLayer('map')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              mapLayer === 'map' ? 'bg-[#002B49] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vector Map
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('satellite')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              mapLayer === 'satellite' ? 'bg-[#002B49] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Satellite View
          </button>
        </div>

        {/* State Filter Pill */}
        {showFilters && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">State:</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              aria-label="Filter by state"
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Map Canvas with India Geography Silhouette & Pins */}
      <div
        className={`w-full h-full relative overflow-hidden flex items-center justify-center transition-colors ${
          mapLayer === 'satellite'
            ? 'bg-[#0d1e2d] bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:16px_16px]'
            : 'bg-[#f8fafc] bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]'
        }`}
      >
        {/* SVG India Map Vector Representation */}
        <svg
          viewBox="0 0 800 680"
          className="w-full h-full max-w-[760px] max-h-[640px] select-none transition-transform duration-300"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Stylized India Subcontinent Outline */}
          <path
            d="M 380 70 
               L 410 110 L 440 120 L 480 140 L 520 180 L 560 200 L 600 230 L 640 250 L 670 270 
               L 660 290 L 610 290 L 570 320 L 530 330 L 520 370 L 490 410 L 460 460 L 430 520 
               L 400 580 L 370 540 L 340 480 L 310 430 L 280 380 L 260 330 L 240 280 L 270 230 
               L 290 180 L 320 130 L 350 90 Z"
            fill={mapLayer === 'satellite' ? '#162e47' : '#eef2f6'}
            stroke={mapLayer === 'satellite' ? '#254b73' : '#cbd5e1'}
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Internal Regional Lines */}
          <path
            d="M 320 230 Q 400 250 500 240 M 280 340 Q 380 370 480 360 M 340 440 Q 410 460 450 430"
            fill="none"
            stroke={mapLayer === 'satellite' ? '#1f3f60' : '#e2e8f0'}
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />

          {/* Interactive Project Pins */}
          {filteredProjects.map((project) => {
            const coords = project.locationCoordinates || { lat: 20 + Math.random() * 8, lng: 76 + Math.random() * 6 };
            const { x, y } = mapCoordinatesToSvg(coords.lat, coords.lng);
            const isSelected = activeProject?.id === project.id;
            const isHighRisk = portalMode !== 'public' && project.riskScore >= 60;

            const pinColor = isHighRisk ? '#f43f5e' : project.status === 'Completed' ? '#10b981' : '#002B49';

            return (
              <g
                key={project.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => {
                  setActiveProject(project);
                  if (onSelectProject) onSelectProject(project);
                }}
                className="cursor-pointer group"
              >
                {/* Ripple animation for active / high-risk */}
                {(isSelected || isHighRisk) && (
                  <circle
                    r={isSelected ? 18 : 14}
                    fill={pinColor}
                    fillOpacity="0.2"
                    className="animate-ping"
                  />
                )}

                {/* Marker Pin Base */}
                <circle
                  r={isSelected ? 12 : 9}
                  fill={pinColor}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  filter="url(#pinShadow)"
                  className="transition-transform group-hover:scale-125"
                />

                {/* Inner symbol */}
                <circle r={isSelected ? 4 : 3} fill="#ffffff" />

                {/* Title tooltip hover on SVG */}
                <title>{`${project.title} (${project.state})`}</title>
              </g>
            );
          })}
        </svg>

        {/* Floating Zoom & Compass Controls */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col bg-white rounded-xl border border-slate-200 shadow-md p-1 gap-1">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 1.8))}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.8))}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            title="Reset Zoom"
            aria-label="Reset Zoom"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Project Card Popup Overlay */}
        <AnimatePresence>
          {activeProject && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-4 left-4 right-16 sm:right-auto sm:max-w-md z-30 bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-xl p-4.5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                    {activeProject.projectCode}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{activeProject.title}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveProject(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close project info"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                {activeProject.locationCoordinates?.address || `${activeProject.district}, ${activeProject.state}`}
              </p>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                <StatusBadge status={activeProject.status} size="sm" />
                {portalMode !== 'public' && (
                  <RiskBadge score={activeProject.riskScore} level={activeProject.riskLevel} size="sm" />
                )}
                <span className="text-xs font-bold text-slate-800 ml-auto">
                  ₹ {(activeProject.sanctionedBudget / 10000000).toFixed(2)} Cr
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Physical Progress: <strong className="text-slate-900">{activeProject.physicalProgress}%</strong>
                </div>
                {onSelectProject && (
                  <Button
                    variant="gov"
                    size="sm"
                    onClick={() => onSelectProject(activeProject)}
                    icon={ExternalLink}
                    iconPosition="right"
                    className="text-xs py-1 px-2.5"
                  >
                    View Details
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

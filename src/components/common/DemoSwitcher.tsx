import React, { useState } from 'react';
import { Shield, Building2, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface DemoSwitcherProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const DemoSwitcher: React.FC<DemoSwitcherProps> = ({ currentPath, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, loginDemo } = useAuth();

  const isGov = currentPath.startsWith('/government');
  const isAgency = currentPath.startsWith('/agency');
  const isPublic = !isGov && !isAgency;

  const handleSwitchToGov = async () => {
    if (user?.role !== 'government') {
      await loginDemo('government');
    }
    onNavigate('/government/dashboard');
  };

  const handleSwitchToAgency = async () => {
    if (user?.role !== 'agency') {
      await loginDemo('agency');
    }
    onNavigate('/agency/dashboard');
  };

  return (
    <aside
      aria-label="Demo portal navigation switcher"
      className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 select-none transition-all duration-200"
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="bg-[#001D33]/95 hover:bg-[#001D33] text-white border border-slate-700 shadow-xl rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md cursor-pointer transition-all hover:scale-105"
          title="Expand Demo Switcher"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px]">DEMO SWITCHER</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      ) : (
        <div className="bg-[#001D33]/95 text-white border border-slate-700/90 shadow-2xl rounded-2xl sm:rounded-full p-1 sm:px-2.5 sm:py-1.5 flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-1.5 text-xs backdrop-blur-md">
          <div className="flex items-center gap-1 px-1.5 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="hidden md:inline">Portal Switch:</span>
          </div>

          {/* Government Portal */}
          <button
            type="button"
            onClick={handleSwitchToGov}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isGov
                ? 'bg-[#002B49] text-white border border-blue-400 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Shield className="w-3 h-3 text-blue-300" />
            <span>Govt</span>
          </button>

          {/* Agency Portal */}
          <button
            type="button"
            onClick={handleSwitchToAgency}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isAgency
                ? 'bg-emerald-800 text-white border border-emerald-400 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Building2 className="w-3 h-3 text-emerald-300" />
            <span>Agency</span>
          </button>

          {/* Public Portal */}
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isPublic
                ? 'bg-amber-700 text-white border border-amber-400 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Globe className="w-3 h-3 text-amber-300" />
            <span>Public</span>
          </button>

          {/* Minimize button */}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 ml-0.5 cursor-pointer"
            title="Minimize"
            aria-label="Minimize demo switcher"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};

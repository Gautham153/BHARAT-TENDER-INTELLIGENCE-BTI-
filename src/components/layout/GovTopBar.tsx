import React, { useState } from 'react';
import { Globe, HelpCircle, Eye } from 'lucide-react';

export const GovTopBar: React.FC = () => {
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'larger'>('normal');
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  return (
    <div className="w-full bg-[#001D33] text-slate-200 border-b border-slate-800 text-[11px] font-medium py-1 px-4 sm:px-8 flex items-center justify-between select-none">
      {/* Left: Indian Flag & Identity */}
      <div className="flex items-center gap-2.5">
        <div className="flex flex-col w-3.5 h-2.5 rounded-[1px] overflow-hidden shadow-2xs border border-white/20">
          <div className="h-1/3 bg-[#FF671F]" />
          <div className="h-1/3 bg-white flex items-center justify-center">
            <div className="w-0.5 h-0.5 rounded-full bg-[#000080]" />
          </div>
          <div className="h-1/3 bg-[#046A38]" />
        </div>
        <span className="text-slate-300 font-semibold tracking-wide">
          {lang === 'hi' ? 'भारत सरकार | Government of India' : 'भारत सरकार | Government of India'}
        </span>
        <span className="hidden md:inline-block text-slate-500 font-normal">
          • Smart India Hackathon Prototype
        </span>
      </div>

      {/* Right: Accessibility, Language & Help */}
      <div className="flex items-center gap-4 text-slate-300">
        {/* Font resize controls */}
        <div className="hidden sm:flex items-center gap-1.5 border-r border-slate-700/80 pr-3">
          <button
            type="button"
            onClick={() => setFontSize('normal')}
            className={`px-1 rounded hover:text-white ${fontSize === 'normal' ? 'font-bold text-white' : 'text-slate-400'}`}
            title="Standard text size"
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => setFontSize('large')}
            className={`px-1 rounded hover:text-white ${fontSize === 'large' ? 'font-bold text-white' : 'text-slate-400'}`}
            title="Medium text size"
          >
            A
          </button>
          <button
            type="button"
            onClick={() => setFontSize('larger')}
            className={`px-1 rounded hover:text-white ${fontSize === 'larger' ? 'font-bold text-white' : 'text-slate-400'}`}
            title="Larger text size"
          >
            A+
          </button>
        </div>

        {/* High contrast / screen reader indicator */}
        <div className="hidden md:flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer">
          <Eye className="w-3 h-3" />
          <span>Screen Reader</span>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3 text-slate-400" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as 'en' | 'hi')}
            className="bg-transparent text-slate-200 border-none outline-none font-medium cursor-pointer text-[11px]"
            aria-label="Select Language"
          >
            <option value="en" className="bg-[#001D33] text-slate-200">English</option>
            <option value="hi" className="bg-[#001D33] text-slate-200">हिंदी (Hindi)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

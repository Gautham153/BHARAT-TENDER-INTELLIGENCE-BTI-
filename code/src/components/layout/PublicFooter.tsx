import React from 'react';
import { BtiLogo } from '../common/BtiLogo';
import { ExternalLink, Shield, Lock, FileCheck } from 'lucide-react';

export const PublicFooter: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  return (
    <footer className="bg-white border-t border-slate-200 text-slate-600 text-sm">
      {/* Upper Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <BtiLogo size="md" />
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              Bharat Tender Intelligence (BTI) is an advanced AI-powered governance and tender monitoring
              framework designed to enhance transparency, eliminate anomalies, and optimize the execution of
              MPLAD Scheme public development projects across Bharat.
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                SIH Prototype
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#002B49]" />
                Zero-Trust Ready
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                Phase 0 Foundation
              </span>
            </div>
          </div>

          {/* Quick Portals */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Portals</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/government/dashboard')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  Government Portal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/agency/dashboard')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  Agency & Vendor Workspace
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  Public Transparency Hub
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/map')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  National GIS Project Map
                </button>
              </li>
            </ul>
          </div>

          {/* Information Links */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/how-it-works')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  How BTI Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/transparency')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  Data Transparency
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/resources')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  Technical Architecture
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="hover:text-[#002B49] transition-colors cursor-pointer"
                >
                  Helpdesk & Support
                </button>
              </li>
            </ul>
          </div>

          {/* Institutional Compliance Badge */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Digital India</h4>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
              <div className="text-[11px] font-semibold text-slate-800">
                Ministry of Statistics & Programme Implementation (MoSPI)
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Designed for Member of Parliament Local Area Development Scheme (MPLADS) monitoring guidelines.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-strip */}
      <div className="border-t border-slate-200/80 bg-slate-50 py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Bharat Tender Intelligence (BTI). Smart India Hackathon Prototype.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-800 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-800 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-800 cursor-pointer">Accessibility Statement</span>
            <span className="hover:text-slate-800 cursor-pointer">RTI Disclosures</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

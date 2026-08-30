import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  FileCheck2,
  AlertTriangle,
  SearchCheck,
  FolderKanban,
  MapPin,
  History,
  BarChart3,
  Settings,
  Receipt,
  FileBadge2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { BtiLogo } from '../common/BtiLogo';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeVariant?: 'default' | 'danger' | 'warning' | 'success';
}

export interface SidebarProps {
  portal: 'government' | 'agency' | 'public';
  currentPath: string;
  onNavigate: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userRole?: string;
  userName?: string;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  portal,
  currentPath,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  userRole = portal === 'government' ? 'District Collector / Nodal Officer' : 'Project Director',
  userName = portal === 'government' ? 'Sh. Rajesh Varma, IAS' : 'Vikramaditya Infrastructure Ltd',
  onLogout,
}) => {
  const govNavItems: NavItem[] = [
    { id: 'gov-dash', label: 'Executive Dashboard', path: '/government/dashboard', icon: LayoutDashboard },
    { id: 'gov-tenders', label: 'Tender Management', path: '/government/tenders', icon: FileSpreadsheet, badge: 14 },
    { id: 'gov-proposals', label: 'Proposal Evaluation', path: '/government/proposals', icon: FileCheck2, badge: 8 },
    { id: 'gov-risks', label: 'Anomaly & Risk Alerts', path: '/government/risk-alerts', icon: AlertTriangle, badge: 3, badgeVariant: 'danger' },
    { id: 'gov-inves', label: 'Fraud Investigations', path: '/government/investigations', icon: SearchCheck, badge: 2, badgeVariant: 'warning' },
    { id: 'gov-projects', label: 'Project Monitoring', path: '/government/projects', icon: FolderKanban },
    { id: 'gov-map', label: 'National GIS Map', path: '/government/projects/map', icon: MapPin },
    { id: 'gov-analytics', label: 'Reports & Analytics', path: '/government/analytics', icon: BarChart3 },
    { id: 'gov-audit', label: 'System Audit Logs', path: '/government/audit-logs', icon: History },
    { id: 'gov-settings', label: 'Settings & Security', path: '/government/settings', icon: Settings },
  ];

  const agencyNavItems: NavItem[] = [
    { id: 'ag-dash', label: 'Agency Dashboard', path: '/agency/dashboard', icon: LayoutDashboard },
    { id: 'ag-tenders', label: 'Live Tenders (Bidding)', path: '/agency/tenders', icon: FileSpreadsheet, badge: 'New' },
    { id: 'ag-bids', label: 'My Submitted Proposals', path: '/agency/proposals', icon: FileCheck2, badge: 3 },
    { id: 'ag-milestones', label: 'Project Milestones', path: '/agency/milestones', icon: FolderKanban },
    { id: 'ag-disbursements', label: 'Disbursement Claims', path: '/agency/disbursements', icon: Receipt },
    { id: 'ag-compliance', label: 'GST & Compliance Profile', path: '/agency/compliance', icon: FileBadge2 },
  ];

  const navItems = portal === 'agency' ? agencyNavItems : govNavItems;

  const badgeColors = {
    default: 'bg-slate-100 text-slate-700',
    danger: 'bg-rose-100 text-rose-800 font-bold',
    warning: 'bg-amber-100 text-amber-900 font-bold',
    success: 'bg-emerald-100 text-emerald-800 font-bold',
  };

  return (
    <aside
      className={`h-screen bg-[#001D33] text-slate-200 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 z-30 sticky top-0 shrink-0 select-none ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Top Header & Branding */}
      <div className="min-w-0">
        <div className="h-16 px-3.5 flex items-center justify-between border-b border-slate-800/80 min-w-0">
          {!isCollapsed ? (
            <div
              onClick={() => onNavigate('/')}
              className="cursor-pointer min-w-0 flex-1 overflow-hidden mr-2"
              title="Return to Public Portal"
            >
              <BtiLogo portal={portal} size="sm" theme="dark" />
            </div>
          ) : (
            <div
              onClick={() => onNavigate('/')}
              className="w-full flex items-center justify-center cursor-pointer"
              title="Return to Public Portal"
            >
              <BtiLogo portal={portal} size="sm" compact theme="dark" />
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Portal Indicator Pill */}
        {!isCollapsed && (
          <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs min-w-0">
            <div className="flex items-center gap-1.5 text-slate-300 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold truncate">
                {portal === 'government' ? 'State Nodal Desk' : 'Registered Vendor'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">BTI-v0.9</span>
          </div>
        )}

        {/* Navigation List */}
        <nav className="p-2.5 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)] no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.path)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-blue-700/80 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between text-left truncate min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${
                          badgeColors[item.badgeVariant || 'default']
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Info & Exit */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 min-w-0">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-800/60 transition-colors min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-blue-900 border border-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{userName}</div>
                <div className="text-[10px] text-slate-400 truncate">{userRole}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout || (() => onNavigate('/'))}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-8 h-8 rounded-full bg-blue-900 border border-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {userName.charAt(0)}
            </div>
            <button
              type="button"
              onClick={onLogout || (() => onNavigate('/'))}
              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

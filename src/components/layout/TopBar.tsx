import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Search,
  HelpCircle,
  Shield,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ArrowUpRight,
} from 'lucide-react';
import { SyntheticDataNotice } from '../common/SyntheticDataNotice';
import { Dropdown } from '../ui/Dropdown';

export interface TopBarProps {
  portal: 'government' | 'agency' | 'public';
  onToggleMobileSidebar: () => void;
  onNavigate: (path: string) => void;
  title?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  portal,
  onToggleMobileSidebar,
  onNavigate,
  title,
}) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notifications = [
    {
      id: 'notif-1',
      title: 'High Risk Alert: Bid Rigging Signal',
      time: '12m ago',
      unread: true,
      path: '/government/risk-alerts',
    },
    {
      id: 'notif-2',
      title: 'Tender Evaluation Completed by AI',
      time: '1h ago',
      unread: true,
      path: '/government/proposals',
    },
    {
      id: 'notif-3',
      title: 'Milestone Disbursal Pending Review',
      time: '3h ago',
      unread: false,
      path: '/government/projects',
    },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Left: Mobile hamburger + Optional Title or Search */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {title && (
          <h2 className="hidden sm:block text-base font-bold text-slate-900 tracking-tight">{title}</h2>
        )}
      </div>

      {/* Center: Search input */}
      <div className="hidden lg:flex items-center relative max-w-xs w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Quick search tenders, IDs, GSTIN..."
          className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#002B49] focus:ring-1 focus:ring-[#002B49]"
        />
      </div>

      {/* Right Controls: Synthetic Data badge + Portal Switcher + Notification Bell + User */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Synthetic Demo Data Indicator */}
        <SyntheticDataNotice className="hidden xl:inline-flex" />

        {/* Quick Portal Switcher for SIH Jury & Judges */}
        <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onNavigate('/government/dashboard')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              portal === 'government' ? 'bg-white text-[#002B49] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Govt</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/agency/dashboard')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              portal === 'agency' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Agency</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              portal === 'public' ? 'bg-white text-orange-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Public</span>
          </button>
        </div>

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-600 rounded-full ring-2 ring-white" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase">Live Intelligence Alerts</span>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full font-bold">2 New</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      onNavigate(n.path);
                      setNotificationsOpen(false);
                    }}
                    className={`p-3 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                      n.unread ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <div className="font-semibold text-slate-900 flex items-center justify-between">
                      <span>{n.title}</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

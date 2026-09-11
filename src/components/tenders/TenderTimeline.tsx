// Bharat Tender Intelligence (BTI) — Tender Lifecycle & Audit Trail Component
// Phase 3A: Append-Only Immutable Event Visualizer

import React from 'react';
import { TenderAuditEvent } from '../../types/tender';
import {
  FilePlus,
  Edit3,
  Send,
  Lock,
  XCircle,
  Archive,
  User,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface TenderTimelineProps {
  events: TenderAuditEvent[];
  loading?: boolean;
}

export const TenderTimeline: React.FC<TenderTimelineProps> = ({ events, loading }) => {
  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-slate-500">
        <Clock className="w-5 h-5 mx-auto mb-2 animate-spin text-slate-400" />
        Loading statutory audit trail...
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-sm text-slate-500">
        No lifecycle audit events recorded yet for this tender.
      </div>
    );
  }

  const getActionConfig = (action: string) => {
    switch (action) {
      case 'CREATED':
        return {
          icon: FilePlus,
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
          dotBg: 'bg-blue-600',
          label: 'Tender Created',
        };
      case 'UPDATED':
        return {
          icon: Edit3,
          badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
          dotBg: 'bg-slate-600',
          label: 'Specifications Updated',
        };
      case 'PUBLISHED':
        return {
          icon: Send,
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dotBg: 'bg-emerald-600',
          label: 'Published for Bidding',
        };
      case 'CLOSED':
        return {
          icon: Lock,
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
          dotBg: 'bg-amber-600',
          label: 'Bidding Closed',
        };
      case 'CANCELLED':
        return {
          icon: XCircle,
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
          dotBg: 'bg-rose-600',
          label: 'Tender Cancelled',
        };
      case 'ARCHIVED':
        return {
          icon: Archive,
          badgeBg: 'bg-zinc-100 text-zinc-700 border-zinc-300',
          dotBg: 'bg-zinc-600',
          label: 'Archived to Historical Log',
        };
      default:
        return {
          icon: Clock,
          badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
          dotBg: 'bg-slate-600',
          label: action,
        };
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div id="tender-lifecycle-timeline" className="relative pl-6 space-y-6">
      {/* Vertical Connecting Line */}
      <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-slate-200" />

      {events.map((evt, idx) => {
        const config = getActionConfig(evt.action);
        const IconComponent = config.icon;

        return (
          <div key={evt.eventId || idx} className="relative group">
            {/* Timeline node icon */}
            <div
              className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center ${config.dotBg} text-white shadow-xs ring-4 ring-white`}
            >
              <IconComponent className="w-3 h-3" />
            </div>

            {/* Event Content Box */}
            <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${config.badgeBg}`}
                  >
                    {config.label}
                  </span>

                  {evt.previousStatus && evt.newStatus && evt.previousStatus !== evt.newStatus && (
                    <span className="text-xs font-mono text-slate-500">
                      {evt.previousStatus} → <span className="font-semibold text-slate-700">{evt.newStatus}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatDateTime(evt.timestamp)}</span>
                </div>
              </div>

              {/* Notes */}
              {evt.notes && (
                <p className="text-xs text-slate-700 my-1 leading-relaxed">
                  {evt.notes}
                </p>
              )}

              {/* Actor details */}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-700">
                    {evt.actorName}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span className="capitalize">{evt.actorRole} Authority</span>
                </div>

                {evt.actorEmail && (
                  <span className="hidden sm:inline font-mono text-slate-400">
                    ({evt.actorEmail})
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

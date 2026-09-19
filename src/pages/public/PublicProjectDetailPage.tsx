// Bharat Tender Intelligence (BTI) — Public Project Detail Page
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Strictly allowlisted public presentation with 8 structured citizen-safe accountability sections.

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  Coins,
  CheckCircle2,
  Clock,
  FileCheck2,
  Layers,
  Search,
  Shield,
  Info,
  User,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { PublicTransparencyService } from '../../services/transparency/publicTransparencyService';
import { PublicProjectDTO } from '../../types/publicTransparency';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';

export interface PublicProjectDetailPageProps {
  projectId: string;
  onNavigate: (path: string) => void;
}

export const PublicProjectDetailPage: React.FC<PublicProjectDetailPageProps> = ({
  projectId,
  onNavigate,
}) => {
  const [project, setProject] = useState<PublicProjectDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadProject() {
      setIsLoading(true);
      try {
        const data = await PublicTransparencyService.getPublicProjectById(projectId);
        if (isMounted) {
          setProject(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load public project detail:', err);
        if (isMounted) {
          setProject(null);
          setIsLoading(false);
        }
      }
    }
    loadProject();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-500">
        <div className="inline-block w-8 h-8 border-3 border-slate-300 border-t-[#002B49] rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Retrieving public transparency record...</p>
      </div>
    );
  }

  // Section 33A: Protection against URL enumeration
  // For both nonexistent project IDs and existing but non-public project IDs,
  // return the exact same generic public unavailable/not-found response.
  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
          <Search className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Project Record Unavailable
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            This project is not publicly available or does not exist. Please check the project identifier or browse the public directory.
          </p>
        </div>

        <div className="pt-2">
          <Button
            variant="gov"
            size="md"
            onClick={() => onNavigate('/transparency/projects')}
            icon={ArrowLeft}
            className="bg-[#002B49] text-white font-bold"
          >
            Return to Public Projects Directory
          </Button>
        </div>
      </div>
    );
  }

  const formatCurrencyCr = (amount?: number) => {
    if (amount === undefined || isNaN(amount)) return 'Not recorded';
    return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr.includes('Date not available')) return 'Date not available in the current record.';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <button
          onClick={() => onNavigate('/transparency')}
          className="hover:text-[#002B49] font-medium transition-colors cursor-pointer"
        >
          Transparency
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <button
          onClick={() => onNavigate('/transparency/projects')}
          className="hover:text-[#002B49] font-medium transition-colors cursor-pointer"
        >
          Projects Directory
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-bold truncate max-w-xs sm:max-w-md">
          {project.projectName}
        </span>
      </nav>

      {/* Demonstration Banner */}
      {project.isDemonstrationData && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong className="text-amber-900 font-semibold">Demonstration Data Notice:</strong> This public record represents synthesized demonstration data for prototype evaluation and citizen audit testing.
            </span>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-amber-200/60 font-mono text-[10px] text-amber-900 font-bold">
            SYNTHETIC DATA
          </span>
        </div>
      )}

      {/* SECTION 1: Project Overview Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                {project.projectNumber || project.projectId}
              </span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                {project.category} • {project.sector}
              </span>
              <StatusBadge status={project.statusLabel} size="md" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {project.projectName}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {project.location.district}, {project.location.state} ({project.location.constituency})
                </span>
              </div>
              {project.mpName && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    MP: <strong className="text-slate-800">{project.mpName}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/transparency/projects')}
            icon={ArrowLeft}
            className="self-start text-xs border-slate-300 text-slate-700 shrink-0 font-bold"
          >
            Back to Directory
          </Button>
        </div>

        {project.description && (
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
            {project.description}
          </p>
        )}

        {/* Stakeholder Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <div className="text-slate-400">Implementing Agency</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5">
              {project.implementingAgencyName || 'Designated Public Agency'}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Monitoring Authority</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5">
              {project.authorityName || 'District Planning & Monitoring Cell'}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Implementation Commenced</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5">
              {formatDate(project.startDate)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Target Completion</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5">
              {formatDate(project.plannedCompletionDate)}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Financial Summary & Disbursal */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-indigo-700" />
              Financial Transparency & Disbursals
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative financial allocation, contract values, and verified public fund releases.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-600 self-start sm:self-auto">
            Audit-Verified
          </span>
        </div>

        {project.isFinancialIncomplete ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Financial information is incomplete in the available records.</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs text-slate-500 font-medium">Sanctioned Outlay</div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatCurrencyCr(project.sanctionedAmount)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Approved MPLAD budget</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs text-slate-500 font-medium">Awarded Contract Value</div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatCurrencyCr(project.awardedAmount)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Contractual award sum</div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="text-xs text-emerald-800 font-medium">Verified Public Disbursal</div>
                <div className="text-xl font-extrabold text-emerald-900 mt-1">
                  {formatCurrencyCr(project.verifiedExpenditure)}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  Statutory verified payout
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs text-slate-500 font-medium">Remaining Award Balance</div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatCurrencyCr(project.remainingAwardedBalance)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Pending milestone balance</div>
              </div>
            </div>

            {/* Financial Disbursal Progress Gauge */}
            {project.sanctionedAmount > 0 && (
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">
                    Public Fund Disbursal Progress (Verified Expenditure vs Sanctioned Budget)
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {project.accountabilityIndicators.financialUtilizationPercent}% Disbursed
                  </span>
                </div>
                <ProgressBar
                  value={project.accountabilityIndicators.financialUtilizationPercent}
                  size="md"
                  color="indigo"
                  showPercentage={false}
                />
                <div className="text-[11px] text-slate-500 pt-1">
                  Verified through statutory expenditure vouchers, verified contractor running bills, and municipal treasury releases.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: Physical Progress & Milestones */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-700" />
              Physical Progress & Ground Milestones
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified ground implementation milestones and contractor completion baselines.
            </p>
          </div>
          <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-auto">
            {project.physicalProgressPercent}% Overall Physical Progress
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Overall Physical Completion</span>
            <span className="text-slate-900">{project.physicalProgressPercent}%</span>
          </div>
          <ProgressBar
            value={project.physicalProgressPercent}
            size="md"
            color="emerald"
            showPercentage={false}
          />
        </div>

        {/* Itemized Milestones */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Itemized Milestone Breakdown ({project.milestones.length})
          </div>

          {project.milestones.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              No individual milestone stages recorded for this project.
            </div>
          ) : (
            <div className="space-y-3">
              {project.milestones.map((ms) => (
                <div
                  key={ms.sequence}
                  className="p-4 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-all space-y-2.5 bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {ms.sequence}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {ms.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Weight: {ms.weightPercent}%
                      </span>
                      <StatusBadge status={ms.status} size="sm" />
                    </div>
                  </div>

                  {ms.description && (
                    <p className="text-xs text-slate-600 pl-8.5">
                      {ms.description}
                    </p>
                  )}

                  <div className="pl-8.5 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Milestone Completion</span>
                      <span className="font-bold text-slate-700">{ms.progressPercent}%</span>
                    </div>
                    <ProgressBar
                      value={ms.progressPercent}
                      size="sm"
                      color="emerald"
                      showPercentage={false}
                    />
                  </div>

                  <div className="pl-8.5 pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>Planned Target: {formatDate(ms.plannedEndDate)}</span>
                    {ms.actualEndDate && (
                      <span className="text-emerald-700 font-medium">
                        Completed On: {formatDate(ms.actualEndDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Implementation Timeline */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#002B49]" />
            Project Implementation Lifecycle Timeline
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit of actual recorded lifecycle events from sanction to current status.
          </p>
        </div>

        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 space-y-6 py-2">
          {project.publicTimeline.map((ev, idx) => (
            <div key={ev.id || idx} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[31px] sm:-left-[39px] top-1 w-4 h-4 rounded-full border-2 border-white bg-[#002B49] shadow-xs" />

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {ev.title}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {ev.date}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {ev.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5: Public Progress Updates */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-700" />
            Public Field Progress Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Routine execution updates and physical status filings recorded by the implementing agency.
          </p>
        </div>

        {project.publicUpdates.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            No public progress updates have been filed for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {project.publicUpdates.map((upd, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200/90 space-y-2 bg-slate-50/50"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Progress Update — {formatDate(upd.date)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {upd.progressPercentage}% Reported Progress
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {upd.implementationStatus}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {upd.summary}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 6: Public Inspection Information */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-700" />
            Statutory Field Inspection Findings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Official on-site engineering verifications conducted by designated public works officers.
          </p>
        </div>

        {project.publicInspections.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            No official field inspections recorded for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {project.publicInspections.map((insp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200/90 space-y-2.5 bg-white"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      Site Verification on {formatDate(insp.inspectionDate)}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 self-start sm:self-auto">
                    {insp.observedProgress}% Observed Progress
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-800">Verification Status: </span>
                  {insp.qualityObservation}
                </div>

                {insp.publicDirective && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Public Works Directive: </span>
                    {insp.publicDirective}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 7: Public Accountability Indicators */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Public Accountability Indicators
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent factual indicators of project health, oversight frequency, and execution pacing.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400 text-[10px]">Last Monitored</div>
            <div className="font-bold text-slate-900 mt-1">
              {project.accountabilityIndicators.lastUpdated}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400 text-[10px]">Last Field Inspection</div>
            <div className="font-bold text-slate-900 mt-1">
              {project.accountabilityIndicators.lastInspectionDate}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400 text-[10px]">Completed Milestones</div>
            <div className="font-bold text-slate-900 mt-1">
              {project.accountabilityIndicators.milestonesCompletedCount} of {project.accountabilityIndicators.milestonesTotalCount}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400 text-[10px]">Disbursal Utilization</div>
            <div className="font-bold text-slate-900 mt-1">
              {project.accountabilityIndicators.financialUtilizationPercent}%
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400 text-[10px]">Physical Progress</div>
            <div className="font-bold text-slate-900 mt-1">
              {project.accountabilityIndicators.physicalProgressPercent}%
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400 text-[10px]">Monitored Status</div>
            <div className="font-bold text-slate-900 mt-1">
              {project.accountabilityIndicators.statusLabel}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/70 text-blue-950 text-xs flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-blue-900">Statutory Oversight Note:</span>
            <p className="text-blue-800 leading-relaxed">
              In accordance with Central Vigilance guidelines and administrative fairness standards, internal risk scoring matrices and vigilance anomaly indicators are strictly confined to authorized departmental reviewers and are not exposed in public records.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 8: Data Sources / Provenance & Disclaimer */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4 text-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">
            Data Sources & Provenance
          </h3>
          <p className="text-slate-500 mt-0.5">
            {project.dataProvenance.explanation}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="font-semibold text-slate-700">Official Record Categories:</div>
          <div className="flex flex-wrap gap-2">
            {project.dataProvenance.sourceCategories.map((cat, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Disclaimer: </strong>
          {project.dataProvenance.disclaimer}
        </div>
      </div>
    </div>
  );
};

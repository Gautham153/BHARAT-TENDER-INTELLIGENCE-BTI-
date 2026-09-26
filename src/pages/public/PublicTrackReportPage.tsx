import React, { useState, useEffect } from 'react';
import {
  Search,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Building2,
  ExternalLink,
  Info,
  ChevronRight,
} from 'lucide-react';
import { CitizenReportService } from '../../services/citizen/citizenReportService';
import { PublicCitizenReportStatusDTO } from '../../types/citizenReport';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export interface PublicTrackReportPageProps {
  onNavigate: (path: string) => void;
  initialReportId?: string;
}

export const PublicTrackReportPage: React.FC<PublicTrackReportPageProps> = ({
  onNavigate,
  initialReportId = '',
}) => {
  const [reportIdInput, setReportIdInput] = useState(initialReportId);
  const [report, setReport] = useState<PublicCitizenReportStatusDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performLookup = async (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await CitizenReportService.trackReportPublic(cleanId);
      if (data) {
        setReport(data);
      } else {
        setReport(null);
      }
    } catch (err: any) {
      console.error('Public track report lookup error:', err);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialReportId) {
      setReportIdInput(initialReportId);
      performLookup(initialReportId);
    } else {
      const params = new URLSearchParams(window.location.search);
      const qId = params.get('id');
      if (qId) {
        setReportIdInput(qId);
        performLookup(qId);
      }
    }
  }, [initialReportId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reportIdInput.trim()) {
      performLookup(reportIdInput.trim());
    }
  };

  const getStepProgress = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 1;
      case 'UNDER_REVIEW':
        return 2;
      case 'VERIFICATION_REQUIRED':
      case 'VERIFIED':
      case 'VERIFIED_DISCREPANCY':
      case 'ACTIONED':
        return 3;
      case 'CLOSED':
      case 'NOT_SUBSTANTIATED':
      case 'DISMISSED':
      case 'INCONCLUSIVE':
      case 'DUPLICATE_OR_INVALID':
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Subtle Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <button
          onClick={() => onNavigate('/transparency')}
          className="hover:text-[#002B49] font-medium transition-colors cursor-pointer"
        >
          Transparency
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-semibold">Track a Report</span>
      </nav>

      {/* Hero Section — Exact match to TransparencyLandingPage.tsx */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#002B49] to-[#001c30] text-white p-8 sm:p-12 shadow-xl border border-slate-800">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-xs font-semibold tracking-wide text-amber-300 uppercase">
            <Shield className="w-3.5 h-3.5" />
            Citizen Social Audit Tracking
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Track Your Observation Report
          </h1>

          <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
            Enter your official Citizen Project Report tracking number (e.g.,{' '}
            <span className="text-amber-300 font-mono font-semibold">CPR-2026-XXXXXX</span>) to check the public-safe status of your submitted social audit observation.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="public-track-report-input"
                type="text"
                value={reportIdInput}
                onChange={(e) => setReportIdInput(e.target.value)}
                placeholder="Enter Report ID (e.g. CPR-2026-849201)..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-md uppercase font-mono"
              />
            </div>
            <Button
              id="public-track-report-submit-btn"
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading || !reportIdInput.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 shadow-md cursor-pointer shrink-0"
            >
              {isLoading ? 'Checking...' : 'Track Status'}
            </Button>
          </form>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-12 text-center bg-white border border-slate-200/90 shadow-xs space-y-3">
          <div className="inline-block w-8 h-8 border-3 border-slate-300 border-t-[#002B49] rounded-full animate-spin" />
          <div className="text-sm font-semibold text-slate-700">
            Querying official BTI citizen report registry...
          </div>
          <p className="text-xs text-slate-400">Verifying tracking credentials against authenticated records</p>
        </Card>
      )}

      {/* Report Found View */}
      {!isLoading && report && (
        <Card className="p-6 sm:p-8 bg-white border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tracking Identifier
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900">
                {report.reportId}
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${report.statusColorClass}`}>
                {report.statusLabel}
              </span>
              {report.isDemonstrationData && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Demonstration Record
                </span>
              )}
            </div>
          </div>

          {/* Lifecycle Stepper */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Administrative Processing Stage
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[
                { step: 1, label: 'Logged' },
                { step: 2, label: 'Triage' },
                { step: 3, label: 'Verified' },
                { step: 4, label: 'Concluded' },
              ].map((s) => {
                const currentStep = getStepProgress(report.status);
                const isDone = currentStep >= s.step;
                const isCurrent = currentStep === s.step;
                return (
                  <div key={s.step} className="space-y-1 text-center">
                    <div
                      className={`h-2 rounded-full transition-colors ${
                        isDone
                          ? isCurrent
                            ? 'bg-[#002B49]'
                            : 'bg-emerald-500'
                          : 'bg-slate-200'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-semibold block truncate ${
                        isDone ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Explanation Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Info className="w-4 h-4 text-[#002B49] shrink-0" />
              <span>Current Status Summary</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              {report.statusDescription}
            </p>
          </div>

          {/* Project & Timeline Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">
                Monitored Project
              </span>
              <div className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                {report.projectTitle}
              </div>
              {report.locationSnapshot && (
                <div className="text-[11px] text-slate-500">
                  Location: {report.locationSnapshot}
                </div>
              )}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate(`/transparency/projects/${report.projectId}`)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#002B49] hover:underline cursor-pointer"
                >
                  View Public Project Record <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">
                Timeline & Classification
              </span>
              <div className="space-y-1.5 text-slate-700 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Observation Type:</span>
                  <span className="font-semibold text-slate-800">{report.natureOfAnomalyLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Submitted On:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(report.submittedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Last Status Update:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(report.updatedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy & Confidentiality Safeguard */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Privacy & Institutional Integrity Protection: </span>
              Reporter personal identity, inspecting officer credentials, internal investigation notes, mathematical risk algorithms, and statutory work papers are strictly withheld from public endpoints in accordance with BTI security guidelines.
            </div>
          </div>
        </Card>
      )}

      {/* Not Found View */}
      {!isLoading && hasSearched && !report && (
        <Card className="p-10 text-center bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Report Record Unavailable</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              No public report matches the identifier <code className="font-mono font-bold text-slate-800">{reportIdInput}</code>. Please confirm the tracking number provided upon submission (format: CPR-YYYY-XXXXXX).
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReportIdInput('CPR-2026-849201');
                performLookup('CPR-2026-849201');
              }}
              className="text-xs"
            >
              Try Demo Report (CPR-2026-849201)
            </Button>
            <Button
              variant="gov"
              size="sm"
              onClick={() => onNavigate('/transparency/projects')}
              className="text-xs bg-[#002B49] text-white"
            >
              Browse Public Projects
            </Button>
          </div>
        </Card>
      )}

      {/* Supporting Cards — matching Transparency landing page cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#002B49]">
            <FileText className="w-4 h-4 text-[#002B49]" />
            How Social Audit Reports Are Processed
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Observations filed by citizens are received into the Government Review Desk, cross-referenced with satellite and milestone data, and assigned for physical verification by competent district monitoring engineers.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#002B49]">
            <Shield className="w-4 h-4 text-[#002B49]" />
            Report New Observation
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Notice a delay, substandard work, or discrepancy on a public project in your area? Locate the work in the public directory and click &ldquo;File Citizen Observation&rdquo; to submit an observation.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/transparency/projects')}
            className="text-xs font-bold text-[#002B49] hover:underline pt-1 inline-block cursor-pointer"
          >
            Explore Monitored Works &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

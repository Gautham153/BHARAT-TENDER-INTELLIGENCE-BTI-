// Bharat Tender Intelligence (BTI) — Citizen Reports & Social Audit Desk
// Phase 10: Citizen Grievance & Participatory Social Audit Verification Desk

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flag,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Eye,
  FileText,
  Building2,
  MapPin,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  User,
  X,
  Layers,
  FolderKanban,
  FileCheck2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  CitizenProjectReport,
  CitizenReportStatus,
  CitizenReportNature,
  CitizenReportMedia,
  CITIZEN_REPORT_STATUS_LABELS,
  CITIZEN_REPORT_NATURE_LABELS,
} from '../../types/citizenReport';
import { CitizenReportService } from '../../services/citizen/citizenReportService';
import { Project, ProjectExceptionSeverity } from '../../types/project';
import { ProjectService } from '../../services/firebase/projects';
import { auth } from '../../services/firebase/firebase';

interface CitizenReportsDeskPageProps {
  onNavigate: (path: string) => void;
  initialReportId?: string;
}

export const CitizenReportsDeskPage: React.FC<CitizenReportsDeskPageProps> = ({
  onNavigate,
  initialReportId,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [reports, setReports] = useState<CitizenProjectReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<CitizenProjectReport | null>(null);

  // Filters (Preserved across navigation)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [natureFilter, setNatureFilter] = useState<string>('ALL');

  // Verification Form State
  const [newStatus, setNewStatus] = useState<CitizenReportStatus>('UNDER_REVIEW');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [createMonitoringException, setCreateMonitoringException] = useState(true);
  const [exceptionSeverity, setExceptionSeverity] = useState<ProjectExceptionSeverity>('HIGH');
  const [linkEvidenceGraph, setLinkEvidenceGraph] = useState(true);

  // AI Comparison Advisory State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvisory, setAiAdvisory] = useState<any | null>(null);

  // Authoritative Project Ground Truth State
  const [authoritativeProject, setAuthoritativeProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(false);

  // Fullscreen Image Lightbox Modal State
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    name: string;
    caption?: string;
    uploadedAt?: string;
    size?: number;
  } | null>(null);

  // Resolve visual evidence image URL with realistic SVG site snapshot fallback
  const resolveMediaUrl = useCallback((m: CitizenReportMedia): string => {
    if (m.dataUrl) return m.dataUrl;
    if ((m as any).previewUrl) return (m as any).previewUrl;
    if (m.storagePath) return m.storagePath;

    const fileName = m.name || 'field_visual_evidence.jpg';
    const caption = m.caption || 'Citizen social audit observation evidence recorded at project location.';
    const recordedAt = m.uploadedAt ? new Date(m.uploadedAt).toLocaleString('en-IN') : '2026-03-01 10:30 IST';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#skyGrad)"/>
      <rect y="260" width="800" height="240" fill="url(#groundGrad)"/>
      <path d="M 30 260 L 140 140 L 260 260 Z" fill="#475569" opacity="0.5"/>
      <path d="M 180 260 L 330 110 L 480 260 Z" fill="#64748b" opacity="0.4"/>
      <path d="M 420 260 L 560 150 L 700 260 Z" fill="#475569" opacity="0.5"/>
      <rect x="220" y="170" width="28" height="100" fill="#94a3b8"/>
      <rect x="340" y="150" width="28" height="120" fill="#cbd5e1"/>
      <rect x="460" y="170" width="28" height="100" fill="#94a3b8"/>
      <line x1="190" y1="170" x2="520" y2="170" stroke="#f59e0b" stroke-width="6"/>
      <line x1="190" y1="210" x2="520" y2="210" stroke="#e2e8f0" stroke-width="3" stroke-dasharray="8 8"/>
      
      <rect x="24" y="24" width="400" height="74" rx="8" fill="#000000" opacity="0.8"/>
      <text x="40" y="48" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold">CITIZEN FIELD OBSERVATION EVIDENCE</text>
      <text x="40" y="68" fill="#cbd5e1" font-family="system-ui, -apple-system, sans-serif" font-size="11">FILE: ${fileName}</text>
      <text x="40" y="84" fill="#94a3b8" font-family="monospace" font-size="10">RECORDED: ${recordedAt}</text>

      <rect x="0" y="425" width="800" height="75" fill="#000000" opacity="0.88"/>
      <text x="24" y="454" fill="#fef08a" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold">OBSERVATION CAPTION:</text>
      <text x="180" y="454" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="12">${caption.length > 70 ? caption.substring(0, 67) + '...' : caption}</text>
      <text x="24" y="480" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="11">Bharat Tender Intelligence • Citizen Social Audit Attachment • Unmodified Visual Lead</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, []);

  // Keyboard Escape listener for image modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewMedia(null);
      }
    };
    if (previewMedia) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [previewMedia]);

  // Load authoritative project ground truth whenever selected report changes
  useEffect(() => {
    let isMounted = true;
    if (!selectedReport?.projectId) {
      setAuthoritativeProject(null);
      return;
    }

    setIsLoadingProject(true);
    ProjectService.getProjectById(selectedReport.projectId)
      .then((proj) => {
        if (isMounted) {
          setAuthoritativeProject(proj);
          setIsLoadingProject(false);
        }
      })
      .catch((err) => {
        console.warn('[CitizenReportsDeskPage] Failed to load authoritative project:', err);
        if (isMounted) {
          setIsLoadingProject(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedReport?.projectId]);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await CitizenReportService.getAllReports();
      setReports(data);
      if (initialReportId) {
        const found = data.find((r) => r.reportId === initialReportId);
        if (found) setSelectedReport(found);
      } else if (selectedReport) {
        const refreshed = data.find((r) => r.reportId === selectedReport.reportId);
        if (refreshed) setSelectedReport(refreshed);
      }
    } catch (err: any) {
      console.error('Failed to load citizen reports:', err);
      showToast('Failed to load citizen reports: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [initialReportId, selectedReport, showToast]);

  useEffect(() => {
    loadReports();
  }, []);

  // Sync with initialReportId prop if deep-linked or browser history changes
  useEffect(() => {
    if (initialReportId && reports.length > 0) {
      const found = reports.find((r) => r.reportId === initialReportId);
      if (found) {
        setSelectedReport(found);
      }
    } else if (!initialReportId && selectedReport && !window.location.pathname.includes('/government/citizen-reports/')) {
      setSelectedReport(null);
    }
  }, [initialReportId, reports]);

  // Sync verification form when selected report changes
  useEffect(() => {
    if (selectedReport) {
      setNewStatus(selectedReport.status === 'SUBMITTED' ? 'UNDER_REVIEW' : selectedReport.status);
      setReviewNotes(selectedReport.reviewNotes || '');
      setAiAdvisory(selectedReport.aiAdvisory || null);
    }
  }, [selectedReport]);

  const handleOpenReport = (report: CitizenProjectReport) => {
    setSelectedReport(report);
    onNavigate(`/government/citizen-reports/${report.reportId}`);
  };

  const handleBackToQueue = () => {
    setSelectedReport(null);
    onNavigate('/government/citizen-reports');
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (natureFilter !== 'ALL' && r.natureOfAnomaly !== natureFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = r.reportId.toLowerCase().includes(q);
        const matchesProject = (r.projectNameSnapshot || (r as any).projectTitle || '').toLowerCase().includes(q);
        const matchesConst = (r.constituencySnapshot || (r as any).constituency || '').toLowerCase().includes(q);
        const matchesEvidence = r.specificEvidence.toLowerCase().includes(q);
        const matchesLocation = (r.locationDetails || '').toLowerCase().includes(q);
        if (!matchesId && !matchesProject && !matchesConst && !matchesEvidence && !matchesLocation) {
          return false;
        }
      }
      return true;
    });
  }, [reports, statusFilter, natureFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length;
    const verified = reports.filter(
      (r) => r.status === 'VERIFIED_DISCREPANCY' || (r.status as any) === 'VERIFIED'
    ).length;
    const closed = reports.filter(
      (r) =>
        r.status === 'NOT_SUBSTANTIATED' ||
        r.status === 'INCONCLUSIVE' ||
        r.status === 'DUPLICATE_OR_INVALID' ||
        r.status === 'DISMISSED' ||
        r.status === 'CLOSED'
    ).length;
    return { total, pending, verified, closed };
  }, [reports]);

  // Handle AI Advisory Comparison Generation
  const handleGenerateAiAdvisory = async () => {
    if (!selectedReport) return;
    setIsAiLoading(true);
    try {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : undefined;
      const advisory = await CitizenReportService.getCitizenReportAdvisory(
        selectedReport,
        token
      );
      setAiAdvisory(advisory);
      showToast('AI Institutional Comparison Advisory generated successfully.', 'success');
    } catch (err: any) {
      console.error('Error generating AI comparison:', err);
      showToast('Failed to generate AI comparison: ' + err.message, 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle Decision Submission (One Authoritative Government Verification Workflow)
  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    if (!reviewNotes.trim()) {
      showToast('Official review notes and rationale are required before committing a decision.', 'warning');
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const updated = await CitizenReportService.recordVerificationDecision(
        selectedReport.reportId,
        {
          status: newStatus,
          verificationDecision: newStatus === 'VERIFIED_DISCREPANCY' ? 'VERIFIED' : newStatus,
          verificationNotes: reviewNotes,
          createProjectException: newStatus === 'VERIFIED_DISCREPANCY' && createMonitoringException,
          exceptionSeverity,
        },
        user || { id: 'gov-officer', name: 'Authorized Monitoring Officer', role: 'government' }
      );

      setSelectedReport(updated);
      await loadReports();
      showToast(
        `Decision recorded: Marked as "${CITIZEN_REPORT_STATUS_LABELS[newStatus]?.label || newStatus}".${
          updated.linkedExceptionId ? ' Official monitoring exception logged.' : ''
        }`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to commit decision:', err);
      showToast('Failed to commit decision: ' + err.message, 'error');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // ==========================================
  // VIEW 2: FULL-PAGE REPORT DETAIL WORKSPACE
  // ==========================================
  if (selectedReport) {
    const statusCfg = CITIZEN_REPORT_STATUS_LABELS[selectedReport.status] || {
      label: selectedReport.status,
      colorClass: 'bg-slate-100 text-slate-700 border-slate-300',
    };
    const natureCfg = CITIZEN_REPORT_NATURE_LABELS[selectedReport.natureOfAnomaly] || {
      label: selectedReport.natureOfAnomaly,
      description: '',
    };

    return (
      <div id="citizen-report-detail-view" className="space-y-6 pb-16 max-w-6xl mx-auto">
        {/* Top Back Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              id="back-to-citizen-reports-btn"
              type="button"
              onClick={handleBackToQueue}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>← Back to Citizen Reports</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span>/</span>
              <span className="font-mono font-medium text-slate-600">{selectedReport.reportId}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate(`/transparency/projects/${selectedReport.projectId}`)}
              icon={ExternalLink}
              className="text-xs"
              title="View public transparency disclosure"
            >
              Public View
            </Button>
            <Button
              variant="gov"
              size="sm"
              onClick={() => onNavigate('/government/projects')}
              icon={FolderKanban}
              className="text-xs bg-[#002B49] text-white"
            >
              Project Monitoring
            </Button>
          </div>
        </div>

        {/* Detail Workspace Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Header & Identification */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded">
                  {selectedReport.reportId}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.colorClass}`}>
                  {statusCfg.label}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  {natureCfg.label}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {selectedReport.projectNameSnapshot || (selectedReport as any).projectTitle || 'Project ' + selectedReport.projectId}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {selectedReport.constituencySnapshot || (selectedReport as any).constituency || 'Constituency not specified'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Submitted: {new Date(selectedReport.submittedAt).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Authoritative Project Master Comparison Snapshot */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-700" />
                  AUTHORITATIVE PROJECT GROUND TRUTH
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Official project records maintained in BTI Project Monitoring registry (not client-reported snapshots).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {authoritativeProject?.projectNumber || authoritativeProject?.projectCode || selectedReport.projectId}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('/government/projects')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
                >
                  Open in Project Monitoring <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {isLoadingProject ? (
              <div className="py-4 text-center text-xs text-slate-500">
                <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mr-2 align-middle" />
                Resolving authoritative project ground truth...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Official Status</span>
                  <div className="font-bold text-slate-900">
                    {authoritativeProject?.status || selectedReport.projectSnapshot?.status || 'IN_PROGRESS'}
                  </div>
                  <div className="text-[10px] text-slate-500">Government Verified</div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Physical Progress</span>
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>
                      {authoritativeProject?.governmentVerifiedPhysicalProgressPercent ??
                        authoritativeProject?.agencyReportedPhysicalProgressPercent ??
                        authoritativeProject?.physicalProgressPercent ??
                        authoritativeProject?.physicalProgress ??
                        selectedReport.projectSnapshot?.physicalProgressPercent ??
                        0}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            authoritativeProject?.governmentVerifiedPhysicalProgressPercent ??
                              authoritativeProject?.agencyReportedPhysicalProgressPercent ??
                              authoritativeProject?.physicalProgressPercent ??
                              authoritativeProject?.physicalProgress ??
                              selectedReport.projectSnapshot?.physicalProgressPercent ??
                              0
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Sanctioned Outlay</span>
                  <div className="font-bold text-slate-900">
                    {(() => {
                      const amt = authoritativeProject?.sanctionedAmount ?? authoritativeProject?.sanctionedBudget ?? selectedReport.projectSnapshot?.sanctionedAmount ?? 0;
                      if (amt >= 10000000) return `₹ ${(amt / 10000000).toFixed(2)} Cr`;
                      if (amt >= 100000) return `₹ ${(amt / 100000).toFixed(1)} L`;
                      return `₹ ${amt.toLocaleString('en-IN')}`;
                    })()}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Awarded: {authoritativeProject?.awardedAmount ? `₹ ${(authoritativeProject.awardedAmount / 10000000).toFixed(2)} Cr` : 'Pending'}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Implementing Agency</span>
                  <div
                    className="font-bold text-slate-900 truncate"
                    title={authoritativeProject?.implementingAgencyName || authoritativeProject?.executingAgencyName || authoritativeProject?.agencyName || selectedReport.projectSnapshot?.implementingAgency}
                  >
                    {authoritativeProject?.implementingAgencyName ||
                      authoritativeProject?.executingAgencyName ||
                      authoritativeProject?.agencyName ||
                      selectedReport.projectSnapshot?.implementingAgency ||
                      'Designated Public Agency'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate" title={authoritativeProject?.constituency || selectedReport.constituencySnapshot}>
                    {authoritativeProject?.district ? `${authoritativeProject.district}, ${authoritativeProject.state}` : selectedReport.projectLocationSnapshot || 'Varanasi, UP'}
                  </div>
                </div>
              </div>
            )}

            {/* Official Baseline Dates Row */}
            {authoritativeProject && (
              <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    <strong className="text-slate-700">Official Commencement:</strong>{' '}
                    {authoritativeProject.startDate
                      ? new Date(authoritativeProject.startDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Recorded at project award'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    <strong className="text-slate-700">Official Target Completion:</strong>{' '}
                    {authoritativeProject.plannedCompletionDate || authoritativeProject.targetCompletionDate
                      ? new Date(authoritativeProject.plannedCompletionDate || authoritativeProject.targetCompletionDate!).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Date not available in the current record.'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Citizen Observation & Specific Evidence */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                CITIZEN OBSERVATION STATEMENT
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                {natureCfg.label}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed space-y-2">
              <p className="whitespace-pre-wrap font-medium">{selectedReport.specificEvidence}</p>
              {selectedReport.locationDetails && (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    <strong>Specific Site Landmark:</strong> {selectedReport.locationDetails}
                  </span>
                </div>
              )}
            </div>

            {/* Photo Attachments */}
            {selectedReport.media && selectedReport.media.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Citizen Uploaded Visual Evidence ({selectedReport.media.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selectedReport.media.map((m) => {
                    const mediaDisplayUrl = resolveMediaUrl(m);
                    return (
                      <div
                        key={m.mediaId}
                        onClick={() => {
                          setPreviewMedia({
                            url: mediaDisplayUrl,
                            name: m.name || 'visual_evidence.jpg',
                            caption: m.caption,
                            uploadedAt: m.uploadedAt,
                            size: m.size,
                          });
                        }}
                        className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-100 aspect-video cursor-pointer hover:border-indigo-600 transition-colors shadow-2xs"
                      >
                        <img
                          src={mediaDisplayUrl}
                          alt={m.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
                          <Eye className="w-4 h-4 text-white" />
                          <span>Click to Enlarge</span>
                        </div>
                        <span className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 bg-black/75 text-white text-[9px] truncate rounded">
                          {m.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reporter Confidentiality Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900">Reporter Identity Status: </span>
                  {selectedReport.reporterMode === 'ANONYMOUS' ? (
                    <span className="text-slate-600">Anonymous (Identity not recorded)</span>
                  ) : (
                    <span className="text-slate-800">
                      Identified Citizen: <strong>{selectedReport.reporterName}</strong> ({selectedReport.reporterMobile})
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 italic">Protected from public view</span>
            </div>
          </div>

          {/* AI Comparison & Decision Support Advisor */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                  Institutional Grounded Comparator (AI Advisory)
                </span>
              </div>
              <Button
                id="run-ai-comparison-btn"
                variant="outline"
                size="sm"
                onClick={handleGenerateAiAdvisory}
                disabled={isAiLoading}
                icon={Sparkles}
                className="text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-2xs"
              >
                {isAiLoading ? 'Analyzing Baseline...' : aiAdvisory ? 'Refresh Analysis' : 'Run Comparator'}
              </Button>
            </div>

            {aiAdvisory ? (
              <div className="space-y-3 text-xs pt-1">
                <div className="p-3.5 bg-white rounded-lg border border-indigo-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Baseline Alignment Assessment</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        aiAdvisory.evidenceConsistency === 'CONSISTENT'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : aiAdvisory.evidenceConsistency === 'INCONCLUSIVE'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {aiAdvisory.evidenceConsistency}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{aiAdvisory.advisorySummary}</p>
                </div>

                {/* Recommended Verification Tasks */}
                {aiAdvisory.recommendedVerificationAreas && aiAdvisory.recommendedVerificationAreas.length > 0 && (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800 text-[11px]">
                      Recommended Technical Verification Areas:
                    </div>
                    <ul className="space-y-1">
                      {aiAdvisory.recommendedVerificationAreas.map((area: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                          <span className="text-indigo-600 font-bold">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 italic pt-1 border-t border-indigo-100/60">
                  <strong>Institutional Notice:</strong> {aiAdvisory.limitations}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Run the institutional comparator to objectively cross-reference this observation against recorded milestone logs, certified contractor claims, and field inspection history.
              </p>
            )}
          </div>

          {/* Official Government Triage & Decision Action Form */}
          <form onSubmit={handleSubmitDecision} className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <FileCheck2 className="w-4 h-4 text-slate-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Authoritative Verification & Triage Action
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verification Disposition <span className="text-rose-600">*</span>
                </label>
                <select
                  id="citizen-report-disposition-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CitizenReportStatus)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white font-medium text-slate-900 outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="UNDER_REVIEW">UNDER REVIEW — Assigning for Field Check</option>
                  <option value="VERIFIED_DISCREPANCY">VERIFIED DISCREPANCY — Irregularity Substantiated</option>
                  <option value="NOT_SUBSTANTIATED">NOT SUBSTANTIATED — Work Aligns with Records</option>
                  <option value="INCONCLUSIVE">INCONCLUSIVE — Evidence Insufficient</option>
                  <option value="DUPLICATE_OR_INVALID">DUPLICATE / INVALID — Redundant Filing</option>
                </select>
              </div>

              {newStatus === 'VERIFIED_DISCREPANCY' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Exception Severity Level
                  </label>
                  <select
                    id="citizen-report-severity-select"
                    value={exceptionSeverity}
                    onChange={(e) => setExceptionSeverity(e.target.value as ProjectExceptionSeverity)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white font-medium text-slate-900 outline-none focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="CRITICAL">Critical (Immediate Halt / High Urgency)</option>
                    <option value="HIGH">High (Major Divergence / Financial Risk)</option>
                    <option value="MEDIUM">Medium (Moderate Milestone Delay)</option>
                    <option value="LOW">Low (Minor Rectification Item)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Conditional Exception & Evidence Chain Checkboxes */}
            {newStatus === 'VERIFIED_DISCREPANCY' && (
              <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMonitoringException}
                    onChange={(e) => setCreateMonitoringException(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-rose-950">
                    Log official Project Monitoring Exception in Project Engine
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkEvidenceGraph}
                    onChange={(e) => setLinkEvidenceGraph(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-rose-900">
                    Register observation in Evidence Chain Graph (EvidenceChainService)
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Review Notes & Verification Rationale <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="citizen-report-review-notes"
                required
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document the specific verification rationale, officer inquiries made, field engineer deployment details, or reasons for closure."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-600 leading-relaxed"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div className="text-[11px] text-slate-500">
                Changes are stamped with your official credentials and written to immutable system audit logs.
              </div>
              <Button
                id="citizen-report-commit-decision-btn"
                type="submit"
                disabled={isSubmittingDecision}
                variant="gov"
                size="sm"
                className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold shrink-0"
              >
                {isSubmittingDecision ? 'Committing...' : 'Commit Verification Decision'}
              </Button>
            </div>
          </form>

          {/* Immutable Audit Log History */}
          {selectedReport.auditHistory && selectedReport.auditHistory.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Administrative Action Log
              </div>
              <div className="space-y-1.5">
                {selectedReport.auditHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-slate-900">
                        {item.action} — by {item.performedByName}
                      </span>
                      {item.notes && <p className="text-[11px] text-slate-600">{item.notes}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(item.timestamp).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen Citizen Visual Evidence Lightbox Modal */}
        {previewMedia && (
          <div
            id="citizen-evidence-lightbox-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewMedia(null);
            }}
          >
            <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
              {/* Lightbox Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{previewMedia.name}</span>
                      {previewMedia.size ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {(previewMedia.size / 1024).toFixed(1)} KB
                        </span>
                      ) : null}
                    </div>
                    {previewMedia.uploadedAt && (
                      <div className="text-[11px] text-slate-400">
                        Attachment Timestamp: {new Date(previewMedia.uploadedAt).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewMedia(null)}
                  className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close image viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lightbox Image Container */}
              <div className="relative flex items-center justify-center p-4 sm:p-6 bg-black/60 min-h-[320px] max-h-[68vh] overflow-hidden">
                <img
                  src={previewMedia.url}
                  alt={previewMedia.name}
                  className="max-w-full max-h-[64vh] object-contain rounded-lg shadow-xl select-none"
                />
              </div>

              {/* Lightbox Footer & Caption */}
              <div className="px-5 py-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="text-slate-300">
                  <span className="font-semibold text-amber-400">Caption: </span>
                  <span>{previewMedia.caption || 'Citizen observation visual evidence lead.'}</span>
                </div>
                <div className="text-[11px] text-slate-500 italic shrink-0">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Esc</kbd> or click outside to close
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 1: CITIZEN REPORT QUEUE (FULL WIDTH)
  // ==========================================
  return (
    <div id="citizen-reports-desk-container" className="space-y-6 pb-16">
      {/* Page Header */}
      <PageHeader
        title="Citizen Social Audit & Grievance Desk"
        description="Participatory monitoring observations filed by citizens on public MPLAD projects. Triaged and officially verified by district nodal officers."
        icon={Flag}
      >
        <div className="flex items-center gap-2">
          <Button
            id="refresh-citizen-desk-btn"
            variant="outline"
            size="sm"
            onClick={loadReports}
            icon={RefreshCw}
            disabled={isLoading}
            className="text-xs"
          >
            Refresh
          </Button>
          <Button
            variant="gov"
            size="sm"
            onClick={() => onNavigate('/government/projects')}
            icon={FolderKanban}
            className="text-xs bg-[#002B49] text-white"
          >
            Project Monitoring
          </Button>
        </div>
      </PageHeader>

      {/* Institutional Governance Notice */}
      <div className="p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 flex items-start justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white text-sm">
              Participatory Social Audit Governance Standard
            </div>
            <p className="text-slate-300 leading-relaxed max-w-4xl">
              Citizen reports represent factual observational leads from members of the public. Under Central Vigilance
              guidelines, an unverified citizen observation does not establish wrongdoing or alter official project
              milestone status until an authorized engineer conducts physical ground verification.
            </p>
          </div>
        </div>
        <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] shrink-0">
          MPLAD GUIDELINES • §38 SOCIAL AUDIT
        </span>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reports</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Recorded observations</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Triage Required</div>
          <div className="text-2xl font-black text-amber-900 mt-1">{stats.pending}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Submitted / Under Review</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Verified Discrepancies</div>
          <div className="text-2xl font-black text-rose-900 mt-1">{stats.verified}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">Converted to Exceptions</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Closed / Substantiated</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.closed}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Resolved or Inconclusive</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="citizen-reports-search-input"
              type="text"
              placeholder="Search reports by ID, project title, constituency, or claim..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              id="citizen-reports-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none focus:border-indigo-600 font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="VERIFIED_DISCREPANCY">Verified Discrepancy</option>
              <option value="NOT_SUBSTANTIATED">Not Substantiated</option>
              <option value="INCONCLUSIVE">Inconclusive</option>
              <option value="DUPLICATE_OR_INVALID">Duplicate / Invalid</option>
            </select>

            <select
              id="citizen-reports-nature-filter"
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none focus:border-indigo-600 font-medium text-slate-700"
            >
              <option value="ALL">All Categories</option>
              {Object.keys(CITIZEN_REPORT_NATURE_LABELS).map((key) => (
                <option key={key} value={key}>
                  {CITIZEN_REPORT_NATURE_LABELS[key as CitizenReportNature].label}
                </option>
              ))}
            </select>

            {(searchQuery || statusFilter !== 'ALL' || natureFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setNatureFilter('ALL');
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Full-Width Report Queue List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
          <span>
            Citizen Filing Queue ({filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'})
          </span>
          <span>Click any report to open full inspection workspace</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
            <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-2" />
            <p>Loading citizen observation registry...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs space-y-2">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700 text-sm">No reports match filter criteria</div>
            <p className="text-slate-400 max-w-sm mx-auto">
              No observations were found matching the selected query or status filters. Try clearing your filters or search query.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const statusCfg = CITIZEN_REPORT_STATUS_LABELS[report.status] || {
                label: report.status,
                colorClass: 'bg-slate-100 text-slate-700 border-slate-300',
              };
              const natureCfg = CITIZEN_REPORT_NATURE_LABELS[report.natureOfAnomaly] || {
                label: report.natureOfAnomaly,
                description: '',
              };

              return (
                <div
                  key={report.reportId}
                  id={`citizen-report-card-${report.reportId}`}
                  onClick={() => handleOpenReport(report)}
                  className="p-5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer space-y-3 group"
                >
                  {/* Card Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded">
                        {report.reportId}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                        {natureCfg.label}
                      </span>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.colorClass}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(report.submittedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        <Shield className="w-3 h-3 text-slate-400" />
                        {report.reporterMode === 'ANONYMOUS' ? 'Anonymous Filing' : 'Identified Citizen'}
                      </span>
                    </div>
                  </div>

                  {/* Project and Location details */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                      {report.projectNameSnapshot || (report as any).projectTitle || 'Project ' + report.projectId}
                    </h3>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{report.constituencySnapshot || (report as any).constituency || 'Constituency not recorded'}</span>
                      </span>
                      {report.locationDetails && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{report.locationDetails}</span>
                          </span>
                        </>
                      )}
                      {report.projectSnapshot?.implementingAgency && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400">
                            Agency: <strong className="text-slate-600 font-medium">{report.projectSnapshot.implementingAgency}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Evidence Observation Snippet */}
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 line-clamp-2 leading-relaxed border border-slate-100">
                    <span className="font-semibold text-slate-900">Reported Observation: </span>
                    {report.specificEvidence}
                  </div>

                  {/* Card Footer Bar */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      {report.media && report.media.length > 0 ? (
                        <span className="flex items-center gap-1 text-slate-700 font-medium text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                          {report.media.length} visual attachment(s)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">No photos attached</span>
                      )}

                      {report.linkedExceptionId && (
                        <span className="text-[11px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          Exception Logged ({report.linkedExceptionId})
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                      <span>Inspect & Verify</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Citizen Visual Evidence Lightbox Modal */}
      {previewMedia && (
        <div
          id="citizen-evidence-lightbox-modal-queue"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewMedia(null);
          }}
        >
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
            {/* Lightbox Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{previewMedia.name}</span>
                    {previewMedia.size ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {(previewMedia.size / 1024).toFixed(1)} KB
                      </span>
                    ) : null}
                  </div>
                  {previewMedia.uploadedAt && (
                    <div className="text-[11px] text-slate-400">
                      Attachment Timestamp: {new Date(previewMedia.uploadedAt).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Close image viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lightbox Image Container */}
            <div className="relative flex items-center justify-center p-4 sm:p-6 bg-black/60 min-h-[320px] max-h-[68vh] overflow-hidden">
              <img
                src={previewMedia.url}
                alt={previewMedia.name}
                className="max-w-full max-h-[64vh] object-contain rounded-lg shadow-xl select-none"
              />
            </div>

            {/* Lightbox Footer & Caption */}
            <div className="px-5 py-3.5 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="text-slate-300">
                <span className="font-semibold text-amber-400">Caption: </span>
                <span>{previewMedia.caption || 'Citizen observation visual evidence lead.'}</span>
              </div>
              <div className="text-[11px] text-slate-500 italic shrink-0">
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Esc</kbd> or click outside to close
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

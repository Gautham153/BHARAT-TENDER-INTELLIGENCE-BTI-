// Bharat Tender Intelligence (BTI) — Government Risk Alerts & Anomaly Triage Desk
// Phase 7: Real-Time Deterministic Anomaly Triage & Investigation Console

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Search,
  CheckCircle2,
  Eye,
  RefreshCw,
  Clock,
  FileCheck2,
  Building2,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Drawer } from '../../components/ui/Drawer';
import { StatCard } from '../../components/ui/StatCard';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { AnomalyDetectionService } from '../../services/anomaly/anomalyDetectionService';
import { ProjectService } from '../../services/firebase/projects';
import {
  ProjectAnomaly,
  AnomalySeverity,
  AnomalyStatus,
  ANOMALY_TYPE_LABELS,
  SEVERITY_COLORS,
  STATUS_COLORS,
  VALID_ANOMALY_STATUS_TRANSITIONS,
  isValidAnomalyTransition,
} from '../../types/anomaly';
import { Project } from '../../types/project';
import { DEMONSTRATION_PROJECTS } from '../../data/demonstrationProjects';

export interface RiskAlertsProps {
  onNavigate: (path: string) => void;
}

export const RiskAlerts: React.FC<RiskAlertsProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [anomalies, setAnomalies] = useState<ProjectAnomaly[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Filter States
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [conditionFilter, setConditionFilter] = useState<'ALL' | 'ACTIVE' | 'HISTORICAL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Anomaly for Drawer Inspection
  const [selectedAnomaly, setSelectedAnomaly] = useState<ProjectAnomaly | null>(null);

  // Administrative Investigation Modal State
  const [investigatingAnomaly, setInvestigatingAnomaly] = useState<ProjectAnomaly | null>(null);
  const [actionType, setActionType] = useState<AnomalyStatus | null>(null);
  const [actionNotes, setActionNotes] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Load All Anomalies and Projects
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      let projList: Project[] = [];
      try {
        projList = await ProjectService.getProjects();
      } catch (err) {
        console.warn('[RiskAlerts] Live project fetch failed, fallback to demonstration list:', err);
      }
      if (!projList || projList.length === 0) {
        projList = DEMONSTRATION_PROJECTS;
      }
      setProjects(projList);

      const all = await AnomalyDetectionService.getAllAnomalies();
      setAnomalies(all);
    } catch (err) {
      console.error('[RiskAlerts] Error loading anomaly triage data:', err);
      showToast('Error Loading Anomalies', {
        message: 'Could not fetch anomaly triage records. Please refresh.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (conditionFilter === 'ACTIVE' && a.isConditionActive === false) return false;
      if (conditionFilter === 'HISTORICAL' && a.isConditionActive !== false) return false;
      if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const proj = projects.find((p) => p.id === a.projectId);
        const matchTitle = (a.title || '').toLowerCase().includes(query);
        const matchId = (a.id || '').toLowerCase().includes(query);
        const matchProject = (proj?.projectNumber || a.projectId || '').toLowerCase().includes(query);
        const matchExplanation = (a.explanation || '').toLowerCase().includes(query);
        const matchType = (a.type || '').toLowerCase().includes(query);
        if (!matchTitle && !matchId && !matchProject && !matchExplanation && !matchType) {
          return false;
        }
      }
      return true;
    });
  }, [anomalies, projects, severityFilter, statusFilter, conditionFilter, typeFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const active = anomalies.filter((a) => a.isConditionActive !== false && a.status !== 'RESOLVED' && a.status !== 'DISMISSED');
    const criticalOrHigh = active.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH');
    const underReview = anomalies.filter((a) => a.status === 'UNDER_REVIEW' || a.status === 'ACKNOWLEDGED');
    const resolvedOrCleared = anomalies.filter((a) => a.status === 'RESOLVED' || a.isConditionActive === false);

    return {
      activeCount: active.length,
      criticalOrHighCount: criticalOrHigh.length,
      underReviewCount: underReview.length,
      resolvedOrClearedCount: resolvedOrCleared.length,
      totalCount: anomalies.length,
    };
  }, [anomalies]);

  // Handle Administrative Investigation Commit
  const handleCommitInvestigation = async () => {
    if (!investigatingAnomaly || !actionType || !user) return;

    if (!isValidAnomalyTransition(investigatingAnomaly.status, actionType)) {
      showToast('Invalid State Transition', {
        message: `Cannot transition anomaly from ${investigatingAnomaly.status} to ${actionType}.`,
        type: 'warning',
      });
      return;
    }

    if ((actionType === 'RESOLVED' || actionType === 'DISMISSED') && actionNotes.trim().length < 8) {
      showToast('Officer Notes Mandatory', {
        message: 'A formal observation of at least 8 characters is required to resolve or dismiss an anomaly.',
        type: 'warning',
      });
      return;
    }

    setSubmittingAction(true);
    try {
      const updated = await AnomalyDetectionService.updateAnomalyStatus({
        projectId: investigatingAnomaly.projectId,
        anomalyId: investigatingAnomaly.id,
        status: actionType,
        resolutionNote: actionType === 'RESOLVED' ? actionNotes.trim() : undefined,
        dismissalReason: actionType === 'DISMISSED' ? actionNotes.trim() : undefined,
        user,
      });

      setAnomalies((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));

      if (selectedAnomaly?.id === updated.id) {
        setSelectedAnomaly(updated);
      }

      showToast('Investigation Status Recorded', {
        message: `Anomaly status transitioned to ${(actionType || 'OPEN').replace('_', ' ')}. Audit trail committed.`,
        type: 'success',
      });

      setInvestigatingAnomaly(null);
      setActionNotes('');
      setActionType(null);
    } catch (err: any) {
      console.error('[RiskAlerts] Error committing status update:', err);
      showToast('Action Failed', {
        message: err?.message || 'Could not update anomaly status. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const getSeverityBadgeClass = (sev: AnomalySeverity) => {
    return SEVERITY_COLORS[sev] || SEVERITY_COLORS.MEDIUM;
  };

  const getStatusBadgeClass = (st: AnomalyStatus) => {
    return STATUS_COLORS[st] || STATUS_COLORS.OPEN;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="AI Anomaly & Risk Alerts Triage Desk"
        subtitle="Autonomous procurement surveillance and physical/financial milestone discrepancy triage for MPLAD infrastructure works."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Surveillance'}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('/government/risk-intelligence')}
              className="gap-1.5 text-xs font-semibold bg-[#002B49] text-white hover:bg-[#001D32]"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Portfolio Risk Intelligence</span>
            </Button>
          </div>
        }
      />

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Anomaly Signals"
          value={loading ? '...' : String(metrics.activeCount)}
          subtitle="Non-compliance signals requiring action"
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="Critical & High Priority"
          value={loading ? '...' : String(metrics.criticalOrHighCount)}
          subtitle="Severe financial/progress divergences"
          icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
        />
        <StatCard
          title="Under Active Review"
          value={loading ? '...' : String(metrics.underReviewCount)}
          subtitle="Acknowledged or under investigation"
          icon={<Clock className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title="Resolved / Historical"
          value={loading ? '...' : String(metrics.resolvedOrClearedCount)}
          subtitle="Cleared conditions & closed findings"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Severity Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>
            </div>

            {/* Condition Lifecycle Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">Condition:</span>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value as any)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="ALL">All Conditions</option>
                <option value="ACTIVE">Active Only</option>
                <option value="HISTORICAL">Historical Cleared Only</option>
              </select>
            </div>

            {/* Anomaly Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium max-w-[200px] truncate focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="ALL">All Anomaly Types</option>
                {Object.entries(ANOMALY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anomalies, project IDs..."
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Anomaly List Feed */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#002B49]" />
            Evaluating deterministic anomaly conditions and loading live surveillance records...
          </div>
        ) : filteredAnomalies.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No anomaly alerts found matching the active filter criteria.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAnomalies.map((anomaly) => {
              const sevClass = getSeverityBadgeClass(anomaly.severity);
              const statClass = getStatusBadgeClass(anomaly.status);
              const proj = projects.find((p) => p.id === anomaly.projectId);
              const allowedTransitions = VALID_ANOMALY_STATUS_TRANSITIONS[anomaly.status] || [];

              return (
                <div
                  key={anomaly.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${sevClass}`}>
                        {anomaly.severity}
                      </span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium border ${statClass}`}>
                        {(anomaly.status || 'OPEN').replace('_', ' ')}
                      </span>
                      {anomaly.isConditionActive === false ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-slate-100 text-slate-600 border-slate-300">
                          Condition Cleared
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                          Active Signal
                        </span>
                      )}
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {anomaly.id}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-semibold text-indigo-800">
                        {proj?.projectNumber || anomaly.projectNumber || anomaly.projectId}
                      </span>
                      {(anomaly.projectTitle || proj?.title) && (
                        <span className="text-xs text-slate-500 line-clamp-1 max-w-[280px]">
                          ({anomaly.projectTitle || proj?.title})
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedAnomaly(anomaly)}
                        className="gap-1 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Evidence</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setInvestigatingAnomaly(anomaly);
                          setActionType(allowedTransitions[0] || null);
                          setActionNotes(anomaly.investigationNotes || '');
                        }}
                        className="gap-1 text-xs bg-[#002B49] hover:bg-[#001D32] text-white"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Take Action</span>
                      </Button>
                    </div>
                  </div>

                  {/* Anomaly Narrative Body */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{anomaly.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{anomaly.explanation}</p>
                  </div>

                  {/* Quantitative Details and Evidence */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Category:</span>
                      <span>{ANOMALY_TYPE_LABELS[anomaly.type] || anomaly.type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>Source: <strong className="text-slate-700 font-mono">{anomaly.detectionSource}</strong></span>
                      <span>•</span>
                      <span>Detected: {new Date(anomaly.detectedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ANOMALY EVIDENCE INSPECTION DRAWER */}
      <Drawer
        isOpen={Boolean(selectedAnomaly)}
        onClose={() => setSelectedAnomaly(null)}
        width="xl"
        title={
          selectedAnomaly && (
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Anomaly Investigation Dossier: {selectedAnomaly.id}</span>
            </div>
          )
        }
        footer={
          selectedAnomaly && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onNavigate('/government/risk-intelligence');
                }}
              >
                <span>View Full Project Intelligence</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const allowed = VALID_ANOMALY_STATUS_TRANSITIONS[selectedAnomaly.status] || [];
                  setInvestigatingAnomaly(selectedAnomaly);
                  setActionType(allowed[0] || null);
                  setActionNotes(selectedAnomaly.investigationNotes || '');
                }}
                className="bg-[#002B49] hover:bg-[#001D32] text-white"
              >
                <span>Record Status Action</span>
              </Button>
            </div>
          )
        }
      >
        {selectedAnomaly && (
          <div className="space-y-6">
            {/* Header Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${getSeverityBadgeClass(selectedAnomaly.severity)}`}>
                  {selectedAnomaly.severity} Severity
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium border ${getStatusBadgeClass(selectedAnomaly.status)}`}>
                  Status: {(selectedAnomaly.status || 'OPEN').replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{selectedAnomaly.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{selectedAnomaly.explanation}</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Anomaly Type</span>
                <div className="text-xs font-bold text-slate-900 mt-1">{ANOMALY_TYPE_LABELS[selectedAnomaly.type] || selectedAnomaly.type}</div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Detection Engine</span>
                <div className="text-xs font-bold text-indigo-700 font-mono mt-1">{selectedAnomaly.detectionSource} (v{selectedAnomaly.ruleVersion})</div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Initial Detection</span>
                <div className="text-xs font-medium text-slate-800 mt-1">{new Date(selectedAnomaly.detectedAt).toLocaleString('en-IN')}</div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Condition Evaluation</span>
                <div className="text-xs font-medium text-slate-800 mt-1">
                  {selectedAnomaly.conditionEvaluatedAt
                    ? new Date(selectedAnomaly.conditionEvaluatedAt).toLocaleString('en-IN')
                    : 'Current Evaluated'}
                </div>
              </div>
            </div>

            {/* Evidence References */}
            {selectedAnomaly.evidence && selectedAnomaly.evidence.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                  Corroborating Evidence Artifacts
                </h4>
                <div className="space-y-2">
                  {selectedAnomaly.evidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-700"
                    >
                      <Layers className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900">{ev.title}</div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{ev.detail}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          Ref: {ev.itemType} {ev.itemId ? `(#${ev.itemId})` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quantitative Divergence Metrics */}
            {selectedAnomaly.metrics && Object.keys(selectedAnomaly.metrics).length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                  Quantitative Supporting Metrics
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 font-mono text-xs">
                  {Object.entries(selectedAnomaly.metrics).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-slate-600">{k}:</span>
                      <span className="font-bold text-slate-900">{typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historical Officer Notes / Action Records */}
            {(selectedAnomaly.resolutionNote || selectedAnomaly.dismissalReason || selectedAnomaly.acknowledgedBy || selectedAnomaly.underReviewBy) && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Recorded Officer Observation & Audit Notes</span>
                </div>
                {selectedAnomaly.resolutionNote && (
                  <p className="leading-relaxed text-amber-900 font-sans">
                    <strong>Resolution Note:</strong> {selectedAnomaly.resolutionNote}
                  </p>
                )}
                {selectedAnomaly.dismissalReason && (
                  <p className="leading-relaxed text-amber-900 font-sans">
                    <strong>Dismissal Reason:</strong> {selectedAnomaly.dismissalReason}
                  </p>
                )}
                {selectedAnomaly.resolvedByName && (
                  <div className="text-[10px] text-amber-800/80 pt-1">
                    Resolved by: <span className="font-semibold">{selectedAnomaly.resolvedByName}</span> on {selectedAnomaly.resolvedAt ? new Date(selectedAnomaly.resolvedAt).toLocaleString('en-IN') : 'N/A'}
                  </div>
                )}
                {selectedAnomaly.dismissedByName && (
                  <div className="text-[10px] text-amber-800/80 pt-1">
                    Dismissed by: <span className="font-semibold">{selectedAnomaly.dismissedByName}</span> on {selectedAnomaly.dismissedAt ? new Date(selectedAnomaly.dismissedAt).toLocaleString('en-IN') : 'N/A'}
                  </div>
                )}
                {selectedAnomaly.underReviewByName && !selectedAnomaly.resolvedByName && !selectedAnomaly.dismissedByName && (
                  <div className="text-[10px] text-amber-800/80 pt-1">
                    Under Review by: <span className="font-semibold">{selectedAnomaly.underReviewByName}</span> on {selectedAnomaly.underReviewAt ? new Date(selectedAnomaly.underReviewAt).toLocaleString('en-IN') : 'N/A'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ADMINISTRATIVE INVESTIGATION STATUS MODAL */}
      {investigatingAnomaly && (
        <Modal
          isOpen={Boolean(investigatingAnomaly)}
          onClose={() => setInvestigatingAnomaly(null)}
          title={`Administrative Action: ${investigatingAnomaly.id}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${getSeverityBadgeClass(investigatingAnomaly.severity)}`}>
                  {investigatingAnomaly.severity}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600">
                  {investigatingAnomaly.type}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-1">
                {investigatingAnomaly.title}
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                {investigatingAnomaly.explanation}
              </p>
            </div>

            {/* Target Status Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Transition Investigation Status:
              </label>
              {(() => {
                const allowedTransitions = VALID_ANOMALY_STATUS_TRANSITIONS[investigatingAnomaly.status] || [];
                if (allowedTransitions.length === 0) {
                  return (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <strong>Terminal Status:</strong> This anomaly is in terminal status{' '}
                      <span className="font-bold font-mono">{investigatingAnomaly.status}</span> and cannot be transitioned further.
                      All investigation records and audit logs are permanently locked for statutory compliance.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allowedTransitions.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setActionType(st)}
                        className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          actionType === st
                            ? 'border-[#002B49] bg-[#002B49] text-white shadow-2xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-100 bg-white'
                        }`}
                      >
                        {(st || 'OPEN').replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Investigation / Review Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Officer Notes & Findings (Recorded in Immutable Audit Trail):
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Enter official observation, measurement verification, or reason for resolution/dismissal..."
                rows={4}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">
                Minimum 8 characters required for resolution or dismissal actions.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInvestigatingAnomaly(null)}
                disabled={submittingAction}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCommitInvestigation}
                disabled={
                  submittingAction ||
                  !actionType ||
                  (VALID_ANOMALY_STATUS_TRANSITIONS[investigatingAnomaly.status] || []).length === 0
                }
                className="bg-[#002B49] hover:bg-[#001D32] text-white"
              >
                {submittingAction ? 'Recording Audit...' : 'Commit Status Update'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// Bharat Tender Intelligence (BTI) — Government Risk Intelligence Dashboard
// Phase 7: MPLAD Anomaly & Risk Intelligence Console
// Displays deterministic monitoring anomalies, multi-dimensional risk scores,
// AI-assisted cross-signal advisory, and investigation lifecycle workflow.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Sliders,
  TrendingDown,
  TrendingUp,
  Activity,
  FolderKanban,
  FileCheck2,
  Building2,
  MapPin,
  ChevronRight,
  HelpCircle,
  XCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ProjectService } from '../../services/firebase/projects';
import { AnomalyDetectionService } from '../../services/anomaly/anomalyDetectionService';
import {
  ProjectAnomaly,
  ProjectRiskAssessment,
  RiskIntelligenceResult,
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
import { formatCurrencyINR } from '../../components/tenders/TenderOpportunityCard';

export interface RiskIntelligenceDashboardProps {
  onNavigate: (path: string) => void;
}

export const RiskIntelligenceDashboard: React.FC<RiskIntelligenceDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Anomalies and risk assessments by project ID
  const [anomaliesMap, setAnomaliesMap] = useState<Record<string, ProjectAnomaly[]>>({});
  const [assessmentsMap, setAssessmentsMap] = useState<Record<string, ProjectRiskAssessment | null>>({});

  // Active AI intelligence result for selected project
  const [aiResultMap, setAiResultMap] = useState<Record<string, RiskIntelligenceResult | null>>({});
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);

  // Filters
  const [activeTab, setActiveTab] = useState<'matrix' | 'anomalies' | 'scenarios'>('matrix');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [conditionFilter, setConditionFilter] = useState<'ALL' | 'ACTIVE' | 'HISTORICAL'>('ALL');
  const [projectConditionFilter, setProjectConditionFilter] = useState<'ALL' | 'ACTIVE' | 'HISTORICAL'>('ALL');

  // Investigation action dialog
  const [investigatingAnomaly, setInvestigatingAnomaly] = useState<ProjectAnomaly | null>(null);
  const [actionType, setActionType] = useState<AnomalyStatus | null>(null);
  const [actionNotes, setActionNotes] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Load all projects and their anomaly profiles
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allProjects = await ProjectService.getProjects({ role: 'government' });
      setProjects(allProjects);

      if (allProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(allProjects[0].id);
      }

      // Load anomalies and assessments for each project
      const aMap: Record<string, ProjectAnomaly[]> = {};
      const rMap: Record<string, ProjectRiskAssessment | null> = {};

      for (const p of allProjects) {
        const [pAnomalies, pAssessment] = await Promise.all([
          AnomalyDetectionService.getProjectAnomalies(p.id),
          AnomalyDetectionService.getProjectRiskAssessment(p.id),
        ]);
        aMap[p.id] = pAnomalies;
        rMap[p.id] = pAssessment;
      }

      setAnomaliesMap(aMap);
      setAssessmentsMap(rMap);
    } catch (err: any) {
      console.error('Error loading risk dashboard data:', err);
      showToast('Load Error', {
        message: err?.message || 'Failed to load risk intelligence records.',
        type: 'danger',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProjectId, showToast]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Run deterministic anomaly checks for a specific project
  const handleRunChecks = async (projectId: string) => {
    try {
      showToast('Running Audits', {
        message: `Executing deterministic rule suite for project ${projectId}...`,
        type: 'info',
      });
      const anomalies = await AnomalyDetectionService.runDeterministicAnomalyChecks(projectId);
      const assessment = await AnomalyDetectionService.getProjectRiskAssessment(projectId);
      
      setAnomaliesMap((prev) => ({ ...prev, [projectId]: anomalies }));
      setAssessmentsMap((prev) => ({ ...prev, [projectId]: assessment }));

      showToast('Audits Complete', {
        message: `Found ${anomalies.length} indicators. Project Risk Score: ${assessment?.riskScore ?? 0}/100 (${assessment?.riskLevel ?? 'LOW'}).`,
        type: assessment?.riskLevel === 'CRITICAL' || assessment?.riskLevel === 'HIGH' ? 'warning' : 'success',
      });

      // Reload project list to sync risk score fields
      const updatedProjects = await ProjectService.getProjects({ role: 'government' });
      setProjects(updatedProjects);
    } catch (err: any) {
      console.error('Error running anomaly checks:', err);
      showToast('Audit Error', {
        message: err?.message || 'Failed to execute deterministic checks.',
        type: 'danger',
      });
    }
  };

  // Run AI risk assessment for the selected project
  const handleRunAiAnalysis = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    if (!user) {
      showToast('Authentication Required', {
        message: 'Please sign in with a government account to run AI analysis.',
        type: 'warning',
      });
      return;
    }

    setAiAnalyzing(true);
    try {
      showToast('AI Advisory', {
        message: 'Synthesizing cross-signal risk intelligence with Gemini...',
        type: 'info',
      });

      const aiResponse = await AnomalyDetectionService.runAiRiskAnalysis(projectId, user);

      setAiResultMap((prev) => ({ ...prev, [projectId]: aiResponse }));

      showToast('AI Assessment Generated', {
        message: `Advisory completed (${aiResponse.riskLevel} Risk). Executive summary updated.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('AI Risk Assessment error:', err);
      showToast('AI Advisory Error', {
        message: err?.message || 'Failed to generate AI risk assessment.',
        type: 'danger',
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Handle anomaly status update
  const handleCommitInvestigation = async () => {
    if (!investigatingAnomaly || !actionType || !user) return;

    if (!isValidAnomalyTransition(investigatingAnomaly.status, actionType)) {
      showToast('Invalid Transition', {
        message: `Cannot transition anomaly from ${investigatingAnomaly.status} to ${actionType}.`,
        type: 'warning',
      });
      return;
    }

    if ((actionType === 'RESOLVED' || actionType === 'DISMISSED') && (!actionNotes || actionNotes.trim().length < 8)) {
      showToast('Note Required', {
        message: 'Please provide a detailed administrative note (min 8 characters) explaining this action.',
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

      // Update local state
      setAnomaliesMap((prev) => {
        const list = prev[investigatingAnomaly.projectId] || [];
        return {
          ...prev,
          [investigatingAnomaly.projectId]: list.map((a) => (a.id === updated.id ? updated : a)),
        };
      });

      // Refresh deterministic risk score for the project
      const refreshedAssessment = await AnomalyDetectionService.getProjectRiskAssessment(investigatingAnomaly.projectId);
      setAssessmentsMap((prev) => ({
        ...prev,
        [investigatingAnomaly.projectId]: refreshedAssessment,
      }));

      showToast('Status Updated', {
        message: `Anomaly status transitioned to ${actionType} with audit record.`,
        type: 'success',
      });

      setInvestigatingAnomaly(null);
      setActionType(null);
      setActionNotes('');
    } catch (err: any) {
      console.error('Update anomaly status error:', err);
      showToast('Update Failed', {
        message: err?.message || 'Could not update anomaly status.',
        type: 'danger',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Aggregate metrics
  const allAnomaliesList = useMemo(() => {
    return Object.values(anomaliesMap).flat();
  }, [anomaliesMap]);

  const criticalProjectsCount = useMemo(() => {
    return projects.filter((p) => {
      const assess = assessmentsMap[p.id];
      const riskLvl = assess?.riskLevel || p.riskLevel;
      return riskLvl === 'CRITICAL' || riskLvl === 'HIGH';
    }).length;
  }, [projects, assessmentsMap]);

  const openAnomaliesCount = useMemo(() => {
    return allAnomaliesList.filter((a) => a.status === 'OPEN' || a.status === 'UNDER_REVIEW').length;
  }, [allAnomaliesList]);

  // Selected project object
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const selectedProjectAnomalies = useMemo(() => {
    if (!selectedProject) return [];
    return anomaliesMap[selectedProject.id] || [];
  }, [selectedProject, anomaliesMap]);

  const selectedProjectAssessment = useMemo(() => {
    if (!selectedProject) return null;
    return assessmentsMap[selectedProject.id] || null;
  }, [selectedProject, assessmentsMap]);

  const selectedAiResult = useMemo(() => {
    if (!selectedProject) return null;
    return aiResultMap[selectedProject.id] || null;
  }, [selectedProject, aiResultMap]);

  // Filtered anomalies across all projects
  const filteredAllAnomalies = useMemo(() => {
    return allAnomaliesList.filter((a) => {
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (conditionFilter === 'ACTIVE' && a.isConditionActive === false) return false;
      if (conditionFilter === 'HISTORICAL' && a.isConditionActive !== false) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.explanation.toLowerCase().includes(q) ||
          a.projectId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allAnomaliesList, severityFilter, statusFilter, conditionFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <PageHeader
        title="MPLAD Risk & Anomaly Intelligence"
        subtitle="Government review console analyzing financial utilization, physical execution, milestone timelines, and field inspection signals."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            Phase 7 Intelligence Active
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadDashboardData(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => selectedProjectId && handleRunChecks(selectedProjectId)}
              className="flex items-center gap-1.5 bg-[#002B49] text-white hover:bg-[#001D33]"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Current Project</span>
            </Button>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Monitored Projects"
          value={projects.length}
          trend={`${DEMONSTRATION_PROJECTS.length} Demonstration Scenarios`}
          trendDirection="neutral"
          icon={<FolderKanban className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label="High / Critical Risk"
          value={criticalProjectsCount}
          trend={`${Math.round((criticalProjectsCount / Math.max(1, projects.length)) * 100)}% of portfolio`}
          trendDirection={criticalProjectsCount > 0 ? 'down' : 'up'}
          icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
        />
        <StatCard
          label="Active Anomaly Flags"
          value={openAnomaliesCount}
          trend="Deterministic Rule Checks"
          trendDirection="neutral"
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="AI Advisory Desk"
          value={Object.keys(aiResultMap).length}
          trend="Server-side Gemini Grounded"
          trendDirection="up"
          icon={<Sparkles className="w-5 h-5 text-purple-600" />}
        />
      </div>

      {/* Pre-Packaged Demonstration Scenario Selector */}
      <Card padding="md" className="border-indigo-100 bg-linear-to-r from-slate-50 via-indigo-50/20 to-slate-50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider">
              Verification Scenarios
            </span>
            <h3 className="text-sm font-bold text-slate-800">
              Phase 7 Multi-Scenario Simulation & Verification Suite
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Click any scenario to load its authoritative data and run the anomaly engine
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {DEMONSTRATION_PROJECTS.map((dp, idx) => {
            const isSelected = selectedProjectId === dp.id;
            const assess = assessmentsMap[dp.id];
            const riskLevel = assess?.riskLevel || dp.riskLevel || 'LOW';
            const riskScore = assess?.riskScore ?? dp.riskScore ?? 0;

            const badgeColor =
              riskLevel === 'CRITICAL'
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : riskLevel === 'HIGH'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : riskLevel === 'MODERATE'
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300';

            return (
              <button
                key={dp.id}
                onClick={() => {
                  setSelectedProjectId(dp.id);
                  handleRunChecks(dp.id);
                }}
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-white shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${badgeColor}`}>
                      {riskLevel} ({riskScore})
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 line-clamp-1" title={dp.title}>
                    {dp.title}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                  {dp.projectNumber}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Project Risk Matrix & AI Desk</span>
        </button>
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'anomalies'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>All Detected Anomalies ({allAnomaliesList.length})</span>
        </button>
      </div>

      {/* TAB 1: PROJECT RISK MATRIX & SELECTED PROJECT DETAIL */}
      {activeTab === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Project Portfolio List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                MPLAD Project Portfolio ({projects.length})
              </h3>
              <span className="text-[11px] text-slate-400">Click to inspect</span>
            </div>

            <div className="space-y-2.5">
              {projects.map((p) => {
                const isSelected = selectedProjectId === p.id;
                const pAnomalies = anomaliesMap[p.id] || [];
                const pAssessment = assessmentsMap[p.id];
                const score = pAssessment?.riskScore ?? p.riskScore ?? 0;
                const level = pAssessment?.riskLevel ?? p.riskLevel ?? 'LOW';

                const phys = p.physicalProgressPercent ?? p.physicalProgress ?? 0;
                const fin = p.financialProgressPercent ?? p.financialProgress ?? 0;
                const divergence = fin - phys;

                const levelBadgeClass =
                  level === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : level === 'HIGH'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : level === 'MODERATE'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300';

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {p.projectNumber} • {p.district || 'Varanasi'}, {p.state || 'UP'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate" title={p.title}>
                          {p.title}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${levelBadgeClass}`}>
                        {level} • {score}
                      </span>
                    </div>

                    {/* Progress Comparison Bar */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-2 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                          <span>Physical</span>
                          <span className="font-bold text-slate-700">{phys}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, phys)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                          <span>Financial</span>
                          <span className="font-bold text-slate-700">{fin}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${divergence >= 20 ? 'bg-rose-500' : 'bg-emerald-600'}`}
                            style={{ width: `${Math.min(100, fin)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate">
                        Agency: <strong className="text-slate-700">{p.implementingAgencyName || p.agencyName || 'N/A'}</strong>
                      </span>
                      <span className="font-semibold text-slate-600">
                        {pAnomalies.length > 0 ? (
                          <span className="text-rose-700 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            {pAnomalies.length} {pAnomalies.length === 1 ? 'anomaly' : 'anomalies'}
                          </span>
                        ) : (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Clean
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Project Detail & Anomaly Inspector (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {selectedProject ? (
              <>
                {/* Project Header Card */}
                <Card padding="md" className="border-slate-200 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {selectedProject.projectNumber}
                        </span>
                        <span className="text-xs text-slate-500">
                          {selectedProject.district}, {selectedProject.state}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 leading-snug">
                        {selectedProject.title}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Executing Agency: <strong className="text-slate-800">{selectedProject.implementingAgencyName || selectedProject.agencyName}</strong>
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleRunChecks(selectedProject.id)}
                          className="flex items-center gap-1"
                        >
                          <Activity className="w-3 h-3" />
                          <span>Run Audit</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => handleRunAiAnalysis(selectedProject.id)}
                          disabled={aiAnalyzing}
                          className="flex items-center gap-1 bg-purple-700 hover:bg-purple-800 text-white"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{aiAnalyzing ? 'Analyzing...' : 'AI Advisory'}</span>
                        </Button>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Deterministic Risk Score</span>
                        <span
                          className={`text-xl font-extrabold ${
                            (selectedProjectAssessment?.riskScore ?? selectedProject.riskScore ?? 0) >= 70
                              ? 'text-rose-600'
                              : (selectedProjectAssessment?.riskScore ?? selectedProject.riskScore ?? 0) >= 40
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {selectedProjectAssessment?.riskScore ?? selectedProject.riskScore ?? 0}
                          <span className="text-xs text-slate-400 font-normal">/100</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quantitative Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-xs">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Awarded Budget</span>
                      <strong className="font-mono text-slate-800">
                        {formatCurrencyINR(selectedProject.awardedAmount || selectedProject.sanctionedBudget || 0)}
                      </strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Physical Progress</span>
                      <strong className="font-mono text-indigo-700">
                        {selectedProject.physicalProgressPercent ?? selectedProject.physicalProgress ?? 0}%
                      </strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Financial Progress</span>
                      <strong className="font-mono text-slate-800">
                        {selectedProject.financialProgressPercent ?? selectedProject.financialProgress ?? 0}%
                      </strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Divergence Gap</span>
                      <strong
                        className={`font-mono ${
                          ((selectedProject.financialProgressPercent ?? selectedProject.financialProgress ?? 0) -
                            (selectedProject.physicalProgressPercent ?? selectedProject.physicalProgress ?? 0)) >= 20
                            ? 'text-rose-600 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        {Math.max(
                          0,
                          (selectedProject.financialProgressPercent ?? selectedProject.financialProgress ?? 0) -
                            (selectedProject.physicalProgressPercent ?? selectedProject.physicalProgress ?? 0)
                        )}
                        %
                      </strong>
                    </div>
                  </div>
                </Card>

                {/* AI Advisory Panel (if generated) */}
                {selectedAiResult && (
                  <Card padding="md" className="border-purple-200 bg-linear-to-br from-purple-50/40 via-white to-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                          Gemini Cross-Signal Risk Advisory
                        </h4>
                      </div>
                      <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-mono">
                        {selectedAiResult.provider} • {selectedAiResult.model}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-purple-100 mb-3">
                      {selectedAiResult.summary}
                    </p>

                    {selectedAiResult.priorityFindings && selectedAiResult.priorityFindings.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Priority Administrative Review Recommendations
                        </span>
                        {selectedAiResult.priorityFindings.map((f, fIdx) => (
                          <div key={fIdx} className="text-xs bg-white p-2.5 rounded border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-slate-800">{f.title}</strong>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                  f.severity === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800'
                                    : f.severity === 'HIGH'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {f.severity}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">{f.explanation}</p>
                            <p className="text-indigo-900 text-[11px] font-medium bg-indigo-50/50 p-1 rounded">
                              👉 <strong>Action:</strong> {f.reviewRecommendation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 italic">
                      Disclaimer: {selectedAiResult.limitations}
                    </p>
                  </Card>
                )}

                {/* Detected Anomalies for Selected Project */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>Anomalies & Compliance Findings ({selectedProjectAnomalies.length})</span>
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setProjectConditionFilter('ALL')}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                          projectConditionFilter === 'ALL'
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All ({selectedProjectAnomalies.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectConditionFilter('ACTIVE')}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                          projectConditionFilter === 'ACTIVE'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Active Conditions ({selectedProjectAnomalies.filter((a) => a.isConditionActive !== false).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectConditionFilter('HISTORICAL')}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                          projectConditionFilter === 'HISTORICAL'
                            ? 'bg-slate-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Historical Audit Records ({selectedProjectAnomalies.filter((a) => a.isConditionActive === false).length})
                      </button>
                    </div>
                  </div>

                  {selectedProjectAnomalies
                    .filter((a) => {
                      if (projectConditionFilter === 'ACTIVE' && a.isConditionActive === false) return false;
                      if (projectConditionFilter === 'HISTORICAL' && a.isConditionActive !== false) return false;
                      return true;
                    }).length === 0 ? (
                    <Card padding="lg" className="text-center bg-slate-50 border-dashed border-slate-200">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <h5 className="text-xs font-bold text-slate-800">No Matching Anomalies</h5>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                        No anomaly records found under the current filter. Physical execution matches verified claims, milestones follow planned sequences, and inspections report no critical variances.
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedProjectAnomalies
                        .filter((a) => {
                          if (projectConditionFilter === 'ACTIVE' && a.isConditionActive === false) return false;
                          if (projectConditionFilter === 'HISTORICAL' && a.isConditionActive !== false) return false;
                          return true;
                        })
                        .map((anomaly) => {
                        const sevClass = SEVERITY_COLORS[anomaly.severity] || SEVERITY_COLORS.MEDIUM;
                        const statClass = STATUS_COLORS[anomaly.status] || STATUS_COLORS.OPEN;

                        return (
                          <div
                            key={anomaly.id}
                            className={`bg-white border rounded-xl p-3.5 shadow-xs space-y-2.5 ${
                              anomaly.isConditionActive === false ? 'border-slate-200 opacity-90' : 'border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${sevClass}`}>
                                    {anomaly.severity}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${statClass}`}>
                                    {anomaly.status}
                                  </span>
                                  {anomaly.isConditionActive === false ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-slate-100 text-slate-600 border-slate-300">
                                      Condition Cleared (Historical Audit Evidence)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                                      Active Condition
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {anomaly.anomalyNumber}
                                  </span>
                                </div>
                                <h5 className="text-xs font-bold text-slate-900">
                                  {anomaly.title}
                                </h5>
                              </div>

                              {/* Investigation Button */}
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => {
                                  const allowed = VALID_ANOMALY_STATUS_TRANSITIONS[anomaly.status] || [];
                                  setInvestigatingAnomaly(anomaly);
                                  setActionType(allowed[0] || null);
                                  setActionNotes(anomaly.investigationNotes || '');
                                }}
                                className="shrink-0 text-indigo-700 hover:bg-indigo-50"
                              >
                                <span>Investigate</span>
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">
                              {anomaly.explanation}
                            </p>

                            {/* Detection Snapshot Data */}
                            {anomaly.detectionSnapshot && Object.keys(anomaly.detectionSnapshot).length > 0 && (
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                                {Object.entries(anomaly.detectionSnapshot)
                                  .filter(([k]) => !['anomalies', 'context'].includes(k))
                                  .slice(0, 6)
                                  .map(([key, val]) => (
                                    <div key={key}>
                                      <span className="text-slate-400 capitalize block">
                                        {key.replace(/([A-Z])/g, ' $1')}
                                      </span>
                                      <strong className="font-mono text-slate-700">
                                        {typeof val === 'number'
                                          ? val.toLocaleString('en-IN')
                                          : String(val)}
                                      </strong>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {/* Investigation Notes if present */}
                            {anomaly.investigationNotes && (
                              <div className="text-[11px] bg-amber-50/70 border border-amber-200 p-2 rounded text-amber-900">
                                <strong>Officer Note ({anomaly.reviewedByName || 'Reviewer'}):</strong> {anomaly.investigationNotes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-slate-400">
                Select a project from the portfolio to inspect its risk posture.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ALL DETECTED ANOMALIES TABLE */}
      {activeTab === 'anomalies' && (
        <Card padding="md" className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Filter Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <span className="text-xs font-bold text-slate-700 ml-2">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>

              <span className="text-xs font-bold text-slate-700 ml-2">Condition:</span>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value as any)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
              >
                <option value="ALL">All Conditions</option>
                <option value="ACTIVE">Active Only</option>
                <option value="HISTORICAL">Historical Cleared Only</option>
              </select>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anomalies..."
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {filteredAllAnomalies.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No anomalies found matching the selected filter criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAllAnomalies.map((a) => {
                const sevClass = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.MEDIUM;
                const statClass = STATUS_COLORS[a.status] || STATUS_COLORS.OPEN;
                const proj = projects.find((p) => p.id === a.projectId);

                return (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${sevClass}`}>
                          {a.severity}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${statClass}`}>
                          {a.status}
                        </span>
                        {a.isConditionActive === false ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-slate-100 text-slate-600 border-slate-300">
                            Condition Cleared
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                            Active
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {a.anomalyNumber}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-indigo-700">
                          {proj?.projectNumber || a.projectId}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            setSelectedProjectId(a.projectId);
                            setActiveTab('matrix');
                          }}
                        >
                          <span>View Project</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => {
                            const allowed = VALID_ANOMALY_STATUS_TRANSITIONS[a.status] || [];
                            setInvestigatingAnomaly(a);
                            setActionType(allowed[0] || null);
                            setActionNotes(a.investigationNotes || '');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <span>Action</span>
                        </Button>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900">{a.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{a.explanation}</p>
                    <p className="text-[11px] text-slate-500">
                      Recommendation: <span className="text-slate-700 font-medium">{a.suggestedRemediation}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ANOMALY INVESTIGATION MODAL */}
      {investigatingAnomaly && (
        <Modal
          isOpen={Boolean(investigatingAnomaly)}
          onClose={() => setInvestigatingAnomaly(null)}
          title={`Administrative Action: ${investigatingAnomaly.anomalyNumber}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                    SEVERITY_COLORS[investigatingAnomaly.severity]
                  }`}
                >
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
                        className={`p-2 rounded-lg border text-xs font-bold transition-all ${
                          actionType === st
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {st.replace('_', ' ')}
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
                Minimum 8 characters for resolution or dismissal actions.
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
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

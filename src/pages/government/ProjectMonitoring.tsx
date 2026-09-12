// Bharat Tender Intelligence (BTI) — Government Project Execution & Monitoring Console
// Phase 6: Post-Award MPLAD Project Implementation, Milestone Tracking, Financial Utilization, Inspections & Exceptions

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderKanban,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Calendar,
  Building2,
  Eye,
  Filter,
  PlusCircle,
  FileCheck2,
  History,
  Clock,
  ShieldCheck,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  UserCheck,
  CheckSquare,
  TrendingUp,
  Sliders,
  DollarSign,
  ArrowRight,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, Column } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { SearchBar } from '../../components/ui/SearchBar';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ProjectService } from '../../services/firebase/projects';
import {
  Project,
  CanonicalProjectStatus,
  toCanonicalProjectStatus,
  ProjectMilestone,
  ProjectProgressUpdate,
  ProjectFinancialRecord,
  ProjectInspection,
  ProjectException,
  ProjectAuditEvent,
  ProjectCompletionChecklist,
  ExpenditureType,
  InspectionType,
} from '../../types/project';
import { formatCurrencyINR } from '../../components/tenders/TenderOpportunityCard';

type ActiveTab =
  | 'overview'
  | 'milestones'
  | 'progress'
  | 'financials'
  | 'inspections'
  | 'exceptions'
  | 'audit';

export const ProjectMonitoring: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Projects list state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [onlyExceptions, setOnlyExceptions] = useState<boolean>(false);

  // Detail Drawer state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);

  // Sub-entity collections for selected project
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProjectProgressUpdate[]>([]);
  const [financialRecords, setFinancialRecords] = useState<ProjectFinancialRecord[]>([]);
  const [inspections, setInspections] = useState<ProjectInspection[]>([]);
  const [exceptions, setExceptions] = useState<ProjectException[]>([]);
  const [auditEvents, setAuditEvents] = useState<ProjectAuditEvent[]>([]);

  // Modals state
  const [statusModalType, setStatusModalType] = useState<CanonicalProjectStatus | null>(null);
  const [statusReason, setStatusReason] = useState<string>('');
  const [completionChecklist, setCompletionChecklist] = useState<ProjectCompletionChecklist>({
    physicalWorkCompleted: false,
    finalMilestoneCompleted: false,
    financialRecordsReviewed: false,
    finalInspectionCompleted: false,
    supportingInformationAvailable: false,
  });

  // Add Milestone Modal
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState<boolean>(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState<string>('');
  const [newMilestoneDesc, setNewMilestoneDesc] = useState<string>('');
  const [newMilestoneStartDate, setNewMilestoneStartDate] = useState<string>('');
  const [newMilestoneEndDate, setNewMilestoneEndDate] = useState<string>('');
  const [newMilestoneWeight, setNewMilestoneWeight] = useState<number>(20);

  // Record Inspection Modal
  const [showInspectionModal, setShowInspectionModal] = useState<boolean>(false);
  const [inspectDate, setInspectDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inspectType, setInspectType] = useState<InspectionType>('ROUTINE');
  const [inspectObservedProgress, setInspectObservedProgress] = useState<number>(0);
  const [inspectObservations, setInspectObservations] = useState<string>('');
  const [inspectRecommendation, setInspectRecommendation] = useState<string>('');

  // Financial Verification Modal
  const [verifyingRecord, setVerifyingRecord] = useState<ProjectFinancialRecord | null>(null);
  const [verificationAction, setVerificationAction] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [verificationNotes, setVerificationNotes] = useState<string>('');

  // Direct Disbursal Modal
  const [showDirectDisbursalModal, setShowDirectDisbursalModal] = useState<boolean>(false);
  const [directDisbursalAmount, setDirectDisbursalAmount] = useState<string>('');
  const [directDisbursalDesc, setDirectDisbursalDesc] = useState<string>('');
  const [directDisbursalType, setDirectDisbursalType] = useState<ExpenditureType>('MATERIAL');
  const [directDisbursalRef, setDirectDisbursalRef] = useState<string>('');

  // Resolve Exception Modal
  const [resolvingException, setResolvingException] = useState<ProjectException | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  // Load all projects
  const loadProjects = useCallback(async () => {
    try {
      const data = await ProjectService.getProjects({ role: 'government' });
      setProjects(data || []);
    } catch (err) {
      console.error('[ProjectMonitoring] Error loading projects from service:', err);
      setProjects([]);
      showToast('Error Loading Projects', {
        message: err instanceof Error ? err.message : 'Could not fetch government project records.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load all sub-records when a project is selected
  const loadProjectDetails = useCallback(async (projectId: string) => {
    setDrawerLoading(true);
    try {
      // 1. First load the existing project sub-records required by deterministic checks
      const [m, u, f, i] = await Promise.all([
        ProjectService.getMilestones(projectId),
        ProjectService.getProgressUpdates(projectId),
        ProjectService.getFinancialRecords(projectId),
        ProjectService.getInspections(projectId),
      ]);

      // 2. Run deterministic exception checks
      const e = await ProjectService.runDeterministicExceptionChecks(projectId);

      // 3. Only after exception detection completes, fetch audit events
      const a = await ProjectService.getAuditEvents(projectId);

      setMilestones(m);
      setProgressUpdates(u);
      setFinancialRecords(f);
      setInspections(i);
      setExceptions(e);
      setAuditEvents(a);
    } catch (err) {
      console.error('[ProjectMonitoring] Failed to fetch project sub-records:', err);
      showToast('Error Loading Details', {
        message: 'Could not load complete project monitoring records.',
        type: 'error',
      });
    } finally {
      setDrawerLoading(false);
    }
  }, [showToast]);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setActiveTab('overview');
    loadProjectDetails(project.id);
  };

  // Map of project id to open exception count
  const [exceptionCountMap, setExceptionCountMap] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    async function loadAllExceptionCounts() {
      const counts: Record<string, number> = {};
      for (const p of projects) {
        try {
          const exc = await ProjectService.getExceptions(p.id);
          counts[p.id] = exc.filter((item) => item.status !== 'RESOLVED').length;
        } catch {
          counts[p.id] = 0;
        }
      }
      if (!cancelled) {
        setExceptionCountMap(counts);
      }
    }
    if (projects.length > 0) {
      loadAllExceptionCounts();
    }
    return () => {
      cancelled = true;
    };
  }, [projects]);

  // Metrics summary
  const summary = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => toCanonicalProjectStatus(p.status) === 'IN_PROGRESS').length;
    const completed = projects.filter((p) => {
      const s = toCanonicalProjectStatus(p.status);
      return s === 'COMPLETED' || s === 'CLOSED';
    }).length;

    let totalSanctioned = 0;
    let totalAwarded = 0;
    let totalDisbursed = 0;
    let totalExceptions = 0;

    for (const p of projects) {
      totalSanctioned += p.sanctionedAmount || p.sanctionedBudget || 0;
      totalAwarded += p.awardedAmount || p.sanctionedBudget || 0;
      totalDisbursed += p.disbursedAmount || p.amountDisbursed || 0;
      totalExceptions += exceptionCountMap[p.id] || 0;
    }

    return { total, inProgress, completed, totalSanctioned, totalAwarded, totalDisbursed, totalExceptions };
  }, [projects, exceptionCountMap]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const canonicalStatus = toCanonicalProjectStatus(p.status);
      if (statusFilter !== 'ALL' && canonicalStatus !== statusFilter) return false;

      if (onlyExceptions && (exceptionCountMap[p.id] || 0) === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pNum = (p.projectNumber || p.projectCode || '').toLowerCase();
        const title = (p.title || '').toLowerCase();
        const dist = (p.district || '').toLowerCase();
        const agency = (p.implementingAgencyName || p.executingAgencyName || p.agencyName || '').toLowerCase();
        if (!pNum.includes(q) && !title.includes(q) && !dist.includes(q) && !agency.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [projects, statusFilter, onlyExceptions, searchQuery, exceptionCountMap]);

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!selectedProject || !statusModalType || !user) return;
    setActionProcessing(true);
    try {
      const updated = await ProjectService.updateProjectStatus({
        projectId: selectedProject.id,
        newStatus: statusModalType,
        user,
        notes: statusReason.trim() || undefined,
        completionChecklist: statusModalType === 'COMPLETED' ? completionChecklist : undefined,
      });

      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setStatusModalType(null);
      setStatusReason('');
      setCompletionChecklist({
        physicalWorkCompleted: false,
        finalMilestoneCompleted: false,
        financialRecordsReviewed: false,
        finalInspectionCompleted: false,
        supportingInformationAvailable: false,
      });

      showToast('Project Status Updated', {
        message: `Status transitioned to ${statusModalType} under GFR 2017 audit trail.`,
        type: 'success',
      });
      loadProjectDetails(updated.id);
    } catch (err) {
      console.error('Status transition error:', err);
      showToast('Transition Blocked', {
        message: err instanceof Error ? err.message : 'Could not transition project status.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Handle Add Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user || !newMilestoneTitle.trim()) return;
    setActionProcessing(true);
    try {
      const nextSequence = milestones.length + 1;
      await ProjectService.createMilestone({
        projectId: selectedProject.id,
        milestone: {
          sequence: nextSequence,
          title: newMilestoneTitle.trim(),
          description: newMilestoneDesc.trim() || undefined,
          plannedStartDate: newMilestoneStartDate || undefined,
          plannedEndDate: newMilestoneEndDate || undefined,
          weightPercent: Number(newMilestoneWeight) || 10,
          progressPercent: 0,
          status: 'NOT_STARTED',
        },
        user,
      });

      showToast('Milestone Added', {
        message: `Milestone #${nextSequence} successfully added to project baseline.`,
        type: 'success',
      });
      setShowAddMilestoneModal(false);
      setNewMilestoneTitle('');
      setNewMilestoneDesc('');
      setNewMilestoneStartDate('');
      setNewMilestoneEndDate('');
      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Add milestone error:', err);
      showToast('Milestone Creation Failed', {
        message: err instanceof Error ? err.message : 'Could not create milestone.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Handle Record Inspection
  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user || !inspectObservations.trim()) return;
    setActionProcessing(true);
    try {
      await ProjectService.createInspection({
        projectId: selectedProject.id,
        inspectionDate: inspectDate,
        officerName: user.name || 'Executive Engineer',
        officerDesignation: 'District Nodal Officer',
        inspectionType: inspectType,
        physicalProgressObserved: Number(inspectObservedProgress) || 0,
        observations: inspectObservations.trim(),
        recommendation: inspectRecommendation.trim() || undefined,
        user,
      });

      showToast('Physical Inspection Recorded', {
        message: 'Official monitoring record and observed progress committed to audit registry.',
        type: 'success',
      });
      setShowInspectionModal(false);
      setInspectObservations('');
      setInspectRecommendation('');
      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Inspection error:', err);
      showToast('Inspection Log Failed', {
        message: err instanceof Error ? err.message : 'Could not record inspection.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Handle Verify Financial Record
  const handleVerifyFinancialRecord = async () => {
    if (!selectedProject || !verifyingRecord || !user) return;
    setActionProcessing(true);
    try {
      await ProjectService.verifyFinancialRecord({
        recordId: verifyingRecord.id,
        projectId: selectedProject.id,
        status: verificationAction,
        notes: verificationNotes.trim() || undefined,
        user,
      });

      showToast(`Financial Claim ${verificationAction === 'VERIFIED' ? 'Verified' : 'Rejected'}`, {
        message: `Expenditure of ₹${verifyingRecord.amount.toLocaleString('en-IN')} updated and reconciled.`,
        type: verificationAction === 'VERIFIED' ? 'success' : 'warning',
      });
      setVerifyingRecord(null);
      setVerificationNotes('');

      // Refresh project to get updated disbursed amount and progress
      const refreshed = await ProjectService.getProjectById(selectedProject.id);
      if (refreshed) {
        setSelectedProject(refreshed);
        setProjects((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
      }
      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Financial verification error:', err);
      showToast('Verification Failed', {
        message: err instanceof Error ? err.message : 'Could not verify financial record.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Handle Direct Disbursal
  const handleDirectDisbursal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user) return;
    const amt = parseFloat(directDisbursalAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Invalid Amount', { message: 'Please enter a valid positive numeric amount in INR.', type: 'error' });
      return;
    }

    setActionProcessing(true);
    try {
      const rec = await ProjectService.submitFinancialRecord({
        projectId: selectedProject.id,
        amount: amt,
        expenditureType: directDisbursalType,
        description: directDisbursalDesc.trim() || 'Direct Treasury / PFMS Disbursal',
        referenceNumber: directDisbursalRef.trim() || undefined,
        user,
        role: 'GOVERNMENT',
      });

      // Automatically verify since logged directly by Government Nodal Officer
      await ProjectService.verifyFinancialRecord({
        recordId: rec.id,
        projectId: selectedProject.id,
        status: 'VERIFIED',
        notes: `Directly authorized and disbursed by nodal authority (${user.name})`,
        user,
      });

      showToast('Disbursal Recorded & Reconciled', {
        message: `Direct release of ₹${amt.toLocaleString('en-IN')} committed to financial utilization ledger.`,
        type: 'success',
      });

      setShowDirectDisbursalModal(false);
      setDirectDisbursalAmount('');
      setDirectDisbursalDesc('');
      setDirectDisbursalRef('');

      const refreshed = await ProjectService.getProjectById(selectedProject.id);
      if (refreshed) {
        setSelectedProject(refreshed);
        setProjects((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
      }
      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Direct disbursal error:', err);
      showToast('Disbursal Failed', {
        message: err instanceof Error ? err.message : 'Could not log direct disbursal.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Handle Resolve Exception
  const handleResolveException = async () => {
    if (!selectedProject || !resolvingException || !user) return;
    if (!resolutionNote.trim()) {
      showToast('Resolution Note Required', {
        message: 'A formal statutory justification note is mandatory to resolve an exception.',
        type: 'warning',
      });
      return;
    }

    setActionProcessing(true);
    try {
      await ProjectService.resolveException({
        exceptionId: resolvingException.id,
        projectId: selectedProject.id,
        resolutionNote: resolutionNote.trim(),
        user,
      });

      showToast('Exception Resolved', {
        message: 'Monitoring exception closed with audit justification.',
        type: 'success',
      });
      setResolvingException(null);
      setResolutionNote('');
      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Exception resolve error:', err);
      showToast('Resolution Failed', {
        message: err instanceof Error ? err.message : 'Could not resolve exception.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Table Columns
  const columns: Column<Project>[] = [
    {
      key: 'projectNumber',
      header: 'Project Ref',
      width: '150px',
      render: (p) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900 block">
            {p.projectNumber || p.projectCode || p.id.slice(0, 12)}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : 'Registered'}
          </span>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Sanctioned Asset & Executing Agency',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900 line-clamp-1">{p.title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {p.district || 'District N/A'}, {p.state || 'State N/A'}
            {p.constituency ? ` • ${p.constituency} (MPLAD)` : ''}
          </div>
          <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
            Agency: {p.implementingAgencyName || p.executingAgencyName || p.agencyName || 'Authorized Contractor'}
          </div>
        </div>
      ),
    },
    {
      key: 'awardedAmount',
      header: 'Contract Value',
      align: 'right',
      render: (p) => {
        const val = p.awardedAmount || p.sanctionedBudget || p.sanctionedAmount || 0;
        return (
          <div className="text-right">
            <div className="font-bold text-slate-900 text-xs">{formatCurrencyINR(val)}</div>
            {p.sanctionedAmount && p.sanctionedAmount !== val && (
              <div className="text-[10px] text-slate-400">
                Sanctioned: {formatCurrencyINR(p.sanctionedAmount)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'physicalProgress',
      header: 'Physical Progress',
      width: '160px',
      render: (p) => {
        const prog = p.physicalProgressPercent ?? p.physicalProgress ?? 0;
        return (
          <div className="w-full">
            <ProgressBar
              value={prog}
              size="sm"
              color={prog >= 80 ? 'emerald' : prog >= 40 ? 'blue' : 'amber'}
              showPercentage={true}
            />
          </div>
        );
      },
    },
    {
      key: 'financialProgress',
      header: 'Financial Disbursed',
      align: 'right',
      render: (p) => {
        const prog = p.financialProgressPercent ?? p.financialProgress ?? 0;
        const disbursed = p.disbursedAmount ?? p.amountDisbursed ?? 0;
        return (
          <div className="text-right">
            <div className="font-semibold text-slate-800 text-xs">{prog}%</div>
            <div className="text-[10px] text-slate-400">{formatCurrencyINR(disbursed)}</div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (p) => {
        const canonical = toCanonicalProjectStatus(p.status);
        return <StatusBadge status={canonical} size="sm" />;
      },
    },
    {
      key: 'exceptions',
      header: 'Monitoring Rules',
      align: 'center',
      render: (p) => {
        const excCount = exceptionCountMap[p.id] || 0;
        if (excCount > 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              {excCount} Exception{excCount > 1 ? 's' : ''}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Compliant
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSelectProject(p)}
          icon={Eye}
          className="text-xs px-2.5 py-1 text-slate-700 border-slate-300 hover:bg-slate-100"
        >
          Inspect & Manage
        </Button>
      ),
    },
  ];

  return (
    <div id="project-monitoring-console" className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader
        title="MPLAD Project Implementation & Monitoring Console"
        subtitle="Authoritative statutory tracking of sanctioned works, milestone deliverables, verified PFMS disbursals, site inspections, and deterministic exception detection under GFR 2017."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                setRefreshing(true);
                loadProjects();
              }}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Sync Registry'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={MapPin}
              onClick={() => onNavigate('/government/projects/map')}
            >
              GIS Public Map
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card padding="sm" className="bg-white border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium block">Total Projects</span>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{summary.total}</div>
          <span className="text-[10px] text-slate-400">Sanctioned assets</span>
        </Card>

        <Card padding="sm" className="bg-white border border-slate-200">
          <span className="text-[11px] text-blue-600 font-medium block">In Progress</span>
          <div className="text-xl font-bold text-blue-900 mt-0.5">{summary.inProgress}</div>
          <span className="text-[10px] text-blue-400">Active site works</span>
        </Card>

        <Card padding="sm" className="bg-white border border-slate-200">
          <span className="text-[11px] text-emerald-600 font-medium block">Completed / Closed</span>
          <div className="text-xl font-bold text-emerald-900 mt-0.5">{summary.completed}</div>
          <span className="text-[10px] text-emerald-400">Verified handovers</span>
        </Card>

        <Card padding="sm" className="bg-white border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium block">Contract Value</span>
          <div className="text-sm font-bold text-slate-900 mt-1 truncate">
            {formatCurrencyINR(summary.totalAwarded)}
          </div>
          <span className="text-[10px] text-slate-400">Awarded works</span>
        </Card>

        <Card padding="sm" className="bg-white border border-slate-200">
          <span className="text-[11px] text-emerald-600 font-medium block">Verified Disbursal</span>
          <div className="text-sm font-bold text-emerald-900 mt-1 truncate">
            {formatCurrencyINR(summary.totalDisbursed)}
          </div>
          <span className="text-[10px] text-slate-400">Reconciled expenditure</span>
        </Card>

        <Card
          padding="sm"
          className={`border ${
            summary.totalExceptions > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-[11px] text-amber-700 font-medium block">Monitoring Exceptions</span>
          <div className="text-xl font-bold text-amber-900 mt-0.5">{summary.totalExceptions}</div>
          <span className="text-[10px] text-amber-600">Pending review</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-96">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by project ref, asset title, district, agency..."
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'NOT_STARTED', label: 'Not Started' },
                { id: 'IN_PROGRESS', label: 'In Progress' },
                { id: 'ON_HOLD', label: 'On Hold' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'CLOSED', label: 'Closed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-[#002B49] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium ml-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyExceptions}
                onChange={(e) => setOnlyExceptions(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-amber-800 font-bold">Exceptions Only</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Projects Master Table */}
      <Table
        data={filteredProjects}
        columns={columns}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => handleSelectProject(p)}
        isLoading={loading}
        emptyText="No monitored projects found matching criteria."
      />

      {/* Comprehensive Project Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
        width="xl"
        title={
          selectedProject && (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">
                  {selectedProject.projectNumber || selectedProject.projectCode || selectedProject.id}
                </span>
                <StatusBadge status={toCanonicalProjectStatus(selectedProject.status)} size="sm" />
                {(exceptionCountMap[selectedProject.id] || 0) > 0 && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                    {exceptionCountMap[selectedProject.id]} Active Exception(s)
                  </span>
                )}
              </div>
              <div className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
                {selectedProject.title}
              </div>
            </div>
          )
        }
        footer={
          selectedProject && (
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={() => setSelectedProject(null)}>
                Close Drawer
              </Button>
              <div className="flex items-center gap-2">
                {toCanonicalProjectStatus(selectedProject.status) === 'NOT_STARTED' && (
                  <Button
                    variant="gov"
                    size="sm"
                    onClick={() => {
                      setStatusModalType('IN_PROGRESS');
                    }}
                    icon={TrendingUp}
                    className="bg-blue-800 hover:bg-blue-900 text-white"
                  >
                    Initiate Site Work (In Progress)
                  </Button>
                )}

                {toCanonicalProjectStatus(selectedProject.status) === 'IN_PROGRESS' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatusModalType('ON_HOLD');
                      }}
                      className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    >
                      Put On Hold
                    </Button>
                    <Button
                      variant="gov"
                      size="sm"
                      onClick={() => {
                        setStatusModalType('COMPLETED');
                      }}
                      icon={CheckSquare}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white"
                    >
                      Verify Completion Checklist
                    </Button>
                  </>
                )}

                {toCanonicalProjectStatus(selectedProject.status) === 'ON_HOLD' && (
                  <Button
                    variant="gov"
                    size="sm"
                    onClick={() => {
                      setStatusModalType('IN_PROGRESS');
                    }}
                    className="bg-blue-800 hover:bg-blue-900 text-white"
                  >
                    Resume Site Work
                  </Button>
                )}

                {toCanonicalProjectStatus(selectedProject.status) === 'COMPLETED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStatusModalType('CLOSED');
                    }}
                    className="text-slate-700 border-slate-300 hover:bg-slate-50"
                  >
                    Final Statutory Closeout
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {selectedProject && (
          <div className="space-y-6 text-xs text-slate-800 pb-12">
            {/* Dual Progress Bars */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <ProgressBar
                  label="Physical Site Progress"
                  value={selectedProject.physicalProgressPercent ?? selectedProject.physicalProgress ?? 0}
                  color="emerald"
                  size="md"
                  showPercentage={true}
                />
              </div>
              <div>
                <ProgressBar
                  label="Financial Expenditure Disbursed"
                  value={selectedProject.financialProgressPercent ?? selectedProject.financialProgress ?? 0}
                  color="blue"
                  size="md"
                  showPercentage={true}
                />
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
              {[
                { id: 'overview', label: 'Overview & Financials', icon: Layers },
                { id: 'milestones', label: `Milestones (${milestones.length})`, icon: FolderKanban },
                { id: 'progress', label: `Site Updates (${progressUpdates.length})`, icon: Activity },
                { id: 'financials', label: `Expenditures (${financialRecords.length})`, icon: Coins },
                { id: 'inspections', label: `Inspections (${inspections.length})`, icon: ShieldCheck },
                {
                  id: 'exceptions',
                  label: `Exceptions (${exceptions.filter((e) => e.status !== 'RESOLVED').length})`,
                  icon: AlertTriangle,
                },
                { id: 'audit', label: 'Audit Trail', icon: History },
              ].map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                    className={`flex items-center gap-1.5 py-2 px-3 border-b-2 font-medium text-xs whitespace-nowrap cursor-pointer transition-colors ${
                      activeTab === tab.id
                        ? 'border-[#002B49] text-[#002B49] font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Overview & Financials */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Financial Utilization Grid */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                    Authoritative Financial Breakdown (INR)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] mb-0.5">Sanctioned Allocation</span>
                      <strong className="text-slate-900 text-sm">
                        {formatCurrencyINR(selectedProject.sanctionedAmount || selectedProject.sanctionedBudget || 0)}
                      </strong>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] mb-0.5">Awarded Contract Value</span>
                      <strong className="text-emerald-800 text-sm">
                        {formatCurrencyINR(selectedProject.awardedAmount || selectedProject.sanctionedBudget || 0)}
                      </strong>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] mb-0.5">Verified Disbursed</span>
                      <strong className="text-blue-800 text-sm">
                        {formatCurrencyINR(selectedProject.disbursedAmount || selectedProject.amountDisbursed || 0)}
                      </strong>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <span className="text-slate-400 block text-[10px] mb-0.5">Remaining Balance</span>
                      <strong className="text-slate-700 text-sm">
                        {formatCurrencyINR(
                          Math.max(
                            0,
                            (selectedProject.awardedAmount || selectedProject.sanctionedBudget || 0) -
                              (selectedProject.disbursedAmount || selectedProject.amountDisbursed || 0)
                          )
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Project Metadata Details */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Project Specifications & Sanction Registry
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Scheme / Category</span>
                      <span className="font-semibold text-slate-800">
                        {selectedProject.sector || selectedProject.category || 'MPLADS Community Asset'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Implementing Agency</span>
                      <span className="font-semibold text-slate-800">
                        {selectedProject.implementingAgencyName ||
                          selectedProject.executingAgencyName ||
                          selectedProject.agencyName ||
                          'Authorized Contractor'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">District & State</span>
                      <span className="font-medium text-slate-800">
                        {selectedProject.district || 'Varanasi'}, {selectedProject.state || 'Uttar Pradesh'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Parliamentary Constituency</span>
                      <span className="font-medium text-slate-800">
                        {selectedProject.constituency || 'Varanasi PC'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Commencement Date</span>
                      <span className="font-mono text-slate-800">
                        {selectedProject.startDate || 'Work Order Issued'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Planned Target Completion</span>
                      <span className="font-mono text-slate-800">
                        {selectedProject.plannedCompletionDate || selectedProject.targetCompletionDate || 'Per Schedule'}
                      </span>
                    </div>
                  </div>

                  {selectedProject.description && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-400 block text-[10px] mb-1">Scope of Work</span>
                      <p className="text-slate-700 leading-relaxed">{selectedProject.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Milestones */}
            {activeTab === 'milestones' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Implementation Milestones</h4>
                    <p className="text-[11px] text-slate-500">
                      Structured milestone deliverables defining physical baseline completion.
                    </p>
                  </div>
                  <Button
                    variant="gov"
                    size="sm"
                    icon={PlusCircle}
                    onClick={() => setShowAddMilestoneModal(true)}
                  >
                    Add Milestone
                  </Button>
                </div>

                {milestones.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <FolderKanban className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No milestones configured yet.</p>
                    <p className="text-[11px] mt-1">
                      Click "Add Milestone" to establish baseline phases and weightages.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {milestones.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 font-mono font-bold text-slate-700 flex items-center justify-center text-[10px]">
                              {m.sequence}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">{m.title}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                m.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : m.status === 'DELAYED'
                                  ? 'bg-rose-50 text-rose-800'
                                  : m.status === 'IN_PROGRESS'
                                  ? 'bg-blue-50 text-blue-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          {m.description && <p className="text-[11px] text-slate-600">{m.description}</p>}
                          <div className="text-[10px] text-slate-400 flex items-center gap-3">
                            <span>Weightage: {m.weightPercent}%</span>
                            {m.plannedStartDate && <span>Start: {m.plannedStartDate}</span>}
                            {m.plannedEndDate && <span>Due: {m.plannedEndDate}</span>}
                          </div>
                        </div>

                        <div className="w-40 shrink-0">
                          <ProgressBar
                            value={m.progressPercent}
                            size="sm"
                            color={m.progressPercent >= 100 ? 'emerald' : 'blue'}
                            showPercentage={true}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Progress Updates */}
            {activeTab === 'progress' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Site Progress Submissions</h4>
                    <p className="text-[11px] text-slate-500">
                      Site execution reports with work narratives, bottlenecks, and corrective actions.
                    </p>
                  </div>
                </div>

                {progressUpdates.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <Activity className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No site progress updates submitted yet.</p>
                    <p className="text-[11px] mt-1">
                      Updates logged by the implementing agency will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {progressUpdates.map((u) => (
                      <div key={u.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-xs">
                              {u.submittedByName || 'Agency Representative'}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              {u.submittedByRole}
                            </span>
                            {u.milestoneTitle && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                • {u.milestoneTitle}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(u.updateDate || u.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>

                        <p className="text-slate-700 text-xs leading-relaxed">{u.workCompletedDescription}</p>

                        {u.issues && u.issues.length > 0 && (
                          <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px]">
                            <strong>Noted Bottlenecks:</strong> {u.issues.join(', ')}
                            {u.correctiveAction && (
                              <div className="mt-1">
                                <strong>Corrective Action:</strong> {u.correctiveAction}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Financial Utilization & Claims */}
            {activeTab === 'financials' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Financial Utilization Ledger</h4>
                    <p className="text-[11px] text-slate-500">
                      Authoritative expenditure entries and verified public fund disbursals under GFR Rule 133.
                    </p>
                  </div>
                  <Button
                    variant="gov"
                    size="sm"
                    icon={DollarSign}
                    onClick={() => setShowDirectDisbursalModal(true)}
                  >
                    Log Direct Disbursal
                  </Button>
                </div>

                {financialRecords.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <Coins className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No expenditure records submitted.</p>
                    <p className="text-[11px] mt-1">
                      Claims submitted by contractor or direct releases logged by authority will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {financialRecords.map((f) => (
                      <div
                        key={f.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {formatCurrencyINR(f.amount)}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                              {f.expenditureType}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                f.verificationStatus === 'VERIFIED'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : f.verificationStatus === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {f.verificationStatus}
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs">{f.description}</p>
                          <div className="text-[10px] text-slate-400 flex items-center gap-3">
                            <span>Voucher / Ref: {f.referenceNumber || 'N/A'}</span>
                            <span>Date: {new Date(f.entryDate).toLocaleDateString('en-IN')}</span>
                            <span>Logged By: {f.submittedByName || f.submittedByRole}</span>
                          </div>
                          {f.verificationNotes && (
                            <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200 mt-1">
                              <strong>Verification Note:</strong> {f.verificationNotes}
                            </div>
                          )}
                        </div>

                        {f.verificationStatus === 'PENDING' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setVerifyingRecord(f);
                                setVerificationAction('REJECTED');
                              }}
                              className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                            >
                              Reject
                            </Button>
                            <Button
                              variant="gov"
                              size="sm"
                              onClick={() => {
                                setVerifyingRecord(f);
                                setVerificationAction('VERIFIED');
                              }}
                              icon={CheckCircle2}
                              className="text-xs bg-emerald-800 hover:bg-emerald-900 text-white"
                            >
                              Verify Disbursal
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Inspections */}
            {activeTab === 'inspections' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Official Physical Inspections</h4>
                    <p className="text-[11px] text-slate-500">
                      Statutory on-site verification records by District Nodal Officers.
                    </p>
                  </div>
                  <Button
                    variant="gov"
                    size="sm"
                    icon={ShieldCheck}
                    onClick={() => setShowInspectionModal(true)}
                  >
                    Record Inspection
                  </Button>
                </div>

                {inspections.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <ShieldCheck className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No physical inspections recorded yet.</p>
                    <p className="text-[11px] mt-1">
                      Click "Record Inspection" to log an official site verification.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspections.map((insp) => (
                      <div key={insp.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {insp.officerName}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {insp.officerDesignation || 'Inspection Officer'}
                            </span>
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                              {insp.inspectionType}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(insp.inspectionDate).toLocaleDateString('en-IN')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Observed Physical Progress:</span>
                          <span className="font-bold text-slate-900">{insp.physicalProgressObserved}%</span>
                        </div>

                        <p className="text-slate-700 text-xs leading-relaxed">{insp.observations}</p>

                        {insp.recommendation && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-[11px]">
                            <strong>Recommendation:</strong> {insp.recommendation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 6: Monitoring Exceptions */}
            {activeTab === 'exceptions' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Deterministic Monitoring Exceptions</h4>
                  <p className="text-[11px] text-slate-500">
                    System-detected variances (schedule delays, progress-financial divergence, over-award claims).
                    These represent rule-based indicators requiring human nodal review.
                  </p>
                </div>

                {exceptions.length === 0 ? (
                  <div className="p-8 text-center bg-emerald-50/50 border border-emerald-200 rounded-xl text-emerald-800">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                    <p className="font-semibold">All deterministic monitoring checks clear.</p>
                    <p className="text-[11px] mt-1 text-emerald-700">
                      No schedule delays, expenditure overruns, or progress variances detected.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exceptions.map((exc) => (
                      <div
                        key={exc.id}
                        className={`p-3 bg-white rounded-xl border ${
                          exc.status === 'RESOLVED'
                            ? 'border-slate-200 opacity-70'
                            : exc.severity === 'HIGH'
                            ? 'border-rose-300 bg-rose-50/30'
                            : 'border-amber-300 bg-amber-50/30'
                        } space-y-2`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                exc.severity === 'HIGH'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {exc.severity} Priority
                            </span>
                            <span className="font-bold text-slate-900 text-xs">{exc.title}</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              exc.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : exc.status === 'ACKNOWLEDGED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {exc.status}
                          </span>
                        </div>

                        <p className="text-slate-700 text-xs">{exc.description}</p>
                        <div className="text-[10px] text-slate-400">
                          Detected At: {new Date(exc.detectedAt).toLocaleString('en-IN')}
                        </div>

                        {exc.status === 'RESOLVED' && exc.resolutionNote && (
                          <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 text-[11px]">
                            <strong>Resolution:</strong> {exc.resolutionNote} (by {exc.resolvedByName || 'Officer'})
                          </div>
                        )}

                        {exc.status !== 'RESOLVED' && (
                          <div className="flex justify-end pt-2 border-t border-slate-100">
                            <Button
                              variant="gov"
                              size="sm"
                              onClick={() => {
                                setResolvingException(exc);
                              }}
                              className="text-xs bg-slate-800 hover:bg-slate-900 text-white"
                            >
                              Resolve Exception
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 7: Audit Trail */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Append-Only Project Audit History</h4>
                  <p className="text-[11px] text-slate-500">
                    Immutable chronological record of every status transition, financial verification, and inspection.
                  </p>
                </div>

                {auditEvents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <History className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No audit events recorded.</p>
                  </div>
                ) : (
                  <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-2">
                    {auditEvents.map((evt) => (
                      <div key={evt.eventId} className="relative pb-3 space-y-1">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{evt.action}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(evt.timestamp).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Actor: {evt.actorName || evt.actorId} ({evt.actorRole})
                        </div>
                        {evt.notes && (
                          <p className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                            {evt.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Modal: Status Transition */}
      <Modal
        isOpen={Boolean(statusModalType)}
        onClose={() => {
          if (!actionProcessing) setStatusModalType(null);
        }}
        title={`Transition Status to ${statusModalType}`}
        description="Official statutory status update under GFR 2017 monitoring framework."
      >
        <div className="space-y-4">
          {statusModalType === 'COMPLETED' ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs">
                <strong>Mandatory Statutory Completion Checklist</strong>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  All 5 criteria must be attested by the competent authority prior to marking the project complete.
                </p>
              </div>

              {[
                {
                  key: 'physicalWorkCompleted' as const,
                  label: '1. Physical work has been verified 100% completed on site.',
                },
                {
                  key: 'finalMilestoneCompleted' as const,
                  label: '2. All scheduled milestones have been verified and signed off.',
                },
                {
                  key: 'financialRecordsReviewed' as const,
                  label: '3. All financial claims, vouchers, and bills have been verified and reconciled.',
                },
                {
                  key: 'finalInspectionCompleted' as const,
                  label: '4. Final joint inspection with District Nodal Officer has been conducted.',
                },
                {
                  key: 'supportingInformationAvailable' as const,
                  label: '5. Asset geo-tagging and public foundation plaque installed per MPLADS norms.',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer p-2 bg-slate-50 rounded border border-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={completionChecklist[item.key]}
                    onChange={(e) =>
                      setCompletionChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Remarks / Justification Notes
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
                placeholder="Statutory reason for status transition..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusModalType(null)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              onClick={handleUpdateStatus}
              disabled={
                actionProcessing ||
                (statusModalType === 'COMPLETED' &&
                  !Object.values(completionChecklist).every((val) => val === true))
              }
              className="bg-emerald-800 hover:bg-emerald-900 text-white"
            >
              {actionProcessing ? 'Updating...' : `Confirm ${statusModalType}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Milestone */}
      <Modal
        isOpen={showAddMilestoneModal}
        onClose={() => {
          if (!actionProcessing) setShowAddMilestoneModal(false);
        }}
        title="Add Implementation Milestone"
        description="Configure structured deliverable milestone with planned timeline and physical weightage."
      >
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Milestone Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              placeholder="e.g. Plinth & Substructure Casting"
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Deliverable Description</label>
            <textarea
              value={newMilestoneDesc}
              onChange={(e) => setNewMilestoneDesc(e.target.value)}
              rows={2}
              placeholder="Key specifications, structural milestones, or materials required..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Planned Start</label>
              <input
                type="date"
                value={newMilestoneStartDate}
                onChange={(e) => setNewMilestoneStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Planned Due Date</label>
              <input
                type="date"
                value={newMilestoneEndDate}
                onChange={(e) => setNewMilestoneEndDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Physical Weightage (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={newMilestoneWeight}
              onChange={(e) => setNewMilestoneWeight(Number(e.target.value))}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddMilestoneModal(false)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              type="submit"
              disabled={actionProcessing || !newMilestoneTitle.trim()}
              className="bg-emerald-800 hover:bg-emerald-900 text-white"
            >
              {actionProcessing ? 'Adding...' : 'Add Milestone'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Record Physical Inspection */}
      <Modal
        isOpen={showInspectionModal}
        onClose={() => {
          if (!actionProcessing) setShowInspectionModal(false);
        }}
        title="Record Official Physical Inspection"
        description="Log statutory on-site verification with observed progress and corrective directives."
      >
        <form onSubmit={handleCreateInspection} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Date</label>
              <input
                type="date"
                value={inspectDate}
                onChange={(e) => setInspectDate(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Type</label>
              <select
                value={inspectType}
                onChange={(e) => setInspectType(e.target.value as InspectionType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="ROUTINE">Routine Monitoring</option>
                <option value="MILESTONE">Milestone Verification</option>
                <option value="COMPLAINT">Complaint Investigation</option>
                <option value="FINAL">Final Completion Audit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observed Physical Progress (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={inspectObservedProgress}
              onChange={(e) => setInspectObservedProgress(Number(e.target.value))}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Site Observations & Findings <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={inspectObservations}
              onChange={(e) => setInspectObservations(e.target.value)}
              rows={3}
              placeholder="Detail physical progress verified on site, material quality, adherence to GFR guidelines..."
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Directives & Recommendations</label>
            <textarea
              value={inspectRecommendation}
              onChange={(e) => setInspectRecommendation(e.target.value)}
              rows={2}
              placeholder="e.g. Cleared for next installment disbursal, or rectifications ordered..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInspectionModal(false)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              type="submit"
              disabled={actionProcessing || !inspectObservations.trim()}
              className="bg-emerald-800 hover:bg-emerald-900 text-white"
            >
              {actionProcessing ? 'Recording...' : 'Commit Inspection Record'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Financial Claim Verification */}
      <Modal
        isOpen={Boolean(verifyingRecord)}
        onClose={() => {
          if (!actionProcessing) setVerifyingRecord(null);
        }}
        title={`${verificationAction === 'VERIFIED' ? 'Verify' : 'Reject'} Financial Expenditure Claim`}
        description="Statutory audit review of submitted invoice/voucher under GFR Rule 133."
      >
        {verifyingRecord && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Expenditure Amount:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {formatCurrencyINR(verifyingRecord.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-medium text-slate-800">{verifyingRecord.expenditureType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Description:</span>
                <span className="text-slate-800">{verifyingRecord.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Voucher / Invoice Reference:</span>
                <span className="font-mono text-slate-800">{verifyingRecord.referenceNumber || 'N/A'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Verification Remarks / Justification
              </label>
              <textarea
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                rows={3}
                placeholder="Audit observations, PFMS payment reference, or rejection reasons..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerifyingRecord(null)}
                disabled={actionProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="gov"
                size="sm"
                onClick={handleVerifyFinancialRecord}
                disabled={actionProcessing}
                className={
                  verificationAction === 'VERIFIED'
                    ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                    : 'bg-rose-800 hover:bg-rose-900 text-white'
                }
              >
                {actionProcessing
                  ? 'Processing...'
                  : verificationAction === 'VERIFIED'
                  ? 'Confirm Verification & Disburse'
                  : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Direct Disbursal */}
      <Modal
        isOpen={showDirectDisbursalModal}
        onClose={() => {
          if (!actionProcessing) setShowDirectDisbursalModal(false);
        }}
        title="Log Direct Disbursal / PFMS Release"
        description="Directly record authorized treasury releases and reconcile against awarded contract value."
      >
        <form onSubmit={handleDirectDisbursal} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Disbursal Amount (INR) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              step="any"
              value={directDisbursalAmount}
              onChange={(e) => setDirectDisbursalAmount(e.target.value)}
              placeholder="e.g. 500000"
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expenditure Type</label>
              <select
                value={directDisbursalType}
                onChange={(e) => setDirectDisbursalType(e.target.value as ExpenditureType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="MATERIAL">Material Procurement</option>
                <option value="LABOUR">Labour & Execution</option>
                <option value="EQUIPMENT">Machinery & Equipment</option>
                <option value="OTHER">General Works / Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PFMS / Treasury Voucher #</label>
              <input
                type="text"
                value={directDisbursalRef}
                onChange={(e) => setDirectDisbursalRef(e.target.value)}
                placeholder="e.g. PFMS/2026/UP/089"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Purpose / Work Phase</label>
            <textarea
              value={directDisbursalDesc}
              onChange={(e) => setDirectDisbursalDesc(e.target.value)}
              rows={2}
              placeholder="e.g. Tranche 1 release upon completion of plinth level inspection..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDirectDisbursalModal(false)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              type="submit"
              disabled={actionProcessing || !directDisbursalAmount}
              className="bg-emerald-800 hover:bg-emerald-900 text-white"
            >
              {actionProcessing ? 'Recording...' : 'Authorize & Commit Disbursal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Resolve Exception */}
      <Modal
        isOpen={Boolean(resolvingException)}
        onClose={() => {
          if (!actionProcessing) setResolvingException(null);
        }}
        title="Resolve Monitoring Exception"
        description="Provide statutory justification or corrective directive to close this monitoring flag."
      >
        {resolvingException && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs space-y-1">
              <span className="font-bold text-amber-900">{resolvingException.title}</span>
              <p className="text-amber-800 text-[11px]">{resolvingException.description}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Resolution Justification Note <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                placeholder="Explain why this exception is resolved (e.g., milestone deadline extended due to monsoon, or bills reconciled)..."
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolvingException(null)}
                disabled={actionProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="gov"
                size="sm"
                onClick={handleResolveException}
                disabled={actionProcessing || !resolutionNote.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                {actionProcessing ? 'Closing Exception...' : 'Resolve & Close Exception'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

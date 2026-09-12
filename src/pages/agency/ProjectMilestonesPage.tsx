// Bharat Tender Intelligence (BTI) — Agency Project Implementation & Milestone Console
// Phase 6: Post-Award Milestone Execution, Site Progress Reporting & Financial Expenditure Claims

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  Upload,
  Coins,
  FileCheck2,
  ShieldCheck,
  Activity,
  PlusCircle,
  Eye,
  RefreshCw,
  Layers,
  MapPin,
  Send,
  Receipt,
  CheckSquare,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
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
  ProjectMilestoneStatus,
  ProjectProgressUpdate,
  ProjectFinancialRecord,
  ProjectInspection,
  ProjectException,
  ExpenditureType,
} from '../../types/project';
import { formatCurrencyINR } from '../../components/tenders/TenderOpportunityCard';

type AgencyTab = 'milestones' | 'progress' | 'financials' | 'inspections';

export const ProjectMilestonesPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { user, status: authStatus } = useAuth();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active selected project for drawer management
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<AgencyTab>('milestones');
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);

  // Sub-records for selected project
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProjectProgressUpdate[]>([]);
  const [financialRecords, setFinancialRecords] = useState<ProjectFinancialRecord[]>([]);
  const [inspections, setInspections] = useState<ProjectInspection[]>([]);
  const [exceptions, setExceptions] = useState<ProjectException[]>([]);

  // Modals
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  const [progressPercentInput, setProgressPercentInput] = useState<number>(10);
  const [workNarrative, setWorkNarrative] = useState<string>('');
  const [issuesInput, setIssuesInput] = useState<string>('');
  const [correctiveActionInput, setCorrectiveActionInput] = useState<string>('');

  const [showFinancialModal, setShowFinancialModal] = useState<boolean>(false);
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [claimType, setClaimType] = useState<ExpenditureType>('MATERIAL');
  const [claimDesc, setClaimDesc] = useState<string>('');
  const [claimRef, setClaimRef] = useState<string>('');

  // Update Milestone Status Modal
  const [updatingMilestone, setUpdatingMilestone] = useState<ProjectMilestone | null>(null);
  const [msNewProgress, setMsNewProgress] = useState<number>(0);
  const [msNewStatus, setMsNewStatus] = useState<ProjectMilestoneStatus>('IN_PROGRESS');
  const [msNotes, setMsNotes] = useState<string>('');

  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  // Load Projects
  const loadProjects = useCallback(async () => {
    if (authStatus === 'loading') {
      return;
    }

    const orgId = user?.organizationId;
    if (!orgId) {
      setProjects([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await ProjectService.getProjects({
        role: 'agency',
        organizationId: orgId,
      });
      setProjects(data || []);
    } catch (err) {
      console.error('[AgencyMilestones] Error loading projects from service:', err);
      setProjects([]);
      showToast('Error Loading Projects', {
        message: err instanceof Error ? err.message : 'Could not fetch agency project records.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authStatus, user?.organizationId, showToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load project sub-records
  const loadProjectDetails = useCallback(async (projectId: string) => {
    setDrawerLoading(true);
    try {
      const [m, u, f, i, e] = await Promise.all([
        ProjectService.getMilestones(projectId),
        ProjectService.getProgressUpdates(projectId),
        ProjectService.getFinancialRecords(projectId),
        ProjectService.getInspections(projectId),
        ProjectService.getExceptions(projectId),
      ]);
      setMilestones(m);
      setProgressUpdates(u);
      setFinancialRecords(f);
      setInspections(i);
      setExceptions(e);
    } catch (err) {
      console.error('[AgencyMilestones] Error loading sub-records:', err);
      showToast('Error Loading Data', {
        message: 'Could not fetch all project deliverables and claims.',
        type: 'error',
      });
    } finally {
      setDrawerLoading(false);
    }
  }, [showToast]);

  const handleOpenProject = (project: Project) => {
    setSelectedProject(project);
    setActiveTab('milestones');
    loadProjectDetails(project.id);
  };

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pNum = (p.projectNumber || p.projectCode || '').toLowerCase();
        const title = (p.title || '').toLowerCase();
        const dist = (p.district || '').toLowerCase();
        if (!pNum.includes(q) && !title.includes(q) && !dist.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [projects, searchQuery]);

  // Submit Site Progress
  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user || !workNarrative.trim()) return;
    setActionProcessing(true);
    try {
      const foundMs = milestones.find((m) => m.id === selectedMilestoneId);
      const issues = issuesInput.trim()
        ? issuesInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      await ProjectService.submitProgressUpdate({
        projectId: selectedProject.id,
        milestoneId: selectedMilestoneId || undefined,
        physicalProgressPercent: Number(progressPercentInput) || 0,
        workCompletedDescription: workNarrative.trim(),
        issues,
        correctiveAction: correctiveActionInput.trim() || undefined,
        user,
        role: 'AGENCY',
      });

      showToast('Site Progress Submitted', {
        message: 'Physical progress update submitted to District Nodal Officer.',
        type: 'success',
      });

      setShowProgressModal(false);
      setWorkNarrative('');
      setIssuesInput('');
      setCorrectiveActionInput('');
      setSelectedMilestoneId('');

      // Refresh project & sub-records
      const refreshed = await ProjectService.getProjectById(selectedProject.id);
      if (refreshed) {
        setSelectedProject(refreshed);
        setProjects((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
      }
      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Submit progress error:', err);
      showToast('Submission Failed', {
        message: err instanceof Error ? err.message : 'Could not submit site progress.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Submit Financial Claim
  const handleSubmitFinancialClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !user) return;
    const amt = parseFloat(claimAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Invalid Amount', {
        message: 'Please enter a valid positive numeric amount in INR.',
        type: 'error',
      });
      return;
    }
    if (!claimDesc.trim()) {
      showToast('Description Required', {
        message: 'Please provide a clear description of expenditure.',
        type: 'error',
      });
      return;
    }

    setActionProcessing(true);
    try {
      await ProjectService.submitFinancialRecord({
        projectId: selectedProject.id,
        amount: amt,
        expenditureType: claimType,
        description: claimDesc.trim(),
        referenceNumber: claimRef.trim() || undefined,
        user,
        role: 'AGENCY',
      });

      showToast('Financial Claim Submitted', {
        message: `Expenditure claim for ₹${amt.toLocaleString('en-IN')} queued for government verification.`,
        type: 'success',
      });

      setShowFinancialModal(false);
      setClaimAmount('');
      setClaimDesc('');
      setClaimRef('');

      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Financial claim error:', err);
      showToast('Claim Submission Failed', {
        message: err instanceof Error ? err.message : 'Could not submit expenditure claim.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Update Milestone Status
  const handleUpdateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !updatingMilestone || !user) return;
    setActionProcessing(true);
    try {
      await ProjectService.submitProgressUpdate({
        projectId: selectedProject.id,
        milestoneId: updatingMilestone.id,
        milestoneStatus: msNewStatus,
        physicalProgressPercent: Number(msNewProgress),
        workCompletedDescription: msNotes.trim() || `Milestone progress updated to ${msNewProgress}%.`,
        user,
        role: 'AGENCY',
      });

      showToast('Milestone Deliverable Updated', {
        message: `Milestone #${updatingMilestone.sequence} updated to ${msNewProgress}% (${msNewStatus}).`,
        type: 'success',
      });

      setUpdatingMilestone(null);
      setMsNotes('');

      // Refresh project to recalculate weighted progress
      const refreshed = await ProjectService.getProjectById(selectedProject.id);
      if (refreshed) {
        setSelectedProject(refreshed);
        setProjects((prev) => prev.map((p) => (p.id === refreshed.id ? refreshed : p)));
      }
      loadProjectDetails(selectedProject.id);
    } catch (err) {
      console.error('Update milestone error:', err);
      showToast('Milestone Update Failed', {
        message: err instanceof Error ? err.message : 'Could not update milestone.',
        type: 'error',
      });
    } finally {
      setActionProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader
        title="Project Execution & Milestone Deliverables Desk"
        subtitle="Manage awarded MPLAD works, submit structured site progress updates, and file statutory expenditure claims for verification under GFR 2017."
        actions={
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
            {refreshing ? 'Syncing...' : 'Sync Projects'}
          </Button>
        }
      />

      {/* Search and Filters */}
      <Card padding="sm">
        <div className="w-full md:w-96">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search awarded projects by code, title, or location..."
          />
        </div>
      </Card>

      {/* Projects List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading awarded projects...</div>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Awarded Projects Assigned</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Once your submitted tender proposals are awarded and sanctioned by the Government Nodal Authority,
            they will appear here for milestone tracking and disbursal claims.
          </p>
          <Button
            variant="gov"
            size="sm"
            onClick={() => onNavigate('/agency/tenders')}
            className="mt-2 bg-[#002B49] text-white"
          >
            Browse Live Tenders
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const canonicalStatus = toCanonicalProjectStatus(project.status);
            const contractVal =
              project.awardedAmount || project.sanctionedBudget || project.sanctionedAmount || 0;
            const disbursedVal = project.disbursedAmount || project.amountDisbursed || 0;
            const physProg = project.physicalProgressPercent ?? project.physicalProgress ?? 0;
            const finProg = project.financialProgressPercent ?? project.financialProgress ?? 0;

            return (
              <Card key={project.id} className="p-5 space-y-4 hover:border-slate-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {project.projectNumber || project.projectCode || project.id.slice(0, 12)}
                      </span>
                      <StatusBadge status={canonicalStatus} size="sm" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{project.title}</h3>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {project.district || 'District N/A'}, {project.state || 'State N/A'}
                      </span>
                      {project.constituency && <span>• {project.constituency} (MPLAD)</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-900">
                      Contract: {formatCurrencyINR(contractVal)}
                    </div>
                    <div className="text-xs text-emerald-700 font-medium mt-0.5">
                      Disbursed: {formatCurrencyINR(disbursedVal)} ({finProg}%)
                    </div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <ProgressBar
                    label="Physical Site Progress"
                    value={physProg}
                    color={physProg >= 80 ? 'emerald' : physProg >= 40 ? 'blue' : 'amber'}
                    size="sm"
                    showPercentage={true}
                  />
                  <ProgressBar
                    label="Financial Fund Utilization"
                    value={finProg}
                    color="blue"
                    size="sm"
                    showPercentage={true}
                  />
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <div className="text-[11px] text-slate-400">
                    Target Completion:{' '}
                    <strong className="text-slate-700">
                      {project.plannedCompletionDate || project.targetCompletionDate || 'Per Schedule'}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="gov"
                      size="sm"
                      onClick={() => handleOpenProject(project)}
                      icon={FolderKanban}
                      className="bg-[#002B49] text-white hover:bg-[#001D33] text-xs"
                    >
                      Manage Deliverables & Claims
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Project Execution Drawer */}
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
              </div>
              <div className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
                {selectedProject.title}
              </div>
            </div>
          )
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setSelectedProject(null)}>
              Close Drawer
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Receipt}
                onClick={() => setShowFinancialModal(true)}
                className="text-emerald-800 border-emerald-300 hover:bg-emerald-50 text-xs"
              >
                Submit Expenditure Claim
              </Button>
              <Button
                variant="gov"
                size="sm"
                icon={Send}
                onClick={() => setShowProgressModal(true)}
                className="bg-[#002B49] text-white hover:bg-[#001D33] text-xs"
              >
                Submit Site Progress Update
              </Button>
            </div>
          </div>
        }
      >
        {selectedProject && (
          <div className="space-y-6 text-xs text-slate-800 pb-12">
            {/* Dual Progress Bars */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <ProgressBar
                label="Physical Site Progress"
                value={selectedProject.physicalProgressPercent ?? selectedProject.physicalProgress ?? 0}
                color="emerald"
                size="md"
                showPercentage={true}
              />
              <ProgressBar
                label="Verified Financial Disbursal"
                value={selectedProject.financialProgressPercent ?? selectedProject.financialProgress ?? 0}
                color="blue"
                size="md"
                showPercentage={true}
              />
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
              {[
                { id: 'milestones', label: `Milestones (${milestones.length})`, icon: FolderKanban },
                { id: 'progress', label: `Site Updates (${progressUpdates.length})`, icon: Activity },
                { id: 'financials', label: `Expenditures (${financialRecords.length})`, icon: Coins },
                { id: 'inspections', label: `Inspections & Flags (${inspections.length})`, icon: ShieldCheck },
              ].map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as AgencyTab)}
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

            {/* Tab 1: Milestones */}
            {activeTab === 'milestones' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Work Breakdown Milestones</h4>
                    <p className="text-[11px] text-slate-500">
                      Deliverables sanctioned by the Government Nodal Authority. Keep progress up to date.
                    </p>
                  </div>
                </div>

                {milestones.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <FolderKanban className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No milestones set by the authority yet.</p>
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
                                  : m.status === 'IN_PROGRESS'
                                  ? 'bg-blue-50 text-blue-800'
                                  : m.status === 'DELAYED'
                                  ? 'bg-rose-50 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          {m.description && <p className="text-[11px] text-slate-600">{m.description}</p>}
                          <div className="text-[10px] text-slate-400 flex items-center gap-3">
                            <span>Weight: {m.weightPercent}%</span>
                            {m.plannedStartDate && <span>Start: {m.plannedStartDate}</span>}
                            {m.plannedEndDate && <span>Due: {m.plannedEndDate}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-32">
                            <ProgressBar
                              value={m.progressPercent}
                              size="sm"
                              color={m.progressPercent >= 100 ? 'emerald' : 'blue'}
                              showPercentage={true}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUpdatingMilestone(m);
                              setMsNewProgress(m.progressPercent);
                              setMsNewStatus(m.status);
                            }}
                            className="text-xs px-2 py-1"
                          >
                            Update
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Site Updates */}
            {activeTab === 'progress' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Submitted Site Progress Updates</h4>
                    <p className="text-[11px] text-slate-500">
                      Chronological submissions reviewed by the district engineer in-charge.
                    </p>
                  </div>
                  <Button
                    variant="gov"
                    size="sm"
                    icon={PlusCircle}
                    onClick={() => setShowProgressModal(true)}
                    className="bg-[#002B49] text-white hover:bg-[#001D33] text-xs"
                  >
                    Log New Update
                  </Button>
                </div>

                {progressUpdates.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <Activity className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No progress updates logged yet.</p>
                    <p className="text-[11px] mt-1">Click "Log New Update" to submit site notes.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {progressUpdates.map((u) => (
                      <div key={u.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-xs">
                              {u.submittedByName || 'Site Engineer'}
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
                            <strong>Reported Bottlenecks:</strong> {u.issues.join(', ')}
                            {u.correctiveAction && (
                              <div className="mt-1">
                                <strong>Mitigation:</strong> {u.correctiveAction}
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

            {/* Tab 3: Financials */}
            {activeTab === 'financials' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Statutory Expenditure Claims</h4>
                    <p className="text-[11px] text-slate-500">
                      Submit invoices and material vouchers to trigger installment releases under GFR Rule 133.
                    </p>
                  </div>
                  <Button
                    variant="gov"
                    size="sm"
                    icon={PlusCircle}
                    onClick={() => setShowFinancialModal(true)}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs"
                  >
                    File New Claim
                  </Button>
                </div>

                {financialRecords.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <Coins className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No expenditure claims filed yet.</p>
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
                            <span>Voucher: {f.referenceNumber || 'N/A'}</span>
                            <span>Date: {new Date(f.entryDate).toLocaleDateString('en-IN')}</span>
                          </div>
                          {f.verificationNotes && (
                            <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200 mt-1">
                              <strong>Government Note:</strong> {f.verificationNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Inspections & Exceptions */}
            {activeTab === 'inspections' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Official Physical Site Inspections</h4>
                  <p className="text-[11px] text-slate-500">
                    Observations and recommendations made by visiting Government Nodal Officers.
                  </p>
                </div>

                {inspections.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                    <ShieldCheck className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="font-semibold">No government physical inspections recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inspections.map((insp) => (
                      <div key={insp.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{insp.officerName}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {insp.officerDesignation}
                            </span>
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded">
                              {insp.inspectionType}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(insp.inspectionDate).toLocaleDateString('en-IN')}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          Observed Progress:{' '}
                          <strong className="text-slate-900">{insp.physicalProgressObserved}%</strong>
                        </div>
                        <p className="text-slate-700 text-xs">{insp.observations}</p>
                        {insp.recommendation && (
                          <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 text-[11px]">
                            <strong>Directives:</strong> {insp.recommendation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Exceptions if any */}
                {exceptions.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <h4 className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Active Monitoring Exceptions Requiring Attention
                    </h4>
                    {exceptions.map((exc) => (
                      <div
                        key={exc.id}
                        className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex justify-between">
                          <span className="font-bold text-amber-900">{exc.title}</span>
                          <span className="text-[10px] font-bold uppercase text-amber-800">{exc.status}</span>
                        </div>
                        <p className="text-amber-800 text-[11px]">{exc.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Modal: Submit Site Progress */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => {
          if (!actionProcessing) setShowProgressModal(false);
        }}
        title="Submit Site Progress Report"
        description="Provide verified physical progress and site observations for government review."
      >
        <form onSubmit={handleSubmitProgress} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Associated Milestone (Optional)
            </label>
            <select
              value={selectedMilestoneId}
              onChange={(e) => setSelectedMilestoneId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">-- General Project Site Progress --</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  Milestone #{m.sequence}: {m.title} ({m.progressPercent}%)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Physical Progress Verified on Site (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={progressPercentInput}
              onChange={(e) => setProgressPercentInput(Number(e.target.value))}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Detailed Work Completed Narrative <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={workNarrative}
              onChange={(e) => setWorkNarrative(e.target.value)}
              rows={3}
              placeholder="e.g. Completed shuttering and reinforcement for 1st slab casting..."
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Identified Site Bottlenecks (Comma-separated)
            </label>
            <input
              type="text"
              value={issuesInput}
              onChange={(e) => setIssuesInput(e.target.value)}
              placeholder="e.g. Monsoon waterlogging, cement delivery delay"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Corrective Actions Undertaken</label>
            <textarea
              value={correctiveActionInput}
              onChange={(e) => setCorrectiveActionInput(e.target.value)}
              rows={2}
              placeholder="e.g. Arranged high-capacity dewatering pumps, added night shift..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProgressModal(false)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              type="submit"
              disabled={actionProcessing || !workNarrative.trim()}
              className="bg-[#002B49] text-white hover:bg-[#001D33]"
            >
              {actionProcessing ? 'Submitting...' : 'Transmit Site Report'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Submit Financial Claim */}
      <Modal
        isOpen={showFinancialModal}
        onClose={() => {
          if (!actionProcessing) setShowFinancialModal(false);
        }}
        title="Submit Statutory Expenditure Claim"
        description="Queue an expenditure claim for government audit verification under GFR Rule 133."
      >
        <form onSubmit={handleSubmitFinancialClaim} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Claim Amount (INR) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              step="any"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              placeholder="e.g. 250000"
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expenditure Category</label>
              <select
                value={claimType}
                onChange={(e) => setClaimType(e.target.value as ExpenditureType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="MATERIAL">Material Procurement</option>
                <option value="LABOUR">Labour & Execution</option>
                <option value="EQUIPMENT">Machinery & Equipment</option>
                <option value="OTHER">General Work / Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tax Invoice / Voucher #</label>
              <input
                type="text"
                value={claimRef}
                onChange={(e) => setClaimRef(e.target.value)}
                placeholder="e.g. INV/2026/042"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description of Expenditure <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={claimDesc}
              onChange={(e) => setClaimDesc(e.target.value)}
              rows={2}
              placeholder="e.g. Purchase of 500 bags of OPC 53 Grade cement for foundation..."
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFinancialModal(false)}
              disabled={actionProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="gov"
              size="sm"
              type="submit"
              disabled={actionProcessing || !claimAmount || !claimDesc.trim()}
              className="bg-emerald-800 hover:bg-emerald-900 text-white"
            >
              {actionProcessing ? 'Transmitting...' : 'Submit Claim'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Update Milestone Deliverable */}
      <Modal
        isOpen={Boolean(updatingMilestone)}
        onClose={() => {
          if (!actionProcessing) setUpdatingMilestone(null);
        }}
        title={`Update Milestone #${updatingMilestone?.sequence}`}
        description={updatingMilestone?.title}
      >
        {updatingMilestone && (
          <form onSubmit={handleUpdateMilestone} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Progress (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={msNewProgress}
                  onChange={(e) => setMsNewProgress(Number(e.target.value))}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deliverable Status</label>
                <select
                  value={msNewStatus}
                  onChange={(e) => setMsNewStatus(e.target.value as ProjectMilestoneStatus)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="NOT_STARTED">NOT_STARTED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="DELAYED">DELAYED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Execution Notes</label>
              <textarea
                value={msNotes}
                onChange={(e) => setMsNotes(e.target.value)}
                rows={2}
                placeholder="Current site state for this milestone..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUpdatingMilestone(null)}
                disabled={actionProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="gov"
                size="sm"
                type="submit"
                disabled={actionProcessing}
                className="bg-[#002B49] text-white hover:bg-[#001D33]"
              >
                {actionProcessing ? 'Saving...' : 'Save Milestone State'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

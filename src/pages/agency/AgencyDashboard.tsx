import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Building2,
  FolderKanban,
  Coins,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { TenderMatchBadge } from '../../components/tenders/TenderMatchBadge';
import { formatCurrencyINR, getDaysRemainingInfo } from '../../components/tenders/TenderOpportunityCard';
import { TenderService } from '../../services/firebase/tenders';
import { OrganizationService } from '../../services/firebase/organizations';
import { ProjectService } from '../../services/firebase/projects';
import { TenderMatchingService } from '../../services/matching/tenderMatchingService';
import { Tender, TenderMatchResult } from '../../types/tender';
import { Organization } from '../../types/organization';
import { Project, toCanonicalProjectStatus, ProjectMilestone } from '../../types/project';
import { useAuth } from '../../context/AuthContext';

export const AgencyDashboard: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [liveTenders, setLiveTenders] = useState<Tender[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loadingTenders, setLoadingTenders] = useState<boolean>(true);
  const [agencyProjects, setAgencyProjects] = useState<Project[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const tenders = await TenderService.getTenders('agency');
        if (!isMounted) return;
        setLiveTenders(tenders);

        // Fetch user organization safely
        let org: Organization | null = null;
        try {
          if (user?.organizationId) {
            org = await OrganizationService.getOrganizationById(user.organizationId);
          } else if (user?.id || user?.uid) {
            const userId = user.id || user.uid || '';
            org = await OrganizationService.getOrganizationByUserId(userId);
            if (!org && user.gstin) {
              org = await OrganizationService.getOrganizationByGstin(user.gstin);
            }
          }
          if (org && isMounted) setOrganization(org);
        } catch (orgErr) {
          console.warn('[BTI AgencyDashboard] Non-fatal org fetch error:', orgErr);
        }

        // Fetch agency projects using authoritative organizationId
        const effectiveOrgId = user?.organizationId || org?.organizationId;
        if (effectiveOrgId) {
          try {
            const projects = await ProjectService.getProjects({
              role: 'agency',
              organizationId: effectiveOrgId,
            });
            if (isMounted) {
              setAgencyProjects(projects || []);
              if (projects && projects.length > 0) {
                const msLists = await Promise.all(
                  projects.map((p) => ProjectService.getMilestones(p.id))
                );
                if (isMounted) {
                  setProjectMilestones(msLists.flat());
                }
              } else {
                setProjectMilestones([]);
              }
            }
          } catch (projErr) {
            console.warn('[BTI AgencyDashboard] Error fetching agency projects:', projErr);
            if (isMounted) {
              setAgencyProjects([]);
              setProjectMilestones([]);
            }
          }
        } else {
          if (isMounted) {
            setAgencyProjects([]);
            setProjectMilestones([]);
          }
        }
      } catch (err) {
        console.warn('[BTI AgencyDashboard] Error fetching live tenders:', err);
      } finally {
        if (isMounted) {
          setLoadingTenders(false);
          setLoadingProjects(false);
        }
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const activeProjectsCount = useMemo(() => {
    return agencyProjects.filter(
      (p) => p.status !== 'COMPLETED' && p.status !== 'CLOSED'
    ).length;
  }, [agencyProjects]);

  const totalDisbursedFunds = useMemo(() => {
    return agencyProjects.reduce(
      (sum, p) => sum + (p.disbursedAmount || p.amountDisbursed || p.utilizedAmount || 0),
      0
    );
  }, [agencyProjects]);

  const milestoneCompliancePercent = useMemo(() => {
    if (projectMilestones.length === 0) {
      if (agencyProjects.length === 0) return 0;
      const avgProg =
        agencyProjects.reduce(
          (sum, p) => sum + (p.physicalProgressPercent ?? p.physicalProgress ?? 0),
          0
        ) / agencyProjects.length;
      return Math.round(avgProg);
    }
    const compliantCount = projectMilestones.filter((m) => m.status !== 'DELAYED').length;
    return Math.round((compliantCount / projectMilestones.length) * 100);
  }, [agencyProjects, projectMilestones]);

  const matchMap = useMemo<Map<string, TenderMatchResult>>(() => {
    return TenderMatchingService.batchMatch(liveTenders, organization);
  }, [liveTenders, organization]);

  // Sort by match score then publication date
  const recommendedTenders = useMemo(() => {
    const list = [...liveTenders];
    list.sort((a, b) => {
      const matchA = matchMap.get(a.id)?.score || 0;
      const matchB = matchMap.get(b.id)?.score || 0;
      if (matchB !== matchA) return matchB - matchA;
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
    return list.slice(0, 4);
  }, [liveTenders, matchMap]);

  const agencyDisplayName = user?.agencyName || organization?.legalName || user?.name || 'Registered Agency Workspace';
  const agencyGstin = user?.gstin || organization?.gstin ? `GSTIN: ${user?.gstin || organization?.gstin}` : 'GSTIN Registered';
  const verificationText = user?.verified ? 'Tier-1 Verified Contractor' : 'Registration & Verification in Progress';

  const tenderColumns: Column<Tender>[] = [
    {
      key: 'tenderNumber',
      header: 'Tender ID',
      width: '150px',
      render: (t) => (
        <span
          onClick={() => onNavigate(`/agency/tenders/${t.id}`)}
          className="font-mono text-xs font-bold text-[#002B49] hover:underline cursor-pointer"
        >
          {t.tenderNumber}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Scope of Work',
      render: (t) => (
        <div>
          <div
            onClick={() => onNavigate(`/agency/tenders/${t.id}`)}
            className="font-semibold text-slate-900 line-clamp-1 hover:text-[#002B49] cursor-pointer text-xs"
          >
            {t.title}
          </div>
          <div className="text-[11px] text-slate-500">
            {t.constituency}, {t.state} • {t.category}
          </div>
        </div>
      ),
    },
    {
      key: 'sanctionedAmount',
      header: 'Sanctioned Cost',
      align: 'right',
      render: (t) => (
        <span className="font-bold text-slate-900 text-xs">
          {formatCurrencyINR(t.sanctionedAmount || t.estimatedValue || t.estimatedCost)}
        </span>
      ),
    },
    {
      key: 'matchScore',
      header: 'BTI Match',
      align: 'center',
      render: (t) => {
        const match = matchMap.get(t.id);
        if (!match) return <span className="text-xs text-slate-400">—</span>;
        return (
          <TenderMatchBadge
            score={match.score}
            tier={match.tier}
            size="sm"
          />
        );
      },
    },
    {
      key: 'closingDate',
      header: 'Deadline',
      render: (t) => {
        const closingInfo = getDaysRemainingInfo(t.closingDate);
        return (
          <div>
            <span className="text-xs font-mono text-slate-700 block">{t.closingDate}</span>
            {closingInfo.isClosingSoon && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 inline-block mt-0.5">
                {closingInfo.label}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate(`/agency/tenders/${t.id}`)}
          className="text-xs px-2.5 py-1 font-bold"
        >
          View Tender
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <SyntheticDataNotice variant="banner" />

      {/* Header */}
      <PageHeader
        title="Agency & Vendor Execution Workspace"
        subtitle={`${agencyDisplayName} (${agencyGstin}) • ${verificationText}`}
        badge={
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
            user?.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{user?.verified ? 'GST & CVC Verified' : 'Scrutiny Pending'}</span>
          </span>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Live Compatible Tenders"
          value={String(liveTenders.length)}
          subtitle="Matching statutory capabilities"
          icon={FileSpreadsheet}
          trend={{ value: `${liveTenders.length} Open`, isPositive: true }}
        />
        <StatCard
          title="Active Projects"
          value={String(activeProjectsCount)}
          subtitle="Works underway"
          icon={FolderKanban}
        />
        <StatCard
          title="Milestone Compliance"
          value={agencyProjects.length === 0 ? '0%' : `${milestoneCompliancePercent}%`}
          subtitle="On-time site completion"
          icon={CheckCircle2}
        />
        <StatCard
          title="Disbursed Funds"
          value={formatCurrencyINR(totalDisbursedFunds)}
          subtitle="PFMS verified releases"
          icon={Receipt}
        />
      </div>

      {/* Projects & Quality Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Active Contract Execution Progress</h3>
              <p className="text-xs text-slate-500">Milestone submissions and physical progress gating</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('/agency/milestones')}
              className="text-xs text-[#002B49]"
            >
              All Milestones
            </Button>
          </div>

          <div className="space-y-4">
            {loadingProjects ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading active projects...</div>
            ) : agencyProjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
                <p className="font-semibold text-slate-700">No Active Projects</p>
                <p>Awarded tenders and sanctioned contracts will appear here for progress tracking.</p>
              </div>
            ) : (
              agencyProjects.slice(0, 3).map((proj) => {
                const pCode = proj.projectNumber || proj.projectCode || proj.id.slice(0, 12);
                const physProg = proj.physicalProgressPercent ?? proj.physicalProgress ?? 0;
                const budgetVal = proj.awardedAmount || proj.sanctionedAmount || proj.sanctionedBudget || 0;
                const targetDate = proj.plannedCompletionDate || proj.targetCompletionDate || 'N/A';

                return (
                  <div key={proj.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-slate-500">{pCode}</span>
                        <h4 className="font-bold text-slate-900 text-xs">{proj.title}</h4>
                      </div>
                      <StatusBadge status={toCanonicalProjectStatus(proj.status)} size="sm" />
                    </div>
                    <ProgressBar
                      label="Physical Site Progress"
                      value={physProg}
                      color="emerald"
                      size="sm"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Sanction: {formatCurrencyINR(budgetVal)}</span>
                      <span className="font-semibold text-slate-800">Target: {targetDate.slice(0, 10)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Agency Compliance Scorecard */}
        <Card className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Contractor Quality & Trust Index</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Tier-1 / 94 Score
              </span>
            </div>

            <div className="space-y-3 pt-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>GST Return Regularity</span>
                </div>
                <strong className="text-emerald-700">100% GSTR-3B Filed</strong>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>On-Time Milestone Rate</span>
                </div>
                <strong className="text-slate-900">
                  {agencyProjects.length === 0 ? '0% Compliance' : `${milestoneCompliancePercent}% Compliance`}
                </strong>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>CVC & Blacklist Status</span>
                </div>
                <strong className="text-emerald-700">Clean Certificate</strong>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/agency/compliance')}
            className="w-full mt-4"
          >
            Manage GST & Organization Profile
          </Button>
        </Card>
      </div>

      {/* Recommended Open Tenders Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Recommended Live Tenders
              </h3>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                <span>Deterministic BTI Match</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live procurement opportunities aligned with {organization?.legalName || 'your registered organization'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/agency/tenders')}
            icon={ArrowRight}
            iconPosition="right"
          >
            Explore All Live Tenders
          </Button>
        </div>

        {loadingTenders ? (
          <Card className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading tender opportunities...
          </Card>
        ) : recommendedTenders.length > 0 ? (
          <Card className="border-slate-200 bg-white overflow-hidden shadow-xs">
            <Table
              data={recommendedTenders}
              columns={tenderColumns}
              keyExtractor={(t) => t.id}
            />
          </Card>
        ) : (
          <Card className="p-6 text-center text-xs text-slate-500">
            No live tenders currently matching your exact criteria.
          </Card>
        )}
      </div>
    </div>
  );
};

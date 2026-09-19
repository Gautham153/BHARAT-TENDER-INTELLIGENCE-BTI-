// Bharat Tender Intelligence (BTI) — Public Transparency Landing Page
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Strictly public-safe presentation without internal risk intelligence or anomaly findings.

import React, { useState, useEffect } from 'react';
import {
  Search,
  Building2,
  Coins,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  FileCheck2,
  Eye,
  Info,
  Layers,
  MapPin,
  Calendar,
} from 'lucide-react';
import { PublicTransparencyService } from '../../services/transparency/publicTransparencyService';
import { PublicProjectDTO } from '../../types/publicTransparency';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';

export interface TransparencyLandingPageProps {
  onNavigate: (path: string) => void;
}

export const TransparencyLandingPage: React.FC<TransparencyLandingPageProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [metrics, setMetrics] = useState<{
    totalProjects: number;
    totalSanctioned: number;
    totalVerifiedDisbursed: number;
    byStatus: Record<string, number>;
    recentProjects: PublicProjectDTO[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const data = await PublicTransparencyService.getPublicTransparencyMetrics();
        if (isMounted) {
          setMetrics(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load public transparency metrics:', err);
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate(`/transparency/projects?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      onNavigate('/transparency/projects');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#002B49] to-[#001c30] text-white p-8 sm:p-12 shadow-xl border border-slate-800">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-xs font-semibold tracking-wide text-amber-300 uppercase">
            <Shield className="w-3.5 h-3.5" />
            MPLAD Citizen Social Audit & Transparency
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Public Project Transparency Portal
          </h1>

          <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
            Explore publicly available information about monitored MPLAD implementation projects. Track sanctioned allocations, awarded contracts, verified public fund disbursals, and ground physical milestones in your constituency.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by project name, ID, district, or MP..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-md"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 shadow-md"
            >
              Search Projects
            </Button>
          </form>
        </div>
      </div>

      {/* Demonstration Data Banner */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 flex items-start gap-3 shadow-2xs">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm space-y-1">
          <div className="font-bold text-amber-900">Demonstration Data Notice</div>
          <p className="text-amber-800 leading-relaxed">
            Demonstration Data — Not a live government data feed. Projects displayed in this prototype are synthesized MPLAD records created strictly for public transparency verification, open-data projection testing, and social audit demonstrations.
          </p>
        </div>
      </div>

      {/* Macro Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Monitored Works
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#002B49]">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">
            {isLoading ? '...' : `${metrics?.totalProjects || 0} Works`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across monitored constituencies
          </div>
        </Card>

        <Card className="p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Sanctioned Outlay
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">
            {isLoading
              ? '...'
              : `₹ ${(((metrics?.totalSanctioned || 0) / 10000000)).toFixed(2)} Cr`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Approved MPLAD allocations
          </div>
        </Card>

        <Card className="p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Verified Disbursal
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">
            {isLoading
              ? '...'
              : `₹ ${(((metrics?.totalVerifiedDisbursed || 0) / 10000000)).toFixed(2)} Cr`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Public funds verified disbursed
          </div>
        </Card>

        <Card className="p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Active In Progress
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-slate-900">
            {isLoading ? '...' : `${metrics?.byStatus.IN_PROGRESS || 0} Works`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Ongoing ground execution
          </div>
        </Card>
      </div>

      {/* Quick Status Filter Chips */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        <span className="text-xs font-bold text-slate-500 uppercase shrink-0">
          Filter by Status:
        </span>
        <button
          onClick={() => onNavigate('/transparency/projects')}
          className="px-3.5 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-300 transition-colors shrink-0"
        >
          All ({metrics?.totalProjects || 0})
        </button>
        <button
          onClick={() => onNavigate('/transparency/projects?status=IN_PROGRESS')}
          className="px-3.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold hover:bg-amber-200 transition-colors shrink-0"
        >
          In Progress ({metrics?.byStatus.IN_PROGRESS || 0})
        </button>
        <button
          onClick={() => onNavigate('/transparency/projects?status=COMPLETED')}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold hover:bg-emerald-200 transition-colors shrink-0"
        >
          Completed ({metrics?.byStatus.COMPLETED || 0})
        </button>
        <button
          onClick={() => onNavigate('/transparency/projects?status=ON_HOLD')}
          className="px-3.5 py-1.5 rounded-lg bg-rose-100 text-rose-900 text-xs font-bold hover:bg-rose-200 transition-colors shrink-0"
        >
          On Hold ({metrics?.byStatus.ON_HOLD || 0})
        </button>
      </div>

      {/* Recently Updated Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Recently Monitored Works
            </h2>
            <p className="text-xs text-slate-500">
              Latest public progress updates, milestone completions, and field inspections.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/transparency/projects')}
            icon={ArrowRight}
            iconPosition="right"
            className="border-slate-300 text-[#002B49] font-bold"
          >
            Browse All Projects
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {isLoading ? (
            <div className="col-span-2 py-12 text-center text-slate-500 text-sm">
              Loading public project records...
            </div>
          ) : metrics?.recentProjects && metrics.recentProjects.length > 0 ? (
            metrics.recentProjects.map((project) => (
              <Card
                key={project.projectId}
                className="p-6 bg-white border border-slate-200/90 shadow-xs hover:border-[#002B49]/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {project.projectNumber || project.projectId}
                    </span>
                    <StatusBadge status={project.statusLabel} size="sm" />
                  </div>

                  <h3 className="font-bold text-slate-900 text-base line-clamp-2 leading-snug">
                    {project.projectName}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {project.location.district}, {project.location.state} • {project.location.constituency}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600">
                    <span className="text-slate-400">Implementing Agency: </span>
                    <span className="font-semibold text-slate-800">
                      {project.implementingAgencyName || 'Designated Agency'}
                    </span>
                  </div>

                  {/* Financial & Physical Progress Row */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px]">Sanctioned Outlay</div>
                      <div className="font-extrabold text-slate-900">
                        ₹ {(project.sanctionedAmount / 10000000).toFixed(2)} Cr
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Verified Disbursal</div>
                      <div className="font-extrabold text-emerald-800">
                        ₹ {(project.verifiedExpenditure / 10000000).toFixed(2)} Cr
                      </div>
                    </div>
                  </div>

                  {/* Physical Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Physical Progress</span>
                      <span className="font-bold text-slate-800">
                        {project.physicalProgressPercent}%
                      </span>
                    </div>
                    <ProgressBar
                      value={project.physicalProgressPercent}
                      size="sm"
                      color="emerald"
                      showPercentage={false}
                    />
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Updated: {project.accountabilityIndicators.lastUpdated}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate(`/transparency/projects/${project.projectId}`)}
                    icon={Eye}
                    iconPosition="right"
                    className="text-[#002B49] hover:bg-slate-100 font-bold text-xs"
                  >
                    View Public Record
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-2 py-12 text-center text-slate-500 text-sm">
              No public projects available.
            </div>
          )}
        </div>
      </div>

      {/* Principles of Public Transparency Section */}
      <div className="p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Citizen Social Audit & Transparency Principles
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            How Bharat Tender Intelligence safeguards public trust through open accountability while protecting internal vigilance integrity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#002B49]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              What Citizens Can See
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>Authoritative project identity, description, and parliamentary constituency.</li>
              <li>Executing contractor and designated public works implementing agency.</li>
              <li>Sanctioned budget outlay, awarded contract value, and verified public disbursals.</li>
              <li>Itemized physical milestone completion and field inspection reports.</li>
              <li>Auditable chronological implementation timeline of actual events.</li>
            </ul>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Shield className="w-4 h-4 text-blue-700" />
              Protected Statutory Intelligence
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>Internal vigilance anomaly indicators, risk scores, and mathematical divergence models.</li>
              <li>Confidential reviewer comments, administrative memos, and pre-decisional notes.</li>
              <li>Statutory evidence chains and investigation work papers under active inquiry.</li>
              <li>Proprietary organizational tax documentation and private officer credentials.</li>
              <li>Unpublished administrative decisions awaiting competent authority approval.</li>
            </ul>
          </div>
        </div>

        {/* Data Provenance Box */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-bold text-slate-700">Data Sources: </span>
            Project Master Records, Verified Milestone Progress, Statutory Disbursal Vouchers, Field Updates, and Government Engineering Inspections.
          </div>
          <Button
            variant="gov"
            size="sm"
            onClick={() => onNavigate('/transparency/projects')}
            className="bg-[#002B49] text-white font-bold shrink-0"
          >
            Explore Public Directory
          </Button>
        </div>
      </div>
    </div>
  );
};

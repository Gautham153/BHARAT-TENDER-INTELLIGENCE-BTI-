// Bharat Tender Intelligence (BTI) — Public Project Directory Page
// Phase 9: Public Transparency & Citizen Social Audit Layer
// Publicly searchable and filterable directory with strict allowlisted DTOs.

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Building2,
  MapPin,
  Calendar,
  Eye,
  Info,
  ChevronRight,
  SlidersHorizontal,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { PublicTransparencyService } from '../../services/transparency/publicTransparencyService';
import { PublicProjectDTO } from '../../types/publicTransparency';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProgressBar } from '../../components/ui/ProgressBar';

export interface PublicProjectDirectoryPageProps {
  onNavigate: (path: string) => void;
  initialSearch?: string;
  initialStatus?: string;
}

export const PublicProjectDirectoryPage: React.FC<PublicProjectDirectoryPageProps> = ({
  onNavigate,
  initialSearch = '',
  initialStatus = '',
}) => {
  const [projects, setProjects] = useState<PublicProjectDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'lastUpdated' | 'sanctionedAmount' | 'physicalProgress' | 'title'>('lastUpdated');

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await PublicTransparencyService.getPublicProjects({
        search,
        status: statusFilter,
        category: categoryFilter,
        district: districtFilter,
        sortBy,
        pageSize: 100,
      });
      setProjects(res.projects);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Failed to load public directory projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [search, statusFilter, categoryFilter, districtFilter, sortBy]);

  // Derived filter options
  const uniqueDistricts = useMemo(() => {
    const districts = new Set<string>();
    projects.forEach((p) => {
      if (p.location.district) districts.add(p.location.district);
    });
    return Array.from(districts).sort();
  }, [projects]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    projects.forEach((p) => {
      if (p.category) categories.add(p.category);
    });
    return Array.from(categories).sort();
  }, [projects]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setDistrictFilter('ALL');
    setSortBy('lastUpdated');
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    districtFilter !== 'ALL' ||
    sortBy !== 'lastUpdated';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <button
          onClick={() => onNavigate('/transparency')}
          className="hover:text-[#002B49] font-medium transition-colors cursor-pointer"
        >
          Transparency
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-bold">Public Projects Directory</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Monitored Public Works Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official public disclosure directory of MPLAD capital projects, fund utilizations, and physical progress.
          </p>
        </div>
        <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-medium self-start md:self-auto">
          Showing <span className="font-bold text-slate-900">{projects.length}</span> of {totalCount} Public Records
        </div>
      </div>

      {/* Demonstration Banner */}
      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong className="text-amber-900 font-semibold">Demonstration Dataset:</strong> Project records are synthesized for validation of the public transparency layer.
          </span>
        </div>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-amber-200/60 font-mono text-[10px] text-amber-900 font-bold">
          PROTOTYPE DEMO
        </span>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-5 bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name, ID, district, agency, or sector..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="CLOSED">Closed</option>
            </select>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            >
              <option value="ALL">All Categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* District Dropdown */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            >
              <option value="ALL">All Districts</option>
              {uniqueDistricts.map((dst) => (
                <option key={dst} value={dst}>
                  {dst}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            >
              <option value="lastUpdated">Sort: Recently Monitored</option>
              <option value="sanctionedAmount">Sort: Sanctioned Outlay</option>
              <option value="physicalProgress">Sort: Physical Progress</option>
              <option value="title">Sort: Project Name</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-2 text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading public records...
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              No Public Projects Found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No publicly available projects match the selected search terms or filters. Try adjusting your query or resetting filters.
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="mx-auto text-xs"
            >
              Clear All Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <Card
              key={project.projectId}
              className="p-5 bg-white border border-slate-200/90 shadow-xs hover:border-[#002B49]/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {project.projectNumber || project.projectId}
                  </span>
                  <StatusBadge status={project.statusLabel} size="sm" />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {project.category} • {project.sector}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug mt-0.5">
                    {project.projectName}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {project.location.district}, {project.location.state} ({project.location.constituency})
                  </span>
                </div>

                <div className="text-xs text-slate-600">
                  <span className="text-slate-400">Agency: </span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {project.implementingAgencyName || 'Designated Agency'}
                  </span>
                </div>

                {/* Financial Summary Box */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400 text-[10px]">Sanctioned Outlay</div>
                    <div className="font-extrabold text-slate-900">
                      ₹ {(project.sanctionedAmount / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Verified Disbursal</div>
                    <div className="font-extrabold text-emerald-800">
                      ₹ {(project.verifiedExpenditure / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                </div>

                {/* Physical Progress */}
                <div className="space-y-1.5">
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
                  {project.accountabilityIndicators.lastUpdated}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(`/transparency/projects/${project.projectId}`)}
                  icon={Eye}
                  iconPosition="right"
                  className="text-[#002B49] hover:bg-slate-100 font-bold text-xs"
                >
                  View Record
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

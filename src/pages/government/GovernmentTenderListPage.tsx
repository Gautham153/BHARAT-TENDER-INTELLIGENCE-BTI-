// Bharat Tender Intelligence (BTI) — Government Tender List View
// Phase 3A: Tender Lifecycle & Procurement Management Dashboard

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Radio,
  Clock,
  Award,
  IndianRupee,
  MapPin,
  Calendar,
  Building,
  Eye,
  Edit,
  Send,
  Lock,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { TenderService } from '../../services/firebase/tenders';
import { Tender, CanonicalTenderCategory, CanonicalTenderStatus } from '../../types/tender';
import { TenderStatusBadge } from '../../components/tenders/TenderStatusBadge';
import { TenderConfirmationModal, TenderModalAction } from '../../components/tenders/TenderConfirmationModal';
import { useAuth } from '../../context/AuthContext';

export interface GovernmentTenderListPageProps {
  onNavigate: (path: string) => void;
}

export const GovernmentTenderListPage: React.FC<GovernmentTenderListPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | 'LIVE' | 'DRAFT' | 'CLOSED' | 'AWARDED'>('ALL');

  // Modal State
  const [modalAction, setModalAction] = useState<TenderModalAction | null>(null);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchTenders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TenderService.listTenders(undefined, user?.role);
      setTenders(data);
    } catch (err: any) {
      console.error('[BTI] Error fetching tenders:', err);
      setError(err?.message || 'Error fetching tender records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, [user]);

  // Derive districts and categories for dropdowns
  const availableDistricts = useMemo(() => {
    const set = new Set<string>();
    tenders.forEach((t) => {
      if (t.district) set.add(t.district);
    });
    return Array.from(set).sort();
  }, [tenders]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    tenders.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [tenders]);

  // Calculate Metrics
  const metrics = useMemo(() => {
    const total = tenders.length;
    const live = tenders.filter((t) => t.status === 'LIVE' || t.status === 'PUBLISHED' || t.status === 'Open').length;
    const drafts = tenders.filter((t) => t.status === 'DRAFT').length;
    const closed = tenders.filter((t) => t.status === 'CLOSED' || t.status === 'Closed' || t.status === 'UNDER_EVALUATION').length;
    const totalSanctioned = tenders.reduce(
      (acc, t) => acc + (t.sanctionedAmount || t.estimatedValue || t.estimatedCost || 0),
      0
    );
    return { total, live, drafts, closed, totalSanctioned };
  }, [tenders]);

  // Filtered List
  const filteredTenders = useMemo(() => {
    return tenders.filter((t) => {
      // Tab filter
      if (activeTab === 'LIVE' && !(t.status === 'LIVE' || t.status === 'PUBLISHED' || t.status === 'Open')) return false;
      if (activeTab === 'DRAFT' && t.status !== 'DRAFT') return false;
      if (activeTab === 'CLOSED' && !(t.status === 'CLOSED' || t.status === 'Closed' || t.status === 'UNDER_EVALUATION')) return false;
      if (activeTab === 'AWARDED' && !(t.status === 'AWARDED' || t.status === 'Awarded')) return false;

      // Status dropdown filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'LIVE' && !(t.status === 'LIVE' || t.status === 'PUBLISHED' || t.status === 'Open')) return false;
        if (statusFilter !== 'LIVE' && t.status !== statusFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) {
        return false;
      }

      // District filter
      if (districtFilter !== 'ALL' && (t.district || '').toLowerCase() !== districtFilter.toLowerCase()) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const sq = searchQuery.toLowerCase().trim();
        const matchesNumber = t.tenderNumber.toLowerCase().includes(sq);
        const matchesTitle = t.title.toLowerCase().includes(sq);
        const matchesCategory = t.category.toLowerCase().includes(sq);
        const matchesDistrict = (t.district || '').toLowerCase().includes(sq);
        const matchesAuthority = (t.issuingAuthority || '').toLowerCase().includes(sq);
        const matchesLocation = (t.projectLocation || '').toLowerCase().includes(sq);
        if (!matchesNumber && !matchesTitle && !matchesCategory && !matchesDistrict && !matchesAuthority && !matchesLocation) {
          return false;
        }
      }

      return true;
    });
  }, [tenders, activeTab, statusFilter, categoryFilter, districtFilter, searchQuery]);

  // Currency Formatter helper
  const formatCurrency = (amount: number) => {
    if (!amount) return '₹0';
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} Lakh`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Days remaining calculation
  const getDaysRemaining = (closingDate: string) => {
    if (!closingDate) return null;
    const closeTime = new Date(closingDate).getTime();
    const diffDays = Math.ceil((closeTime - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Handle Quick Lifecycle Actions
  const handleOpenAction = (tender: Tender, action: TenderModalAction) => {
    setSelectedTender(tender);
    setModalAction(action);
  };

  const handleConfirmAction = async (notes: string) => {
    if (!selectedTender || !modalAction || !user) return;

    if (modalAction === 'PUBLISH') {
      await TenderService.publishTender(selectedTender.id, user, notes);
    } else if (modalAction === 'CLOSE') {
      await TenderService.closeTender(selectedTender.id, user, notes);
    } else if (modalAction === 'CANCEL') {
      await TenderService.cancelTender(selectedTender.id, user, notes);
    } else if (modalAction === 'ARCHIVE') {
      await TenderService.archiveTender(selectedTender.id, user, notes);
    }

    await fetchTenders();
  };

  return (
    <div id="government-tender-management-page" className="space-y-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Tender Management
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-mono">
              MPLAD Scheme
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1 font-normal">
            Authoritative lifecycle control, draft preparation, publishing, and statutory audit compliance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchTenders}
            disabled={loading}
            className="p-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Tender Repository"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            id="create-tender-btn"
            onClick={() => onNavigate('/government/tenders/create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#002B49] text-white text-sm font-semibold hover:bg-[#001D33] transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Tender</span>
          </button>
        </div>
      </div>

      {/* Authoritative Error Banner if any */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchTenders}
            className="font-bold underline text-rose-900 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Total Tenders</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {metrics.total}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            All registered MPLAD works
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Live / Bidding</span>
            <Radio className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {metrics.live}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Accepting agency bids
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Draft Proposals</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800">
            {metrics.drafts}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Pending publication
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Closed / Eval</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800">
            {metrics.closed}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Bidding concluded
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#002B49]">Sanctioned Value</span>
            <IndianRupee className="w-4 h-4 text-[#002B49]" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatCurrency(metrics.totalSanctioned)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Constituency allocation
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3.5">
        {/* Quick Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'ALL', label: 'All Tenders', count: metrics.total },
                { id: 'LIVE', label: 'Live Bidding', count: metrics.live },
                { id: 'DRAFT', label: 'Drafts', count: metrics.drafts },
                { id: 'CLOSED', label: 'Closed / Under Evaluation', count: metrics.closed },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#002B49] text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredTenders.length}</strong> of {tenders.length} records
          </div>
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-6 lg:col-span-5">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by tender #, title, category, authority, or location..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#002B49]"
            />
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-3 lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#002B49]"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* District Dropdown */}
          <div className="md:col-span-3 lg:col-span-2">
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#002B49]"
            >
              <option value="ALL">All Districts</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="md:col-span-12 lg:col-span-2 flex items-center justify-end">
            {(searchQuery || categoryFilter !== 'ALL' || districtFilter !== 'ALL' || activeTab !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setDistrictFilter('ALL');
                  setStatusFilter('ALL');
                  setActiveTab('ALL');
                }}
                className="text-xs text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Responsive Data Presentation */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <Clock className="w-6 h-6 mx-auto mb-2 animate-spin text-[#002B49]" />
          Loading authoritative government tenders...
        </div>
      ) : filteredTenders.length === 0 ? (
        <div className="py-16 px-4 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-900">
            No tenders found matching your criteria
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try resetting your search query and filters or initiate a new tender procurement workflow.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/government/tenders/create')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#002B49] text-white text-xs font-semibold hover:bg-[#001D33] transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Tender</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop & Laptop Table View with Graceful Horizontal Scrolling */}
          <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3.5 px-4 min-w-[220px]">Tender Identification</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Category & Department</th>
                    <th className="py-3.5 px-4 min-w-[150px]">Location</th>
                    <th className="py-3.5 px-4 min-w-[130px]">Financials</th>
                    <th className="py-3.5 px-4 min-w-[130px]">Timeline</th>
                    <th className="py-3.5 px-4 min-w-[120px]">Status</th>
                    <th className="py-3.5 px-4 min-w-[120px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTenders.map((tender) => {
                    const daysRem = getDaysRemaining(tender.closingDate);
                    const isDraft = tender.status === 'DRAFT';
                    const isLive = tender.status === 'LIVE' || tender.status === 'PUBLISHED' || tender.status === 'Open';

                    return (
                      <tr
                        key={tender.id}
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                        onClick={() => onNavigate(`/government/tenders/${tender.id}`)}
                      >
                        {/* Identification */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-xs font-bold text-[#002B49]">
                            {tender.tenderNumber}
                          </div>
                          <div className="font-semibold text-slate-900 text-xs mt-0.5 line-clamp-2 leading-snug">
                            {tender.title}
                          </div>
                          {tender.mpName && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              MP: <span className="font-medium text-slate-700">{tender.mpName}</span>
                            </div>
                          )}
                        </td>

                        {/* Category & Department */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 text-xs">
                            {tender.category}
                          </span>
                          {tender.subCategory && (
                            <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                              {tender.subCategory}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{tender.department || tender.issuingAuthority}</span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 font-semibold text-slate-800 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {tender.district || tender.constituency}, {tender.state}
                            </span>
                          </div>
                          {tender.projectLocation && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[170px] mt-0.5" title={tender.projectLocation}>
                              {tender.projectLocation}
                            </div>
                          )}
                        </td>

                        {/* Financials */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs">
                            {formatCurrency(tender.sanctionedAmount || tender.estimatedValue || tender.estimatedCost)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Est: {formatCurrency(tender.estimatedValue || tender.estimatedCost)}
                          </div>
                        </td>

                        {/* Timeline */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-slate-800 font-medium">
                            Closes: <span className="font-semibold text-slate-900">{tender.closingDate}</span>
                          </div>
                          {isLive && daysRem !== null && (
                            <div className="mt-0.5">
                              {daysRem > 0 ? (
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                                  {daysRem} day{daysRem === 1 ? '' : 's'} remaining
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                  Closes today
                                </span>
                              )}
                            </div>
                          )}
                          {tender.durationValue && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Duration: {tender.durationValue} {tender.durationUnit || 'days'}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <TenderStatusBadge status={tender.status} size="sm" />
                          {tender.proposalsCount !== undefined && tender.proposalsCount > 0 && (
                            <div className="text-[11px] font-medium text-slate-600 mt-1">
                              {tender.proposalsCount} bid{tender.proposalsCount === 1 ? '' : 's'} submitted
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          className="py-3.5 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onNavigate(`/government/tenders/${tender.id}`)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                              title="View Tender Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isDraft && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onNavigate(`/government/tenders/${tender.id}/edit`)}
                                  className="p-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 text-blue-700 transition-colors cursor-pointer"
                                  title="Edit Draft Specifications"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAction(tender, 'PUBLISH')}
                                  className="p-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 text-emerald-700 transition-colors cursor-pointer"
                                  title="Publish Tender"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {isLive && (
                              <button
                                type="button"
                                onClick={() => handleOpenAction(tender, 'CLOSE')}
                                className="p-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 text-amber-700 transition-colors cursor-pointer"
                                title="Close Bidding"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Card View (Shown on small screens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            {filteredTenders.map((tender) => {
              const daysRem = getDaysRemaining(tender.closingDate);
              const isDraft = tender.status === 'DRAFT';
              const isLive = tender.status === 'LIVE' || tender.status === 'PUBLISHED' || tender.status === 'Open';

              return (
                <div
                  key={tender.id}
                  onClick={() => onNavigate(`/government/tenders/${tender.id}`)}
                  className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#002B49]">
                      {tender.tenderNumber}
                    </span>
                    <TenderStatusBadge status={tender.status} size="sm" />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                      {tender.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {tender.category} {tender.subCategory && `• ${tender.subCategory}`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        Sanctioned Budget
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(tender.sanctionedAmount || tender.estimatedValue || tender.estimatedCost)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        Closing Date
                      </span>
                      <span className="font-semibold text-slate-900">
                        {tender.closingDate}
                      </span>
                      {isLive && daysRem !== null && (
                        <span className="block text-[10px] font-bold text-emerald-700 mt-0.5">
                          {daysRem > 0 ? `${daysRem} days remaining` : 'Closes today'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{tender.district || tender.constituency}, {tender.state}</span>
                    </span>

                    <span className="text-blue-700 font-bold flex items-center gap-0.5">
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {selectedTender && (
        <TenderConfirmationModal
          isOpen={!!modalAction}
          action={modalAction}
          tender={selectedTender}
          onClose={() => {
            setModalAction(null);
            setSelectedTender(null);
          }}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
};

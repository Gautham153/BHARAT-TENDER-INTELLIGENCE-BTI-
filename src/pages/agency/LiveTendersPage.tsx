// Bharat Tender Intelligence (BTI) — Agency Live Tenders & Discovery Page
// Phase 3B: Authoritative Live Tender Opportunities with Deterministic Match Engine & Dual View Modes

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  ChevronRight,
  Filter,
  Layers,
  MapPin,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { VerificationGate } from '../../components/auth/VerificationGate';
import {
  TenderOpportunityCard,
  formatCurrencyINR,
  getDaysRemainingInfo,
} from '../../components/tenders/TenderOpportunityCard';
import { TenderMatchBadge } from '../../components/tenders/TenderMatchBadge';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { TenderService } from '../../services/firebase/tenders';
import { OrganizationService } from '../../services/firebase/organizations';
import { TenderMatchingService } from '../../services/matching/tenderMatchingService';
import { useAuth } from '../../context/AuthContext';
import {
  Tender,
  CanonicalTenderCategory,
  CANONICAL_TENDER_CATEGORIES,
  TENDER_CATEGORIES_MAP,
  TenderMatchResult,
} from '../../types/tender';
import { Organization } from '../../types/organization';

type DiscoveryTab = 'recommended' | 'all' | 'closing_soon';
type SortOption = 'recommended' | 'newest' | 'closing_soon' | 'highest_value' | 'lowest_value';
type ViewMode = 'cards' | 'table';

export const LiveTendersPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Data states
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // Tab & Filter states
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('recommended');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [closingSoonOnly, setClosingSoonOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);

  // Fetch live tenders from TenderService (role: agency) and organization
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Authoritative tenders fetch for agency: excludes DRAFT, CANCELLED, ARCHIVED, CLOSED
      const liveTenders = await TenderService.getTenders('agency');
      setTenders(liveTenders);

      // 2. Fetch current organization safely without violating security rules
      try {
        if (user?.organizationId) {
          const org = await OrganizationService.getOrganizationById(user.organizationId);
          if (org) setOrganization(org);
        } else if (user?.id || user?.uid) {
          const userId = user.id || user.uid || '';
          let org = await OrganizationService.getOrganizationByUserId(userId);
          if (!org && user.gstin) {
            org = await OrganizationService.getOrganizationByGstin(user.gstin);
          }
          if (org) {
            setOrganization(org);
          }
        }
      } catch (orgErr) {
        console.warn('[BTI LiveTenders] Non-fatal organization fetch error:', orgErr);
      }
    } catch (err: unknown) {
      console.error('[BTI LiveTenders] Error loading tenders:', err);
      setError(err instanceof Error ? err.message : 'Unable to retrieve live tenders.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute deterministic match results for all tenders
  const matchMap = useMemo<Map<string, TenderMatchResult>>(() => {
    return TenderMatchingService.batchMatch(tenders, organization);
  }, [tenders, organization]);

  // Derive unique states and districts
  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    tenders.forEach((t) => {
      if (t.state) states.add(t.state);
    });
    return Array.from(states).sort();
  }, [tenders]);

  const uniqueDistricts = useMemo(() => {
    const districts = new Set<string>();
    tenders.forEach((t) => {
      if (selectedState === 'ALL' || t.state === selectedState) {
        if (t.district) districts.add(t.district);
      }
    });
    return Array.from(districts).sort();
  }, [tenders, selectedState]);

  const availableSubcategories = useMemo(() => {
    if (selectedCategory !== 'ALL' && selectedCategory in TENDER_CATEGORIES_MAP) {
      return TENDER_CATEGORIES_MAP[selectedCategory as CanonicalTenderCategory] || [];
    }
    return [];
  }, [selectedCategory]);

  useEffect(() => {
    setSelectedSubCategory('ALL');
  }, [selectedCategory]);

  useEffect(() => {
    setSelectedDistrict('ALL');
  }, [selectedState]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
    setSelectedState('ALL');
    setSelectedDistrict('ALL');
    setMinAmount('');
    setMaxAmount('');
    setClosingSoonOnly(false);
    setSortBy('recommended');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedCategory !== 'ALL') count++;
    if (selectedSubCategory !== 'ALL') count++;
    if (selectedState !== 'ALL') count++;
    if (selectedDistrict !== 'ALL') count++;
    if (minAmount) count++;
    if (maxAmount) count++;
    if (closingSoonOnly) count++;
    return count;
  }, [
    searchQuery,
    selectedCategory,
    selectedSubCategory,
    selectedState,
    selectedDistrict,
    minAmount,
    maxAmount,
    closingSoonOnly,
  ]);

  // Filtered & Sorted Tenders
  const filteredTenders = useMemo(() => {
    let result = [...tenders];

    // 1. Tab preset
    if (activeTab === 'closing_soon') {
      result = result.filter((t) => {
        const info = getDaysRemainingInfo(t.closingDate);
        return !info.isClosed && info.days <= 15;
      });
    } else if (activeTab === 'recommended') {
      if (organization) {
        result = result.filter((t) => {
          const match = matchMap.get(t.id);
          return (match?.score || 0) > 0;
        });
      }
    }

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) => {
        return (
          t.tenderNumber.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.subCategory || '').toLowerCase().includes(q) ||
          (t.state || '').toLowerCase().includes(q) ||
          (t.district || '').toLowerCase().includes(q) ||
          (t.constituency || '').toLowerCase().includes(q) ||
          (t.issuingAuthority || '').toLowerCase().includes(q) ||
          (t.projectLocation || '').toLowerCase().includes(q)
        );
      });
    }

    // 3. Category
    if (selectedCategory !== 'ALL') {
      result = result.filter((t) => t.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    // 4. SubCategory
    if (selectedSubCategory !== 'ALL') {
      result = result.filter(
        (t) => (t.subCategory || '').toLowerCase() === selectedSubCategory.toLowerCase()
      );
    }

    // 5. State
    if (selectedState !== 'ALL') {
      result = result.filter((t) => (t.state || '').toLowerCase() === selectedState.toLowerCase());
    }

    // 6. District
    if (selectedDistrict !== 'ALL') {
      result = result.filter((t) => (t.district || '').toLowerCase() === selectedDistrict.toLowerCase());
    }

    // 7. Value Range
    const minVal = parseFloat(minAmount);
    if (!isNaN(minVal) && minVal > 0) {
      result = result.filter((t) => (t.sanctionedAmount || t.estimatedValue || 0) >= minVal);
    }
    const maxVal = parseFloat(maxAmount);
    if (!isNaN(maxVal) && maxVal > 0) {
      result = result.filter((t) => (t.sanctionedAmount || t.estimatedValue || 0) <= maxVal);
    }

    // 8. Closing Soon Toggle
    if (closingSoonOnly) {
      result = result.filter((t) => {
        const info = getDaysRemainingInfo(t.closingDate);
        return !info.isClosed && info.days <= 7;
      });
    }

    // 9. Sorting
    result.sort((a, b) => {
      const matchA = matchMap.get(a.id)?.score || 0;
      const matchB = matchMap.get(b.id)?.score || 0;

      switch (sortBy) {
        case 'recommended':
          if (matchB !== matchA) return matchB - matchA;
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
        case 'newest':
          return new Date(b.publicationDate || b.createdAt || '').getTime() - new Date(a.publicationDate || a.createdAt || '').getTime();
        case 'closing_soon': {
          const timeA = a.closingDate ? new Date(a.closingDate).getTime() : Infinity;
          const timeB = b.closingDate ? new Date(b.closingDate).getTime() : Infinity;
          return timeA - timeB;
        }
        case 'highest_value': {
          const valA = a.sanctionedAmount || a.estimatedValue || 0;
          const valB = b.sanctionedAmount || b.estimatedValue || 0;
          return valB - valA;
        }
        case 'lowest_value': {
          const valA = a.sanctionedAmount || a.estimatedValue || 0;
          const valB = b.sanctionedAmount || b.estimatedValue || 0;
          return valA - valB;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [
    tenders,
    activeTab,
    searchQuery,
    selectedCategory,
    selectedSubCategory,
    selectedState,
    selectedDistrict,
    minAmount,
    maxAmount,
    closingSoonOnly,
    sortBy,
    matchMap,
    organization,
  ]);

  // Alternate Table Columns
  const tableColumns: Column<Tender>[] = [
    {
      key: 'tenderNumber',
      header: 'Tender ID',
      width: '160px',
      render: (t) => (
        <div>
          <span
            onClick={() => onNavigate(`/agency/tenders/${t.id}`)}
            className="font-mono text-xs font-bold text-[#002B49] hover:underline cursor-pointer"
          >
            {t.tenderNumber}
          </span>
          <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
            {t.issuingAuthority}
          </div>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Scope of Works',
      render: (t) => (
        <div className="max-w-md">
          <div
            onClick={() => onNavigate(`/agency/tenders/${t.id}`)}
            className="font-bold text-slate-900 text-xs hover:text-[#002B49] cursor-pointer line-clamp-1"
          >
            {t.title}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span>{t.district ? `${t.district}, ` : ''}{t.state}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Sector',
      render: (t) => (
        <div>
          <span className="text-xs font-semibold text-slate-800">{t.category}</span>
          {t.subCategory && (
            <div className="text-[10px] text-slate-500 truncate max-w-[130px]">{t.subCategory}</div>
          )}
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
      key: 'closingDate',
      header: 'Deadline',
      render: (t) => {
        const info = getDaysRemainingInfo(t.closingDate);
        return (
          <div>
            <span className="font-mono text-xs text-slate-900 block">{t.closingDate}</span>
            {info.isClosingSoon && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 inline-block mt-0.5">
                {info.label}
              </span>
            )}
          </div>
        );
      },
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
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <Button
          variant="outline"
          size="sm"
          icon={ChevronRight}
          iconPosition="right"
          className="text-xs py-1 px-2.5 font-bold"
          onClick={() => onNavigate(`/agency/tenders/${t.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <VerificationGate
      onNavigate={onNavigate}
      fallbackTitle="Verified Contractor Access Required"
      fallbackDescription="Electronic tender discovery and compatibility assessment are restricted to statutory verified contracting organizations. Complete your GSTIN verification to access live procurement notices."
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <SyntheticDataNotice variant="banner" />

        {/* Page Header */}
        <PageHeader
          title="Tender Opportunities"
          subtitle="Discover government tenders relevant to your organization's capabilities."
          badge={
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>BTI Deterministic Match Engine</span>
            </span>
          }
        />

        {/* Discovery Tab Navigation & View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setActiveTab('recommended')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'recommended'
                  ? 'bg-[#002B49] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Recommended for You</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'all'
                  ? 'bg-[#002B49] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>All Live Tenders</span>
              <span className="ml-1 text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800">
                {tenders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('closing_soon')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'closing_soon'
                  ? 'bg-[#002B49] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Closing Soon</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle (Grid/Cards vs Table) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-[#002B49] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-[#002B49] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={SlidersHorizontal}
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className="text-xs font-semibold"
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#002B49] text-white font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Search Bar & Sorters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by tender number, scope of work, sector, state, district, or authority..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002B49] focus:border-transparent transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="agency-sort-select" className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
              Sort:
            </label>
            <select
              id="agency-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#002B49] cursor-pointer shadow-2xs"
            >
              <option value="recommended">Recommended (BTI Match Score)</option>
              <option value="newest">Newest Published</option>
              <option value="closing_soon">Closing Soonest</option>
              <option value="highest_value">Sanctioned Value: High to Low</option>
              <option value="lowest_value">Sanctioned Value: Low to High</option>
            </select>
          </div>
        </div>

        {/* Collapsible Filters Drawer */}
        {showFilterDrawer && (
          <Card className="p-4 sm:p-5 border-slate-300 bg-slate-50/70 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#002B49]" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">Procurement Sector & Regional Filters</h4>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All ({activeFilterCount})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Procurement Sector
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-[#002B49]"
                >
                  <option value="ALL">All Sectors</option>
                  {CANONICAL_TENDER_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Subcategory
                </label>
                <select
                  value={selectedSubCategory}
                  onChange={(e) => setSelectedSubCategory(e.target.value)}
                  disabled={availableSubcategories.length === 0}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium disabled:bg-slate-100 disabled:text-slate-400 focus:ring-1 focus:ring-[#002B49]"
                >
                  <option value="ALL">All Subcategories</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  State / Territory
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-[#002B49]"
                >
                  <option value="ALL">All States</option>
                  {uniqueStates.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  District
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  disabled={uniqueDistricts.length === 0}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium disabled:bg-slate-100 disabled:text-slate-400 focus:ring-1 focus:ring-[#002B49]"
                >
                  <option value="ALL">All Districts</option>
                  {uniqueDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Min Sanctioned Value (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000000 (50L)"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-[#002B49]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Max Sanctioned Value (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000000 (5 Cr)"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-[#002B49]"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-3 pt-4 sm:pt-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={closingSoonOnly}
                    onChange={(e) => setClosingSoonOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#002B49] focus:ring-[#002B49] border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Show only tenders closing within 7 calendar days
                  </span>
                </label>
              </div>
            </div>
          </Card>
        )}

        {/* Results Metadata Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div>
            Showing <strong className="text-slate-900">{filteredTenders.length}</strong> active opportunity
            {filteredTenders.length === 1 ? '' : 'ies'}
            {organization && (
              <span>
                {' '}
                for <strong className="text-[#002B49]">{organization.displayName || organization.legalName}</strong>
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-[#002B49] hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear filters</span>
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 border-slate-200 animate-pulse space-y-4 bg-white">
                <div className="h-4 bg-slate-200 rounded w-1/4" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                  <div className="h-4 bg-slate-200 rounded" />
                  <div className="h-4 bg-slate-200 rounded" />
                  <div className="h-4 bg-slate-200 rounded" />
                  <div className="h-4 bg-slate-200 rounded" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <Card className="p-8 border-rose-200 bg-rose-50/50 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Failed to Load Opportunities</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
            <Button variant="outline" size="sm" onClick={loadData}>
              Retry Connection
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTenders.length === 0 && (
          <Card className="p-10 border-slate-200 bg-white text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
              <FileSpreadsheet className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">No Tender Opportunities Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {activeFilterCount > 0
                  ? 'No live tenders matched your active search criteria or category filters.'
                  : activeTab === 'recommended'
                  ? 'No current live tenders directly match your registered organization classification.'
                  : 'There are currently no live procurement notices published on the portal.'}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {activeFilterCount > 0 ? (
                <Button variant="gov" size="sm" onClick={handleResetFilters}>
                  Reset All Filters
                </Button>
              ) : activeTab !== 'all' ? (
                <Button variant="gov" size="sm" onClick={() => setActiveTab('all')}>
                  Browse All Live Tenders
                </Button>
              ) : null}
            </div>
          </Card>
        )}

        {/* Content: Cards View */}
        {!loading && !error && filteredTenders.length > 0 && viewMode === 'cards' && (
          <div className="space-y-4">
            {filteredTenders.map((tender) => {
              const match = matchMap.get(tender.id);
              return (
                <TenderOpportunityCard
                  key={tender.id}
                  tender={tender}
                  matchResult={match}
                  onNavigate={onNavigate}
                  organizationName={organization?.displayName || organization?.legalName}
                />
              );
            })}
          </div>
        )}

        {/* Content: Alternate Table View */}
        {!loading && !error && filteredTenders.length > 0 && viewMode === 'table' && (
          <Card className="border-slate-200 bg-white overflow-hidden shadow-xs">
            <Table
              data={filteredTenders}
              columns={tableColumns}
              keyExtractor={(t) => t.id}
              emptyText="No tenders found matching current criteria."
            />
          </Card>
        )}
      </div>
    </VerificationGate>
  );
};

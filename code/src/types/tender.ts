// Bharat Tender Intelligence (BTI) — Tender Domain Types & Interfaces
// Phase 3A: Government Tender Management, Lifecycle & Publishing

export type CanonicalTenderStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'LIVE'
  | 'CLOSED'
  | 'UNDER_EVALUATION'
  | 'AWARDED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type LegacyTenderStatus =
  | 'Open'
  | 'Closed'
  | 'In Evaluation'
  | 'Under Evaluation'
  | 'Awarded'
  | 'Cancelled';

export type TenderStatus = CanonicalTenderStatus | LegacyTenderStatus;

export type CanonicalTenderCategory =
  | 'Road Infrastructure'
  | 'Education'
  | 'Healthcare'
  | 'Water & Sanitation'
  | 'Public Buildings'
  | 'Electricity'
  | 'Community Infrastructure'
  | 'Agriculture'
  | 'Other';

export const CANONICAL_TENDER_CATEGORIES: CanonicalTenderCategory[] = [
  'Road Infrastructure',
  'Education',
  'Healthcare',
  'Water & Sanitation',
  'Public Buildings',
  'Electricity',
  'Community Infrastructure',
  'Agriculture',
  'Other',
];

export type LegacyTenderCategory =
  | 'Civil Infrastructure'
  | 'Drinking Water Project'
  | 'Health & Sanitation'
  | 'Healthcare Infrastructure'
  | 'Education & Schools'
  | 'Educational Facilities'
  | 'Rural Electrification'
  | 'Rural Road Construction'
  | 'Community Facilities';

export type TenderCategory = CanonicalTenderCategory | LegacyTenderCategory;

export type DurationUnit = 'days' | 'weeks' | 'months';

export interface TenderLocation {
  state: string;
  district: string;
  constituency: string;
  projectLocation: string;
  latitude?: number;
  longitude?: number;
}

export interface TenderFinancials {
  sanctionedAmount: number; // in INR (positive number)
  estimatedValue: number; // in INR (positive number)
  currency: 'INR';
}

export interface TenderTimeline {
  durationValue: number; // e.g. 30, 90, 180
  durationUnit: DurationUnit;
  publicationDate: string; // YYYY-MM-DD
  closingDate: string; // YYYY-MM-DD or ISO string
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
  uploadedAt: string;
  verified?: boolean;
}

export interface Tender {
  id: string;
  tenderNumber: string; // e.g. BTI/MPLAD/2026/0001
  title: string;
  description: string;
  category: TenderCategory;
  subCategory?: string;

  // Issuing Authority
  issuingAuthority?: string; // e.g. "District Magistrate & District Nodal Officer"
  department?: string; // e.g. "Public Works Department (PWD)"

  // Location
  state: string;
  district?: string;
  constituency: string;
  projectLocation?: string;
  latitude?: number;
  longitude?: number;

  // Financials
  sanctionedAmount?: number; // in INR
  estimatedValue?: number; // in INR
  estimatedCost: number; // in INR (standardized for both canonical & legacy consumers)
  currency?: 'INR';
  budget?: number;

  // Timeline
  durationValue?: number;
  durationUnit?: DurationUnit;
  publicationDate?: string;
  publishedDate?: string; // legacy alias for publicationDate
  closingDate: string;
  submissionDeadline?: string;

  // Requirements & Compliance
  eligibilityCriteria?: string[];
  requiredDocuments?: string[]; // Metadata/descriptions only in Phase 3A
  specialRequirements?: string;
  scopeOfWork?: string;
  documents?: Document[];

  // Lifecycle & Metadata
  status: TenderStatus;
  createdBy?: string; // UID of Government Creator
  createdByName?: string;
  createdByEmail?: string;
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
  publishedAt?: string; // ISO timestamp
  closedAt?: string; // ISO timestamp

  // Analytics & Risk placeholders
  mpName: string;
  proposalsCount: number;
  anomaliesCount?: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical';
  contactPerson?: {
    name: string;
    designation: string;
    email: string;
  };
}

// Form submission input structure for Create / Edit
export interface TenderFormData {
  title: string;
  description: string;
  category: TenderCategory;
  subCategory?: string;
  issuingAuthority: string;
  department: string;
  state: string;
  district: string;
  constituency: string;
  projectLocation: string;
  latitude?: number;
  longitude?: number;
  sanctionedAmount: number;
  estimatedValue: number;
  durationValue: number;
  durationUnit: DurationUnit;
  publicationDate: string;
  closingDate?: string;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  specialRequirements?: string;
  mpName?: string;
}

// Immutable append-only audit event
export type TenderAuditEventAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PUBLISHED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface TenderAuditEvent {
  eventId: string;
  tenderId: string;
  action: TenderAuditEventAction;
  actorId: string;
  actorRole: 'government' | 'system';
  actorName: string;
  actorEmail?: string;
  timestamp: string;
  previousStatus?: TenderStatus | null;
  newStatus: TenderStatus;
  notes?: string;
  metadata?: Record<string, any>;
}

// Filter parameters for Tender queries
export interface TenderFilters {
  searchQuery?: string;
  status?: string; // 'ALL' | TenderStatus
  category?: string; // 'ALL' | TenderCategory
  district?: string; // 'ALL' | district name
  startDate?: string;
  endDate?: string;
  createdByMe?: boolean;
}

// Controlled Subcategories Map
export const TENDER_CATEGORIES_MAP: Record<CanonicalTenderCategory, string[]> = {
  'Road Infrastructure': [
    'Road Construction & Paving',
    'Road Repair & Resurfacing',
    'Bridge & Culvert Construction',
    'Storm Water Drainage & Kerbs',
    'Rural PMGSY Connecting Link',
  ],
  'Education': [
    'School Building Construction',
    'Additional Classrooms & Science Labs',
    'Digital Smart Classroom & Library',
    'Educational Sanitation & Drinking Water Units',
    'Hostel & Anganwadi Infrastructure',
  ],
  'Healthcare': [
    'Primary Health Centre (PHC) Upgrade',
    'Community Health Sub-Centre Building',
    'Maternity & Pediatric Care Wing',
    'Diagnostic Lab & Emergency Medical Station',
    'Ayushman Arogya Mandir Infrastructure',
  ],
  'Water & Sanitation': [
    'Piped Drinking Water Supply Network',
    'Community Borewell & Solar RO Filtration Plant',
    'Rainwater Harvesting & Recharge Well',
    'Community Sanitary Complex (CSC)',
    'Rural Overhead Water Tank Installation',
  ],
  'Public Buildings': [
    'Panchayat Bhawan / Gram Sachivalaya',
    'Multi-Purpose Community Hall & Disaster Shelter',
    'Citizen Service & Digital Common Service Centre',
    'Public Crematorium / Burial Ground Amenities',
    'Anganwadi Kendra Permanent Building',
  ],
  'Electricity': [
    'Solar High-Mast Street Lighting System',
    'Rural Off-Grid Solar Power Unit',
    'Distribution Line & Transformer Augmentation',
    'Rooftop Solar for Government Schools & Hospitals',
    'LED Energy Efficient Village Lighting',
  ],
  'Community Infrastructure': [
    'Public Recreation Park & Open Air Gym',
    'Rural Weekly Haat / Farmers Market Shed',
    'Bus Shelter & Passenger Waiting Shed',
    'Solid & Liquid Waste Segregation Shed',
    'Community Sports Facility / Youth Club Ground',
  ],
  'Agriculture': [
    'Agro-Produce Cold Storage & Micro-Godown',
    'Check Dam & Micro-Irrigation Canal Lining',
    'Cattle Shelter & Veterinary First Aid Centre',
    'Farmer Aggregation & Processing Facility',
    'Farm Pond & Watershed Development',
  ],
  'Other': [
    'Special Constituency Development Work',
    'Disaster Mitigation & Flood Protection Retaining Wall',
    'Barrier-Free Access & Ramp Construction for Divyangjan',
    'Public Cemetery Boundary & Illumination',
  ],
};

// Lifecycle transition rules
export const VALID_STATUS_TRANSITIONS: Record<CanonicalTenderStatus, CanonicalTenderStatus[]> = {
  DRAFT: ['PUBLISHED', 'LIVE', 'CANCELLED'],
  PUBLISHED: ['LIVE', 'CLOSED', 'CANCELLED'],
  LIVE: ['CLOSED', 'CANCELLED'],
  CLOSED: ['UNDER_EVALUATION', 'ARCHIVED'],
  UNDER_EVALUATION: ['AWARDED', 'CANCELLED'],
  AWARDED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [], // Terminal state
};

export function canTransitionStatus(current: TenderStatus, next: TenderStatus): boolean {
  if (current === next) return true;
  const normCurrent = (current === 'Open' ? 'LIVE' : current.toUpperCase().replace(/\s+/g, '_')) as CanonicalTenderStatus;
  const normNext = (next === 'Open' ? 'LIVE' : next.toUpperCase().replace(/\s+/g, '_')) as CanonicalTenderStatus;
  const allowed = VALID_STATUS_TRANSITIONS[normCurrent] || [];
  return allowed.includes(normNext);
}

// Automatic closing check: Evaluates if an active tender has expired past its closingDate
export function getEffectiveTenderStatus(tender: Tender): TenderStatus {
  if (tender.status === 'LIVE' || tender.status === 'PUBLISHED' || tender.status === 'Open') {
    if (tender.closingDate) {
      const dateStr = tender.closingDate.includes('T') ? tender.closingDate : `${tender.closingDate}T23:59:59.999Z`;
      const closingTime = new Date(dateStr).getTime();
      if (!isNaN(closingTime) && Date.now() >= closingTime) {
        return 'CLOSED';
      }
    }
  }
  return tender.status;
}

// Phase 3B: Agency Tender Discovery & Deterministic Matching Types
export type TenderMatchTier = 'HIGH' | 'MODERATE' | 'LOW';

export interface TenderMatchFactorItem {
  id: string;
  name: string;
  matched: boolean;
  scoreAwarded: number;
  maxScore: number;
  explanation: string;
  calculationBasis?: string; // Explicit deterministic basis e.g. "Turnover ₹12.5 Cr ÷ Value ₹3.6 Cr = 3.47x ratio"
  type:
    | 'sector_category'
    | 'geographic_jurisdiction'
    | 'operational_capabilities'
    | 'financial_capacity'
    | 'category'
    | 'subcategory'
    | 'state'
    | 'district'
    | 'specialization'
    | 'financial_tier';
}

export interface TenderMatchFactors {
  category: TenderMatchFactorItem;
  subcategory: TenderMatchFactorItem;
  state: TenderMatchFactorItem;
  district: TenderMatchFactorItem;
  specialization: TenderMatchFactorItem;
  financialTier?: TenderMatchFactorItem;
}

export interface TenderMatchResult {
  tenderId: string;
  score: number; // 0 to 100
  tier: TenderMatchTier;
  headline: string; // e.g., "92% Compatibility Score"
  summary: string;
  factors: TenderMatchFactorItem[];
  matchingStrategy: 'RuleBasedMatcher' | 'AIProposalMatcher' | 'CustomMLMatcher';
  calculatedAt: string;
}

export interface TenderFilterState {
  searchQuery: string;
  category: string; // 'ALL' or specific category
  subCategory: string; // 'ALL' or specific subcategory
  state: string; // 'ALL' or state name
  district: string; // 'ALL' or district name
  constituency: string; // 'ALL' or constituency name
  minAmount?: number; // In INR
  maxAmount?: number; // In INR
  closingSoonOnly: boolean;
  maxClosingDays?: number; // e.g. 7, 15, 30
  durationUnit?: string;
  issuingAuthority?: string;
  sortBy: 'recommended' | 'newest' | 'closing_soon' | 'highest_value' | 'lowest_value';
}


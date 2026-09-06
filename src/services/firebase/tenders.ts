// Bharat Tender Intelligence (BTI) — Tender Management & Audit Service
// Phase 3A: Government Tender Lifecycle, Publishing & Append-Only Audit Trail

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, auth } from './firebase';
import {
  Tender,
  TenderFormData,
  TenderStatus,
  TenderAuditEvent,
  TenderFilters,
  getEffectiveTenderStatus,
  canTransitionStatus,
} from '../../types/tender';
import { AuthUser } from '../../types/auth';

/**
 * Safely parses any date, string, or Timestamp into an authoritative Firestore Timestamp.
 * If closingDate is a date string without time (e.g. YYYY-MM-DD), sets the deadline
 * to 23:59:59.999 UTC of that date so the bidding window remains open until the end of that day.
 */
export function parseClosingDateToTimestamp(closingDate: string | Date | Timestamp): Timestamp {
  if (closingDate instanceof Timestamp) {
    return closingDate;
  }
  if (closingDate && typeof (closingDate as any).toDate === 'function') {
    return closingDate as unknown as Timestamp;
  }
  if (closingDate instanceof Date) {
    return Timestamp.fromDate(closingDate);
  }
  if (typeof closingDate === 'string' && closingDate.trim().length > 0) {
    const trimmed = closingDate.trim();
    const isoString = trimmed.includes('T') ? trimmed : `${trimmed}T23:59:59.999Z`;
    const parsedDate = new Date(isoString);
    if (!isNaN(parsedDate.getTime())) {
      return Timestamp.fromDate(parsedDate);
    }
  }
  // Default fallback to 30 days in future if completely invalid
  return Timestamp.fromDate(new Date(Date.now() + 30 * 86400000));
}

/**
 * Formats closingDate from Firestore (Timestamp, Date, or string) into a standard YYYY-MM-DD string
 * to maintain strict compatibility with all React UI elements and input fields.
 */
export function formatClosingDateToString(val: any): string {
  if (!val) return '';
  if (typeof val?.toDate === 'function') {
    return val.toDate().toISOString().split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    return val.split('T')[0];
  }
  return String(val);
}

/**
 * Normalizes raw Firestore document data into a typed Tender object, ensuring closingDate
 * is represented as a reliable string for UI consumption while having been stored
 * as an authoritative Timestamp in Firestore.
 */
export function normalizeTenderFromFirestore(data: Record<string, any>): Tender {
  const closingDateStr = formatClosingDateToString(data.closingDate);
  return {
    ...data,
    closingDate: closingDateStr,
    estimatedCost: data.estimatedCost ?? data.estimatedValue ?? 0,
    status: data.status,
  } as Tender;
}

const TENDERS_STORAGE_KEY = 'bti_tenders_store_v1';
const TENDER_EVENTS_STORAGE_KEY = 'bti_tender_events_v1';
const DEMO_STORAGE_KEY = 'bti_demo_session_v1';

// Initial synthetic seed tenders for Phase 3A
export const SEED_TENDERS: Tender[] = [
  {
    id: 'tnd-mplad-2026-0001',
    tenderNumber: 'BTI/MPLAD/2026/0001',
    title: 'Construction of 4-Lane Paved Connecting Link Road & Storm Water Kerb Drainage',
    description: 'Procurement of comprehensive civil works for construction of 12.4 km rural-to-semi-urban paved link road with bituminous macadam, culverts, storm water kerb drainage, and solar illumination under MPLAD Parliamentary Constituency Sanction.',
    category: 'Road Infrastructure',
    subCategory: 'Road Construction & Paving',
    issuingAuthority: 'Office of the District Magistrate & District Nodal Officer',
    department: 'Public Works Department (PWD), Civil Division',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    constituency: 'Varanasi',
    projectLocation: 'Sewapuri Block to NH-19 Junction Link, Sector 4',
    latitude: 25.3176,
    longitude: 82.9739,
    sanctionedAmount: 48500000, // ₹4.85 Cr
    estimatedValue: 46200000, // ₹4.62 Cr
    estimatedCost: 46200000,
    durationValue: 180,
    durationUnit: 'days',
    publicationDate: '2026-08-15',
    closingDate: '2026-09-30',
    eligibilityCriteria: [
      'Minimum Class-1 Contractor Registration with PWD / CPWD',
      'Successful execution of at least 2 highway / road projects of >= ₹2.5 Cr value in the past 3 financial years',
      'Annual average financial turnover of minimum ₹8.0 Crore in the last 3 financial years (certified by CA)',
      'Active GSTIN registration with no pending compliance notices',
      'Valid Bank Solvency Certificate of minimum ₹1.50 Crore from a Scheduled Commercial Bank',
    ],
    requiredDocuments: [
      'Technical Bid & Scope Execution Methodology Note',
      'Statutory GSTIN Registration & GSTR-3B Tax Filing Certificates (Last 6 Months)',
      'Audited Balance Sheet & Profit & Loss Statement (FY 2023-24, 2024-25, 2025-26)',
      'Work Completion Certificates for Similar Civil Highway Projects',
      'Bank Solvency Certificate from Scheduled Commercial Bank',
      'Non-Blacklisting & Integrity Pact Self-Declaration Affidavit',
    ],
    specialRequirements: 'Work must strictly adhere to MoRTH specifications. Bituminous asphalt batching plant must be located within 40 km radius of project site. Mandatory quality testing at accredited government materials laboratory.',
    status: 'LIVE',
    createdBy: 'usr-gov-001',
    createdByName: 'Dr. Alok Verma, IAS',
    createdByEmail: 'alok.verma@gov.in',
    createdAt: '2026-08-14T09:30:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
    publishedAt: '2026-08-15T10:00:00.000Z',
    mpName: 'Sh. Narendra Modi',
    proposalsCount: 6,
    riskScore: 14,
    riskLevel: 'LOW',
  },
  {
    id: 'tnd-mplad-2026-0002',
    tenderNumber: 'BTI/MPLAD/2026/0002',
    title: 'Upgradation of Primary Health Centre (PHC) into 24x7 Maternal & Pediatric Ward',
    description: 'Turnkey civil construction, electrical renovation, medical gas pipeline installation, and structural refurbishment for upgrading the existing rural Primary Health Centre into an advanced 24x7 institutional maternity and emergency pediatric medical care center.',
    category: 'Healthcare',
    subCategory: 'Primary Health Centre (PHC) Upgrade',
    issuingAuthority: 'Chief Medical Officer & District Health Society',
    department: 'Department of Medical Health & Family Welfare',
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    constituency: 'Lucknow',
    projectLocation: 'Bakshi Ka Talab Community Health Complex',
    latitude: 26.8467,
    longitude: 80.9462,
    sanctionedAmount: 25000000, // ₹2.50 Cr
    estimatedValue: 23500000, // ₹2.35 Cr
    estimatedCost: 23500000,
    durationValue: 120,
    durationUnit: 'days',
    publicationDate: '2026-08-20',
    closingDate: '2026-09-25',
    eligibilityCriteria: [
      'Class-A Certified Medical/Civil Infrastructure Contractor',
      'Minimum 3 years specialized experience in hospital / clinical ward civil works',
      'Average annual turnover of ₹4.0 Crore over past 3 years',
      'Valid GST and EPFO / ESIC registration compliance',
    ],
    requiredDocuments: [
      'Detailed Technical Proposal & Hospital Construction Safety Plan',
      'GSTIN Certificate & IT Returns for last 3 years',
      'Experience Certificates of Hospital/Clinical Civil Construction',
      'Bio-Medical & Electrical Safety Equipment Compliance Undertaking',
    ],
    specialRequirements: 'Civil works must cause zero disruption to the adjoining outpatient dispensary. Anti-microbial floor coatings and medical grade HVAC ducting required.',
    status: 'LIVE',
    createdBy: 'usr-gov-001',
    createdByName: 'Dr. Alok Verma, IAS',
    createdByEmail: 'alok.verma@gov.in',
    createdAt: '2026-08-19T11:00:00.000Z',
    updatedAt: '2026-08-20T08:30:00.000Z',
    publishedAt: '2026-08-20T08:30:00.000Z',
    mpName: 'Sh. Rajnath Singh',
    proposalsCount: 4,
    riskScore: 22,
    riskLevel: 'LOW',
  },
  {
    id: 'tnd-mplad-2026-0003',
    tenderNumber: 'BTI/MPLAD/2026/0003',
    title: 'Installation of Solar RO Drinking Water Plants & Piped Distribution in 12 Villages',
    description: 'Design, supply, installation, testing, and commissioning of 12 numbers of 1000 LPH Solar Photovoltaic-powered Reverse Osmosis (RO) drinking water filtration kiosks with automated smart water ATM card dispensing in water-stressed gram panchayats.',
    category: 'Water & Sanitation',
    subCategory: 'Community Borewell & Solar RO Filtration Plant',
    issuingAuthority: 'Executive Engineer, Rural Water Supply Directorate',
    department: 'Public Health Engineering Department (PHED)',
    state: 'Bihar',
    district: 'Patna',
    constituency: 'Patna Sahib',
    projectLocation: 'Danapur and Fatuha Gram Panchayat Clusters',
    latitude: 25.5941,
    longitude: 85.1376,
    sanctionedAmount: 18000000, // ₹1.80 Cr
    estimatedValue: 17200000, // ₹1.72 Cr
    estimatedCost: 17200000,
    durationValue: 90,
    durationUnit: 'days',
    publicationDate: '2026-09-01',
    closingDate: '2026-10-15',
    eligibilityCriteria: [
      'MNRE approved Solar EPC contractor or Water Purification Solution OEM',
      'Minimum 2 years experience in solar-powered water kiosk installation',
      'Annual turnover of at least ₹3.0 Crore in water purification / renewable energy sector',
      'Authorized service network in Eastern India with 48-hour SLA for repairs',
    ],
    requiredDocuments: [
      'Technical Specification Sheets of Solar PV Panels & RO Membranes',
      'MNRE / BIS Certifications for solar and water filtration components',
      'GSTIN Certificate & Financial Balance Sheets (3 years)',
      '5-Year Comprehensive Maintenance & Service Undertaking',
    ],
    specialRequirements: 'Includes 5 years of mandatory operations & maintenance. Real-time IoT water quality sensors (TDS, pH, flow rate) with automatic cloud telemetry.',
    status: 'DRAFT',
    createdBy: 'usr-gov-001',
    createdByName: 'Dr. Alok Verma, IAS',
    createdByEmail: 'alok.verma@gov.in',
    createdAt: '2026-09-01T14:15:00.000Z',
    updatedAt: '2026-09-03T16:00:00.000Z',
    mpName: 'Sh. Ravi Shankar Prasad',
    proposalsCount: 0,
    riskScore: 8,
    riskLevel: 'LOW',
  },
  {
    id: 'tnd-mplad-2026-0004',
    tenderNumber: 'BTI/MPLAD/2026/0004',
    title: 'Construction of 18 Digital Smart Classrooms & Science Laboratories in Model Schools',
    description: 'Construction of multi-storey earthquake-resistant academic building blocks comprising 18 digitized smart classrooms, 2 composite science laboratories, and separate hygienic sanitation facilities for girls and boys.',
    category: 'Education',
    subCategory: 'Digital Smart Classroom & Library',
    issuingAuthority: 'District Education Officer (DEO) & District Infrastructure Cell',
    department: 'Department of School Education & Literacy',
    state: 'Rajasthan',
    district: 'Jaipur',
    constituency: 'Jaipur Rural',
    projectLocation: 'Govt. Higher Secondary Model School, Shahpura Sector',
    latitude: 26.9124,
    longitude: 75.7873,
    sanctionedAmount: 32000000, // ₹3.20 Cr
    estimatedValue: 30500000, // ₹3.05 Cr
    estimatedCost: 30500000,
    durationValue: 150,
    durationUnit: 'days',
    publicationDate: '2026-07-01',
    closingDate: '2026-08-15', // Passed closing date -> CLOSED
    eligibilityCriteria: [
      'Class-AA Registered Institutional Building Contractor',
      'Prior experience constructing educational buildings under Samagra Shiksha / CPWD',
      'Turnover of ₹5.0 Cr+ over preceding 3 financial years',
    ],
    requiredDocuments: [
      'Technical Architecture & Educational Safety Blueprint',
      'GSTIN & Financial Audit Reports',
      'Structural Stability Engineering Guarantee Certificate',
    ],
    specialRequirements: 'Fire safety compliant as per National Building Code (NBC) Part 4. Divyangjan-friendly accessible ramps on all ground floor entrances.',
    status: 'CLOSED',
    createdBy: 'usr-gov-001',
    createdByName: 'Dr. Alok Verma, IAS',
    createdByEmail: 'alok.verma@gov.in',
    createdAt: '2026-06-28T10:00:00.000Z',
    updatedAt: '2026-08-15T18:00:00.000Z',
    publishedAt: '2026-07-01T09:00:00.000Z',
    closedAt: '2026-08-15T18:00:00.000Z',
    mpName: 'Col. Rajyavardhan Rathore',
    proposalsCount: 8,
    riskScore: 28,
    riskLevel: 'MEDIUM',
  },
  {
    id: 'tnd-mplad-2026-0005',
    tenderNumber: 'BTI/MPLAD/2026/0005',
    title: 'Construction of Multi-Purpose Farmer Produce Aggregation & Cold Storage Shed',
    description: 'Establishment of a 500 MT solar-assisted micro cold room, grading warehouse, and covered auction haat platform for local marginal vegetable and grain producers.',
    category: 'Agriculture',
    subCategory: 'Agro-Produce Cold Storage & Micro-Godown',
    issuingAuthority: 'Deputy Director of Agriculture & District Magistrate Nodal Desk',
    department: 'Department of Agriculture & Farmer Welfare',
    state: 'Maharashtra',
    district: 'Nagpur',
    constituency: 'Nagpur',
    projectLocation: 'Kalmeshwar APMC Sub-Yard Perimeter',
    latitude: 21.1458,
    longitude: 79.0882,
    sanctionedAmount: 21000000, // ₹2.10 Cr
    estimatedValue: 19800000, // ₹1.98 Cr
    estimatedCost: 19800000,
    durationValue: 90,
    durationUnit: 'days',
    publicationDate: '2026-06-01',
    closingDate: '2026-07-10',
    eligibilityCriteria: [
      'Industrial warehouse & cold storage refrigeration contracting license',
      'Minimum ₹3.5 Cr turnover in post-harvest agro-infrastructure',
    ],
    requiredDocuments: [
      'Cold Chain Technology & Thermal Insulation Specification Sheet',
      'Contractor statutory registration & tax certificates',
    ],
    status: 'AWARDED',
    createdBy: 'usr-gov-001',
    createdByName: 'Dr. Alok Verma, IAS',
    createdByEmail: 'alok.verma@gov.in',
    createdAt: '2026-05-25T08:00:00.000Z',
    updatedAt: '2026-07-20T14:30:00.000Z',
    publishedAt: '2026-06-01T09:00:00.000Z',
    closedAt: '2026-07-10T18:00:00.000Z',
    mpName: 'Sh. Nitin Gadkari',
    proposalsCount: 5,
    riskScore: 16,
    riskLevel: 'LOW',
  },
  {
    id: 'tnd-mplad-2026-0006',
    tenderNumber: 'BTI/MPLAD/2026/0006',
    title: 'Construction of 2-Lane Bypass Road & Storm Water Drain Network in Madurai Urban Fringe',
    category: 'Road Infrastructure',
    subCategory: 'Road Construction & Paving',
    description:
      'Civil engineering works for constructing a 2-lane bituminous bypass link connecting national bypass with agricultural wholesale market, complete with concrete storm water drain curbs.',
    issuingAuthority: 'Public Works Department (Highways)',
    projectLocation: 'Madurai Outer Ring Road Link, Madurai District',
    state: 'Tamil Nadu',
    district: 'Madurai',
    constituency: 'Madurai',
    sanctionedAmount: 38000000,
    estimatedValue: 36000000,
    estimatedCost: 36000000,
    currency: 'INR',
    durationValue: 120,
    durationUnit: 'days',
    publicationDate: '2026-08-24',
    closingDate: '2026-09-07', // Closes soon (in 3 days)
    eligibilityCriteria: [
      'Class-1 Highway & Pavement Contractor License from State PWD',
      'Minimum ₹5.0 Cr turnover in preceding 3 financial years',
      'Valid GSTIN registered in Tamil Nadu or Inter-state GST clearance',
    ],
    requiredDocuments: [
      'Bid Security Declaration / EMD Proof',
      'Audited P&L Statements for last 3 FYs',
      'Technical Capability Matrix & Plant Machinery List',
      'Statutory GSTIN & PAN Verification Certificate',
    ],
    status: 'LIVE',
    createdBy: 'usr-gov-001',
    createdByName: 'Dr. Alok Verma, IAS',
    createdByEmail: 'alok.verma@gov.in',
    createdAt: '2026-08-24T09:00:00.000Z',
    updatedAt: '2026-08-24T09:00:00.000Z',
    publishedAt: '2026-08-24T09:00:00.000Z',
    mpName: 'Sh. Su. Venkatesan',
    proposalsCount: 0,
    riskScore: 18,
    riskLevel: 'LOW',
  },
  {
    id: 'tnd-mplad-2026-0007',
    tenderNumber: 'BTI/MPLAD/2026/0007',
    title: 'Community Piped Drinking Water Supply Network & Overhead Service Reservoir',
    category: 'Water & Sanitation',
    subCategory: 'Piped Drinking Water Supply Network',
    description:
      'Installation of 150,000 litre capacity RCC Overhead Reservoir, solar pump booster units, and 12.5 km HDPE piped distribution network across 6 habitations in Patna district.',
    issuingAuthority: 'Public Health Engineering Department (PHED)',
    projectLocation: 'Phulwari Sharif Block, Patna District',
    state: 'Bihar',
    district: 'Patna',
    constituency: 'Patliputra',
    sanctionedAmount: 22000000,
    estimatedValue: 20500000,
    estimatedCost: 20500000,
    currency: 'INR',
    durationValue: 150,
    durationUnit: 'days',
    publicationDate: '2026-08-28',
    closingDate: '2026-09-28',
    eligibilityCriteria: [
      'Specialized PHED or Jal Nigam Registration Category-B or higher',
      'Experience in RCC overhead service reservoirs and rural piping schemes',
    ],
    requiredDocuments: [
      'PHED Contractor Registration Certificate',
      'GSTIN Statutory Clearance Certificate',
      'Past Performance Certificate for Water Supply Networks',
    ],
    status: 'LIVE',
    createdBy: 'usr-gov-001',
    createdByName: 'Dr. Alok Verma, IAS',
    createdByEmail: 'alok.verma@gov.in',
    createdAt: '2026-08-28T11:00:00.000Z',
    updatedAt: '2026-08-28T11:00:00.000Z',
    publishedAt: '2026-08-28T11:00:00.000Z',
    mpName: 'Sh. Ram Kripal Yadav',
    proposalsCount: 0,
    riskScore: 22,
    riskLevel: 'LOW',
  },
];

// Initial synthetic audit events
export const SEED_TENDER_EVENTS: TenderAuditEvent[] = [
  {
    eventId: 'evt-tnd-001-01',
    tenderId: 'tnd-mplad-2026-0001',
    action: 'CREATED',
    actorId: 'usr-gov-001',
    actorRole: 'government',
    actorName: 'Dr. Alok Verma, IAS',
    actorEmail: 'alok.verma@gov.in',
    timestamp: '2026-08-14T09:30:00.000Z',
    previousStatus: null,
    newStatus: 'DRAFT',
    notes: 'Initial tender draft compiled under Varanasi parliamentary allocation.',
  },
  {
    eventId: 'evt-tnd-001-02',
    tenderId: 'tnd-mplad-2026-0001',
    action: 'PUBLISHED',
    actorId: 'usr-gov-001',
    actorRole: 'government',
    actorName: 'Dr. Alok Verma, IAS',
    actorEmail: 'alok.verma@gov.in',
    timestamp: '2026-08-15T10:00:00.000Z',
    previousStatus: 'DRAFT',
    newStatus: 'LIVE',
    notes: 'Statutory tender parameters validated and approved for national public electronic bidding.',
  },
  {
    eventId: 'evt-tnd-002-01',
    tenderId: 'tnd-mplad-2026-0002',
    action: 'CREATED',
    actorId: 'usr-gov-001',
    actorRole: 'government',
    actorName: 'Dr. Alok Verma, IAS',
    actorEmail: 'alok.verma@gov.in',
    timestamp: '2026-08-19T11:00:00.000Z',
    previousStatus: null,
    newStatus: 'DRAFT',
    notes: 'PHC modernization tender created with clinical guidelines.',
  },
  {
    eventId: 'evt-tnd-002-02',
    tenderId: 'tnd-mplad-2026-0002',
    action: 'PUBLISHED',
    actorId: 'usr-gov-001',
    actorRole: 'government',
    actorName: 'Dr. Alok Verma, IAS',
    actorEmail: 'alok.verma@gov.in',
    timestamp: '2026-08-20T08:30:00.000Z',
    previousStatus: 'DRAFT',
    newStatus: 'LIVE',
    notes: 'Published for open bidding following technical committee clearance.',
  },
  {
    eventId: 'evt-tnd-003-01',
    tenderId: 'tnd-mplad-2026-0003',
    action: 'CREATED',
    actorId: 'usr-gov-001',
    actorRole: 'government',
    actorName: 'Dr. Alok Verma, IAS',
    actorEmail: 'alok.verma@gov.in',
    timestamp: '2026-09-01T14:15:00.000Z',
    previousStatus: null,
    newStatus: 'DRAFT',
    notes: 'Saved as draft pending groundwater hydrology depth report.',
  },
  {
    eventId: 'evt-tnd-004-01',
    tenderId: 'tnd-mplad-2026-0004',
    action: 'CREATED',
    actorId: 'usr-gov-001',
    actorRole: 'government',
    actorName: 'Dr. Alok Verma, IAS',
    actorEmail: 'alok.verma@gov.in',
    timestamp: '2026-06-28T10:00:00.000Z',
    previousStatus: null,
    newStatus: 'DRAFT',
    notes: 'Draft created for smart classrooms.',
  },
  {
    eventId: 'evt-tnd-004-02',
    tenderId: 'tnd-mplad-2026-0004',
    action: 'PUBLISHED',
    actorId: 'usr-gov-001',
    actorRole: 'government',
    actorName: 'Dr. Alok Verma, IAS',
    actorEmail: 'alok.verma@gov.in',
    timestamp: '2026-07-01T09:00:00.000Z',
    previousStatus: 'DRAFT',
    newStatus: 'LIVE',
    notes: 'Published tender for school infrastructure.',
  },
  {
    eventId: 'evt-tnd-004-03',
    tenderId: 'tnd-mplad-2026-0004',
    action: 'CLOSED',
    actorId: 'system',
    actorRole: 'system',
    actorName: 'BTI Procurement Engine',
    timestamp: '2026-08-15T18:00:00.000Z',
    previousStatus: 'LIVE',
    newStatus: 'CLOSED',
    notes: 'Tender closed automatically upon reaching submission closing date.',
  },
];

function isDemoSession(): boolean {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getLocalTenders(): Tender[] {
  try {
    const raw = localStorage.getItem(TENDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Tender[];
      const map = new Map<string, Tender>();
      SEED_TENDERS.forEach((t) => map.set(t.id, t));
      parsed.forEach((t) => map.set(t.id, t));
      return Array.from(map.values());
    }
    localStorage.setItem(TENDERS_STORAGE_KEY, JSON.stringify(SEED_TENDERS));
    return SEED_TENDERS;
  } catch {
    return SEED_TENDERS;
  }
}

function saveLocalTenders(tenders: Tender[]): void {
  try {
    localStorage.setItem(TENDERS_STORAGE_KEY, JSON.stringify(tenders));
  } catch (err) {
    console.warn('[BTI LocalStore] Error saving tenders:', err);
  }
}

function getLocalEvents(): TenderAuditEvent[] {
  try {
    const raw = localStorage.getItem(TENDER_EVENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TenderAuditEvent[];
      const map = new Map<string, TenderAuditEvent>();
      SEED_TENDER_EVENTS.forEach((e) => map.set(e.eventId, e));
      parsed.forEach((e) => map.set(e.eventId, e));
      return Array.from(map.values());
    }
    localStorage.setItem(TENDER_EVENTS_STORAGE_KEY, JSON.stringify(SEED_TENDER_EVENTS));
    return SEED_TENDER_EVENTS;
  } catch {
    return SEED_TENDER_EVENTS;
  }
}

function saveLocalEvents(events: TenderAuditEvent[]): void {
  try {
    localStorage.setItem(TENDER_EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn('[BTI LocalStore] Error saving tender events:', err);
  }
}

export class TenderService {
  /**
   * Alias for listTenders for flexible caller compatibility
   */
  static async getTenders(
    userRoleOrFilters?: string | TenderFilters,
    maybeFilters?: TenderFilters
  ): Promise<Tender[]> {
    if (typeof userRoleOrFilters === 'string') {
      return this.listTenders(maybeFilters, userRoleOrFilters);
    }
    return this.listTenders(userRoleOrFilters, undefined);
  }

  /**
   * List tenders with optional filtering and automatic closing evaluation
   */
  static async listTenders(filters?: TenderFilters, userRole?: string): Promise<Tender[]> {
    let rawList: Tender[] = [];
    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      // In authenticated Firebase mode, Firestore is authoritative.
      // We do NOT silently fall back to synthetic local store upon errors or empty results.
      const tendersRef = collection(db, 'tenders');
      let q;
      if (userRole === 'agency') {
        // Query only authoritative active statuses with valid future deadline so the query satisfies Firestore security rules
        q = query(
          tendersRef,
          where('status', 'in', ['PUBLISHED', 'LIVE', 'Open']),
          where('closingDate', '>', Timestamp.now())
        );
      } else {
        // Government and administrative users have full lifecycle visibility
        q = query(tendersRef, orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      rawList = snap.docs.map((d) => normalizeTenderFromFirestore(d.data()));
    } else {
      // Documented demo / offline session fallback only
      rawList = getLocalTenders();
    }

    // Evaluate effective status for all tenders (e.g. automatic closing if current time >= closingDate)
    const normalized = rawList.map((t) => {
      const effectiveStatus = getEffectiveTenderStatus(t);
      if (effectiveStatus !== t.status) {
        return {
          ...t,
          status: effectiveStatus,
          closedAt: t.closedAt || t.closingDate,
        };
      }
      return t;
    });

    // Enforce privacy, lifecycle visibility, and deadline expiration:
    // Agency users can ONLY access active tender opportunities whose deadline has not expired.
    // Explicitly reject: DRAFT, CLOSED, UNDER_EVALUATION, AWARDED, CANCELLED, ARCHIVED, or past closing date
    let filtered = normalized;
    if (userRole === 'agency') {
      filtered = filtered.filter((t) => {
        const eff = getEffectiveTenderStatus(t);
        const isActive = eff === 'LIVE' || eff === 'PUBLISHED' || eff === 'Open';
        let isExpired = false;
        if (t.closingDate) {
          const closeMs = new Date(t.closingDate).getTime();
          if (!isNaN(closeMs) && Date.now() >= closeMs) {
            isExpired = true;
          }
        }
        return isActive && !isExpired;
      });
    } else if (userRole === 'public') {
      filtered = filtered.filter((t) => t.status !== 'DRAFT');
    }

    // Apply filters
    if (filters) {
      if (filters.status && filters.status !== 'ALL') {
        filtered = filtered.filter((t) => {
          if (filters.status === 'LIVE') return t.status === 'LIVE' || t.status === 'PUBLISHED' || t.status === 'Open';
          return t.status === filters.status;
        });
      }

      if (filters.category && filters.category !== 'ALL') {
        filtered = filtered.filter((t) => t.category.toLowerCase() === filters.category!.toLowerCase());
      }

      const anyFilters = filters as Record<string, unknown>;
      if (anyFilters.subCategory && anyFilters.subCategory !== 'ALL') {
        filtered = filtered.filter(
          (t) => (t.subCategory || '').toLowerCase() === String(anyFilters.subCategory).toLowerCase()
        );
      }

      if (anyFilters.state && anyFilters.state !== 'ALL') {
        filtered = filtered.filter(
          (t) => (t.state || '').toLowerCase() === String(anyFilters.state).toLowerCase()
        );
      }

      if (filters.district && filters.district !== 'ALL') {
        filtered = filtered.filter((t) => (t.district || '').toLowerCase() === filters.district!.toLowerCase());
      }

      if (anyFilters.minAmount !== undefined && Number(anyFilters.minAmount) > 0) {
        filtered = filtered.filter((t) => (t.sanctionedAmount || t.estimatedValue || 0) >= Number(anyFilters.minAmount));
      }

      if (anyFilters.maxAmount !== undefined && Number(anyFilters.maxAmount) > 0) {
        filtered = filtered.filter((t) => (t.sanctionedAmount || t.estimatedValue || 0) <= Number(anyFilters.maxAmount));
      }

      if (filters.searchQuery) {
        const sq = filters.searchQuery.toLowerCase().trim();
        filtered = filtered.filter((t) => {
          return (
            t.tenderNumber.toLowerCase().includes(sq) ||
            t.title.toLowerCase().includes(sq) ||
            t.category.toLowerCase().includes(sq) ||
            (t.subCategory || '').toLowerCase().includes(sq) ||
            (t.state || '').toLowerCase().includes(sq) ||
            (t.district || '').toLowerCase().includes(sq) ||
            (t.constituency || '').toLowerCase().includes(sq) ||
            (t.issuingAuthority || '').toLowerCase().includes(sq) ||
            (t.projectLocation || '').toLowerCase().includes(sq)
          );
        });
      }

      if (filters.createdByMe && auth?.currentUser) {
        filtered = filtered.filter((t) => t.createdBy === auth.currentUser?.uid);
      }
    }

    // Sort: newest first
    filtered.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
    return filtered;
  }

  /**
   * Get single tender by ID
   */
  static async getTenderById(tenderId: string, userRole?: string): Promise<Tender | null> {
    let tender: Tender | null = null;
    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      // In authenticated Firebase mode, Firestore is authoritative.
      // If Firestore read fails, propagate the error. Do not silently fall back to local store.
      const tenderRef = doc(db, 'tenders', tenderId);
      const snap = await getDoc(tenderRef);
      if (snap.exists()) {
        tender = normalizeTenderFromFirestore(snap.data());
      } else {
        return null; // Authoritative not found in Firestore
      }
    } else {
      // Demo / offline fallback only
      const locals = getLocalTenders();
      tender = locals.find((t) => t.id === tenderId) || null;
    }

    if (tender) {
      const effective = getEffectiveTenderStatus(tender);
      if (effective !== tender.status) {
        tender = {
          ...tender,
          status: effective,
          closedAt: tender.closedAt || tender.closingDate,
        };
      }

      // Security & Expiration check:
      // Agency users can ONLY access active tender opportunities whose deadline has not expired.
      // Explicitly reject/return null for: DRAFT, CLOSED, UNDER_EVALUATION, AWARDED, CANCELLED, ARCHIVED, expired
      if (userRole === 'agency') {
        const eff = getEffectiveTenderStatus(tender);
        const isActive = eff === 'LIVE' || eff === 'PUBLISHED' || eff === 'Open';
        let isExpired = false;
        if (tender.closingDate) {
          const closeMs = new Date(tender.closingDate).getTime();
          if (!isNaN(closeMs) && Date.now() >= closeMs) {
            isExpired = true;
          }
        }
        if (!isActive || isExpired) {
          return null;
        }
      } else if (userRole === 'public') {
        if (tender.status === 'DRAFT') {
          return null;
        }
      }
    }

    return tender;
  }

  /**
   * Create a new Tender (Draft or Directly Published)
   */
  static async createTender(
    formData: TenderFormData,
    user: AuthUser,
    isDraft: boolean = true
  ): Promise<Tender> {
    // Role Enforcement: Agency users cannot create tenders
    if (user.role !== 'government') {
      throw new Error('Permission Denied: Only authorized government officers can create tenders.');
    }

    // 1. Validation
    if (!formData.title || formData.title.trim().length === 0) {
      throw new Error('Tender title is required.');
    }
    if (!formData.category) {
      throw new Error('Tender category is required.');
    }
    if (!formData.sanctionedAmount || formData.sanctionedAmount <= 0) {
      throw new Error('Sanctioned Amount must be greater than zero.');
    }
    if (!formData.estimatedValue || formData.estimatedValue <= 0) {
      throw new Error('Estimated Value must be greater than zero.');
    }
    if (!formData.projectLocation || formData.projectLocation.trim().length === 0) {
      throw new Error('Project location is required.');
    }
    if (formData.durationValue <= 0) {
      throw new Error('Tender duration must be greater than zero.');
    }

    const pubTime = new Date(formData.publicationDate).getTime();
    const closeTime = new Date(formData.closingDate).getTime();
    if (isNaN(pubTime) || isNaN(closeTime)) {
      throw new Error('Please provide valid publication and closing dates.');
    }
    if (closeTime <= pubTime) {
      throw new Error('Closing date must be strictly after the publication date.');
    }

    if (!isDraft) {
      // Direct publishing checks
      if (!formData.eligibilityCriteria || formData.eligibilityCriteria.length === 0) {
        throw new Error('Eligibility criteria must be specified before publishing.');
      }
      if (!formData.requiredDocuments || formData.requiredDocuments.length === 0) {
        throw new Error('At least one required document must be listed before publishing.');
      }
    }

    // 2. Generate ID and deterministic Tender Number
    const timestamp = Date.now();
    const year = new Date().getFullYear();
    const allTenders = getLocalTenders();
    const counter = String(allTenders.length + 1).padStart(4, '0');
    const tenderNumber = `BTI/MPLAD/${year}/${counter}`;
    const tenderId = `tnd-${timestamp}-${Math.floor(100 + Math.random() * 900)}`;

    const status: TenderStatus = isDraft ? 'DRAFT' : 'LIVE';
    const nowIso = new Date().toISOString();

    const closeTimestamp = parseClosingDateToTimestamp(formData.closingDate);
    const newTender: Tender = {
      id: tenderId,
      tenderNumber,
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      subCategory: formData.subCategory,
      issuingAuthority: formData.issuingAuthority || 'District Magistrate & District Nodal Officer',
      department: formData.department || 'Public Works Department (PWD)',
      state: formData.state,
      district: formData.district,
      constituency: formData.constituency,
      projectLocation: formData.projectLocation.trim(),
      latitude: formData.latitude,
      longitude: formData.longitude,
      sanctionedAmount: formData.sanctionedAmount,
      estimatedValue: formData.estimatedValue,
      estimatedCost: formData.estimatedValue, // alias
      durationValue: formData.durationValue,
      durationUnit: formData.durationUnit,
      publicationDate: formData.publicationDate,
      publishedDate: formData.publicationDate,
      closingDate: formatClosingDateToString(closeTimestamp),
      eligibilityCriteria: formData.eligibilityCriteria,
      requiredDocuments: formData.requiredDocuments,
      specialRequirements: formData.specialRequirements,
      status,
      createdBy: user.id,
      createdByName: user.name || user.email,
      createdByEmail: user.email,
      createdAt: nowIso,
      updatedAt: nowIso,
      publishedAt: isDraft ? undefined : nowIso,
      mpName: formData.mpName || 'District MP Office',
      proposalsCount: 0,
      riskScore: 10,
      riskLevel: 'LOW',
    };

    // 3. Prepare Audit Events
    const createdEvent: TenderAuditEvent = {
      eventId: `evt-${Date.now()}-created`,
      tenderId,
      action: 'CREATED',
      actorId: user.id,
      actorRole: 'government',
      actorName: user.name || user.email,
      actorEmail: user.email,
      timestamp: nowIso,
      previousStatus: null,
      newStatus: isDraft ? 'DRAFT' : 'LIVE',
      notes: isDraft
        ? 'Tender draft created and saved in private workspace.'
        : 'Tender created and published immediately for bidding.',
    };

    // 4. Atomic Commit (Tender State + Audit Trail)
    // In an authenticated Firebase session, authoritative writes MUST succeed atomically.
    // We use writeBatch so that the tender state and audit events are committed together.
    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      const batch = writeBatch(db);
      const tenderRef = doc(db, 'tenders', tenderId);
      // Persist closingDate as an authoritative Firestore Timestamp for database-level deadline enforcement
      const firestorePayload = {
        ...newTender,
        closingDate: closeTimestamp,
      };
      batch.set(tenderRef, firestorePayload);

      const createdEventRef = doc(db, 'tenderEvents', createdEvent.eventId);
      batch.set(createdEventRef, createdEvent);

      await batch.commit();
    }

    // Update local cache / demo session store
    const locals = getLocalTenders();
    locals.unshift(newTender);
    saveLocalTenders(locals);

    const allEvents = getLocalEvents();
    allEvents.push(createdEvent);
    saveLocalEvents(allEvents);

    return newTender;
  }

  /**
   * Edit a DRAFT tender
   */
  static async updateTenderDraft(
    tenderId: string,
    formData: Partial<TenderFormData>,
    user: AuthUser
  ): Promise<Tender> {
    if (user.role !== 'government') {
      throw new Error('Permission Denied: Only authorized government officers can modify tenders.');
    }

    const tender = await this.getTenderById(tenderId);
    if (!tender) {
      throw new Error('Tender not found.');
    }

    if (tender.status !== 'DRAFT') {
      throw new Error('Active or Closed tenders cannot have core procurement specifications modified directly.');
    }

    if (formData.sanctionedAmount !== undefined && formData.sanctionedAmount <= 0) {
      throw new Error('Sanctioned Amount must be greater than zero.');
    }
    if (formData.estimatedValue !== undefined && formData.estimatedValue <= 0) {
      throw new Error('Estimated Value must be greater than zero.');
    }
    if (formData.publicationDate && formData.closingDate) {
      if (new Date(formData.closingDate).getTime() <= new Date(formData.publicationDate).getTime()) {
        throw new Error('Closing date must be strictly after publication date.');
      }
    }

    const nowIso = new Date().toISOString();
    const updated: Tender = {
      ...tender,
      ...formData,
      estimatedCost: formData.estimatedValue !== undefined ? formData.estimatedValue : tender.estimatedCost,
      updatedAt: nowIso,
    };

    const updatedEvent: TenderAuditEvent = {
      eventId: `evt-${Date.now()}-updated`,
      tenderId,
      action: 'UPDATED',
      actorId: user.id,
      actorRole: 'government',
      actorName: user.name || user.email,
      actorEmail: user.email,
      timestamp: nowIso,
      previousStatus: 'DRAFT',
      newStatus: 'DRAFT',
      notes: 'Tender draft parameters updated by authorized nodal desk.',
    };

    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      const batch = writeBatch(db);
      const tenderRef = doc(db, 'tenders', tenderId);
      // Exclude undefined values for strict Firestore payload hygiene
      const payload: Record<string, unknown> = { updatedAt: nowIso };
      for (const [key, value] of Object.entries(formData)) {
        if (value !== undefined) payload[key] = value;
      }
      if (formData.estimatedValue !== undefined) {
        payload.estimatedCost = formData.estimatedValue;
      }
      if (formData.closingDate) {
        payload.closingDate = parseClosingDateToTimestamp(formData.closingDate);
      }
      batch.update(tenderRef, payload);

      const eventRef = doc(db, 'tenderEvents', updatedEvent.eventId);
      batch.set(eventRef, updatedEvent);

      await batch.commit();
    }

    const locals = getLocalTenders().map((t) => (t.id === tenderId ? updated : t));
    saveLocalTenders(locals);

    const allEvents = getLocalEvents();
    allEvents.push(updatedEvent);
    saveLocalEvents(allEvents);

    return updated;
  }

  /**
   * Publish a DRAFT tender to LIVE
   */
  static async publishTender(tenderId: string, user: AuthUser, notes?: string): Promise<Tender> {
    if (user.role !== 'government') {
      throw new Error('Permission Denied: Only authorized government officers can publish tenders.');
    }

    const tender = await this.getTenderById(tenderId);
    if (!tender) {
      throw new Error('Tender not found.');
    }

    if (tender.status !== 'DRAFT') {
      throw new Error(`Cannot publish tender in '${tender.status}' status. Only DRAFT tenders can be published.`);
    }

    // Validate readiness for publication
    if (!tender.title || !tender.category || !tender.sanctionedAmount || !tender.estimatedValue) {
      throw new Error('Incomplete tender specifications. Please complete financial and scope details before publishing.');
    }
    if (!tender.eligibilityCriteria || tender.eligibilityCriteria.length === 0) {
      throw new Error('At least one eligibility criterion is required to publish.');
    }
    if (!tender.requiredDocuments || tender.requiredDocuments.length === 0) {
      throw new Error('Required documents checklist must be defined before publishing.');
    }

    const nowIso = new Date().toISOString();
    const updated: Tender = {
      ...tender,
      status: 'LIVE',
      publishedAt: nowIso,
      updatedAt: nowIso,
    };

    const publishedEvent: TenderAuditEvent = {
      eventId: `evt-${Date.now()}-published`,
      tenderId,
      action: 'PUBLISHED',
      actorId: user.id,
      actorRole: 'government',
      actorName: user.name || user.email,
      actorEmail: user.email,
      timestamp: nowIso,
      previousStatus: 'DRAFT',
      newStatus: 'LIVE',
      notes: notes || 'Tender verified, authorized, and published for national electronic procurement.',
    };

    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      const batch = writeBatch(db);
      const tenderRef = doc(db, 'tenders', tenderId);
      batch.update(tenderRef, {
        status: 'LIVE',
        publishedAt: nowIso,
        updatedAt: nowIso,
      });

      const eventRef = doc(db, 'tenderEvents', publishedEvent.eventId);
      batch.set(eventRef, publishedEvent);

      await batch.commit();
    }

    const locals = getLocalTenders().map((t) => (t.id === tenderId ? updated : t));
    saveLocalTenders(locals);

    const allEvents = getLocalEvents();
    allEvents.push(publishedEvent);
    saveLocalEvents(allEvents);

    return updated;
  }

  /**
   * Close a LIVE tender
   */
  static async closeTender(tenderId: string, user: AuthUser, notes?: string): Promise<Tender> {
    if (user.role !== 'government') {
      throw new Error('Permission Denied: Only authorized government officers can close tenders.');
    }

    const tender = await this.getTenderById(tenderId);
    if (!tender) {
      throw new Error('Tender not found.');
    }

    if (!canTransitionStatus(tender.status, 'CLOSED')) {
      throw new Error(`Invalid status transition from '${tender.status}' to 'CLOSED'.`);
    }

    const nowIso = new Date().toISOString();
    const updated: Tender = {
      ...tender,
      status: 'CLOSED',
      closedAt: nowIso,
      updatedAt: nowIso,
    };

    const closedEvent: TenderAuditEvent = {
      eventId: `evt-${Date.now()}-closed`,
      tenderId,
      action: 'CLOSED',
      actorId: user.id,
      actorRole: 'government',
      actorName: user.name || user.email,
      actorEmail: user.email,
      timestamp: nowIso,
      previousStatus: tender.status,
      newStatus: 'CLOSED',
      notes: notes || 'Tender bidding window officially closed. No further agency proposals will be accepted.',
    };

    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      const batch = writeBatch(db);
      const tenderRef = doc(db, 'tenders', tenderId);
      batch.update(tenderRef, {
        status: 'CLOSED',
        closedAt: nowIso,
        updatedAt: nowIso,
      });

      const eventRef = doc(db, 'tenderEvents', closedEvent.eventId);
      batch.set(eventRef, closedEvent);

      await batch.commit();
    }

    const locals = getLocalTenders().map((t) => (t.id === tenderId ? updated : t));
    saveLocalTenders(locals);

    const allEvents = getLocalEvents();
    allEvents.push(closedEvent);
    saveLocalEvents(allEvents);

    return updated;
  }

  /**
   * Cancel a tender
   */
  static async cancelTender(tenderId: string, user: AuthUser, reason: string): Promise<Tender> {
    if (user.role !== 'government') {
      throw new Error('Permission Denied: Only authorized government officers can cancel tenders.');
    }

    const tender = await this.getTenderById(tenderId);
    if (!tender) {
      throw new Error('Tender not found.');
    }

    if (!canTransitionStatus(tender.status, 'CANCELLED')) {
      throw new Error(`Invalid status transition from '${tender.status}' to 'CANCELLED'.`);
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed cancellation justification note is mandatory for audit compliance.');
    }

    const nowIso = new Date().toISOString();
    const updated: Tender = {
      ...tender,
      status: 'CANCELLED',
      updatedAt: nowIso,
    };

    const cancelledEvent: TenderAuditEvent = {
      eventId: `evt-${Date.now()}-cancelled`,
      tenderId,
      action: 'CANCELLED',
      actorId: user.id,
      actorRole: 'government',
      actorName: user.name || user.email,
      actorEmail: user.email,
      timestamp: nowIso,
      previousStatus: tender.status,
      newStatus: 'CANCELLED',
      notes: `Tender officially cancelled by administrative action. Reason: ${reason}`,
    };

    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      const batch = writeBatch(db);
      const tenderRef = doc(db, 'tenders', tenderId);
      batch.update(tenderRef, {
        status: 'CANCELLED',
        updatedAt: nowIso,
      });

      const eventRef = doc(db, 'tenderEvents', cancelledEvent.eventId);
      batch.set(eventRef, cancelledEvent);

      await batch.commit();
    }

    const locals = getLocalTenders().map((t) => (t.id === tenderId ? updated : t));
    saveLocalTenders(locals);

    const allEvents = getLocalEvents();
    allEvents.push(cancelledEvent);
    saveLocalEvents(allEvents);

    return updated;
  }

  /**
   * Archive an awarded or closed tender
   */
  static async archiveTender(tenderId: string, user: AuthUser, notes?: string): Promise<Tender> {
    if (user.role !== 'government') {
      throw new Error('Permission Denied: Only authorized government officers can archive tenders.');
    }
    const tender = await this.getTenderById(tenderId);
    if (!tender) {
      throw new Error('Tender not found.');
    }

    if (!canTransitionStatus(tender.status, 'ARCHIVED')) {
      throw new Error(`Invalid status transition from '${tender.status}' to 'ARCHIVED'.`);
    }

    const nowIso = new Date().toISOString();
    const updated: Tender = {
      ...tender,
      status: 'ARCHIVED',
      updatedAt: nowIso,
    };

    const archivedEvent: TenderAuditEvent = {
      eventId: `evt-${Date.now()}-archived`,
      tenderId,
      action: 'ARCHIVED',
      actorId: user.id,
      actorRole: 'government',
      actorName: user.name || user.email,
      actorEmail: user.email,
      timestamp: nowIso,
      previousStatus: tender.status,
      newStatus: 'ARCHIVED',
      notes: notes || 'Tender record moved to immutable historical archive.',
    };

    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      const batch = writeBatch(db);
      const tenderRef = doc(db, 'tenders', tenderId);
      batch.update(tenderRef, {
        status: 'ARCHIVED',
        updatedAt: nowIso,
      });

      const eventRef = doc(db, 'tenderEvents', archivedEvent.eventId);
      batch.set(eventRef, archivedEvent);

      await batch.commit();
    }

    const locals = getLocalTenders().map((t) => (t.id === tenderId ? updated : t));
    saveLocalTenders(locals);

    const allEvents = getLocalEvents();
    allEvents.push(archivedEvent);
    saveLocalEvents(allEvents);

    return updated;
  }

  /**
   * Get append-only audit events for a tender
   */
  static async getTenderAuditEvents(tenderId: string): Promise<TenderAuditEvent[]> {
    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      // In authenticated Firebase mode, Firestore is authoritative.
      // We do NOT fall back to local synthetic events if the audit trail is empty or if read fails.
      const eventsRef = collection(db, 'tenderEvents');
      const q = query(eventsRef, where('tenderId', '==', tenderId), orderBy('timestamp', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as TenderAuditEvent);
    }

    // Explicit demo / offline mode only
    const allEvents = getLocalEvents();
    const events = allEvents.filter((e) => e.tenderId === tenderId);
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return events;
  }

  /**
   * Append an immutable audit event
   */
  private static async recordAuditEvent(event: TenderAuditEvent): Promise<void> {
    if (event.actorRole !== 'government' && event.actorRole !== 'system') {
      throw new Error('Permission Denied: Agency users cannot write to tender audit events.');
    }

    const isLiveAuthSession = isFirebaseConfigured && !isDemoSession() && db && auth?.currentUser;

    if (isLiveAuthSession) {
      const eventRef = doc(db, 'tenderEvents', event.eventId);
      await setDoc(eventRef, event);
    }

    const allEvents = getLocalEvents();
    allEvents.push(event);
    saveLocalEvents(allEvents);
  }
}

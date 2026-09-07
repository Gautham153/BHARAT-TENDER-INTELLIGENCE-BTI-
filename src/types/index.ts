// Bharat Tender Intelligence (BTI) — Domain Types & Interfaces
// Phase 0 & 1A: Master Foundation Type Architecture

import { Tender, TenderCategory, TenderStatus } from './tender';

export * from './auth';
export * from './organization';
export * from './tender';
export * from './proposal';

export type UserRole = 'government' | 'agency' | 'public' | 'government_admin' | 'government_officer' | 'agency_user' | 'public_citizen';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  designation?: string;
  agencyId?: string;
  avatarUrl?: string;
  phone?: string;
  verified: boolean;
  createdAt: string;
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'Under Inspection' | 'Completed' | 'Delayed' | 'Halted';

export interface PublicProjectUpdate {
  id: string;
  date: string;
  title: string;
  description: string;
  author: string;
  milestoneReached?: string;
}

export interface ProjectImage {
  id: string;
  url: string;
  caption: string;
  uploadedAt: string;
  geoTag?: {
    lat: number;
    lng: number;
    verified: boolean;
  };
  aiAnalysis?: {
    detectedProgressPct: number;
    concurrenceScore: number;
    labels: string[];
  };
}

export interface Inspection {
  id: string;
  inspectionDate: string;
  inspectorName: string;
  inspectorDesignation: string;
  status: 'Passed' | 'Action Required' | 'Irregularity Found';
  findings: string;
  images: string[];
}

export interface Project {
  id: string;
  projectCode: string;
  title: string;
  description: string;
  tenderId?: string;
  tenderNumber?: string;
  assignedAgencyId?: string;
  executingAgencyName: string;
  agencyName?: string;
  constituency: string;
  state: string;
  district: string;
  lat: number;
  lng: number;
  locationCoordinates?: {
    lat: number;
    lng: number;
    address: string;
  };
  category: TenderCategory;
  sanctionedBudget: number;
  amountDisbursed: number;
  disbursedAmount?: number;
  utilizedAmount?: number;
  physicalProgress: number; // 0-100%
  financialProgress: number; // 0-100%
  startDate?: string;
  targetCompletionDate: string;
  actualCompletionDate?: string;
  status: ProjectStatus;
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical';
  riskSignals?: string[];
  beneficiariesCount?: number;
  mpName: string;
  lastUpdated?: string;
  updates?: PublicProjectUpdate[];
  images?: ProjectImage[];
  inspections?: Inspection[];
}

export interface AnomalyAlert {
  id: string;
  title: string;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  riskScore: number;
  confidenceScore: number;
  tenderId?: string;
  tenderNumber?: string;
  tenderTitle?: string;
  projectId?: string;
  projectTitle?: string;
  detectedAt: string;
  evidenceSummary: string;
  evidenceDetails?: string[];
  status: 'New' | 'Under Review' | 'Escalated' | 'Resolved' | 'Dismissed';
}

export interface InvestigationCase {
  id: string;
  caseNumber: string;
  title: string;
  summary: string;
  tenderNumber: string;
  projectCode?: string;
  agencyNames: string[];
  assignedInvestigator: string;
  riskScore: number;
  status: 'Inquiry Initiated' | 'FIR Registered' | 'Notice Issued' | 'Under Investigation' | 'Charge Sheeted';
  openedDate: string;
  lastUpdatedDate: string;
  evidenceCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actorName: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  hashFingerprint: string;
  verified: boolean;
  status?: string;
  details?: string;
}

export interface Agency {
  id: string;
  name: string;
  registrationNumber: string;
  gstNumber: string;
  panNumber: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  state: string;
  yearEstablished: number;
  isVerified: boolean;
  activeProjectsCount: number;
  completedProjectsCount: number;
  totalAwardedValue: number;
  riskScore: number;
  complianceRating: number;
  categorySpecialization: TenderCategory[];
  blacklisted: boolean;
}

export interface Report {
  id: string;
  title: string;
  type: string;
  generatedDate: string;
  period: string;
  fileFormat: 'PDF' | 'XLSX';
  fileSize: string;
  status: 'Ready' | 'Generating';
}

export interface OpportunityMatch {
  tender: Tender;
  matchScore: number;
  reasons: string[];
}

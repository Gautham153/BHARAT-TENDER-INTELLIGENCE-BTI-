// Bharat Tender Intelligence (BTI) — Domain Types & Interfaces
// Phase 0: Master Foundation Type Architecture

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

export type TenderStatus = 'Open' | 'Closed' | 'In Evaluation' | 'Under Evaluation' | 'Awarded' | 'Cancelled';
export type TenderCategory =
  | 'Civil Infrastructure'
  | 'Water & Sanitation'
  | 'Drinking Water Project'
  | 'Health & Sanitation'
  | 'Healthcare Infrastructure'
  | 'Education & Schools'
  | 'Educational Facilities'
  | 'Rural Electrification'
  | 'Rural Road Construction'
  | 'Community Facilities'
  | 'Community Infrastructure';

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
  tenderNumber: string;
  title: string;
  description: string;
  department?: string;
  constituency: string;
  state: string;
  district?: string;
  mpName: string;
  category: TenderCategory;
  budget?: number;
  estimatedCost: number; // in INR
  publishedDate: string;
  submissionDeadline?: string;
  closingDate: string;
  status: TenderStatus;
  proposalsCount: number;
  anomaliesCount?: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical';
  createdBy?: string;
  eligibilityCriteria?: string[];
  scopeOfWork?: string;
  documents?: Document[];
  estimatedDurationMonths?: number;
  contactPerson?: {
    name: string;
    designation: string;
    email: string;
  };
}

export type ProposalStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Under Evaluation' | 'Shortlisted' | 'Awarded' | 'Rejected';

export interface Proposal {
  id: string;
  proposalNumber: string;
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  agencyId: string;
  agencyName: string;
  agencyGstin: string;
  agencyGst?: string;
  agencyRating?: number;
  financialBidAmount: number;
  quotedAmount?: number;
  technicalScore: number;
  aiEvaluationScore: number;
  collusionRiskScore: number;
  collusionRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical';
  submissionDate: string;
  status: ProposalStatus;
  flags?: string[];
  technicalApproach?: string;
  implementationPlan?: string;
  experienceSummary?: string;
  aiAssessment?: {
    matchScore: number;
    riskScore: number;
    priceDeviationPct: number;
    financialFeasibility: 'Optimal' | 'Caution' | 'Anomalous';
    experienceRelevance: 'High' | 'Moderate' | 'Low';
    flaggedKeywords: string[];
    summary: string;
    verifiedGstActive: boolean;
  };
  documents?: Document[];
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

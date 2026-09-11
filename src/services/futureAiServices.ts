// Bharat Tender Intelligence (BTI) — Future AI Service Contracts
// Phase 0 Architecture: Abstractions and interfaces for future Gemini / Custom ML integrations

import { Tender, Proposal, Project } from '../types';

export interface AnomalyDetectionRequest {
  projectId: string;
  transactions?: unknown[];
  milestones?: unknown[];
  budgetHistory?: unknown[];
}

export interface AnomalyDetectionResponse {
  projectId: string;
  detectedAnomalies: unknown[];
  confidenceScore: number;
  engineVersion: string;
}

export interface ProposalEvaluationRequest {
  tender: Tender;
  proposal: Proposal;
  agencyHistory: unknown;
}

export interface ProposalEvaluationResponse {
  matchScore: number;
  riskScore: number;
  priceDeviationPct: number;
  technicalViabilityScore: number;
  keyInsights: string[];
  suggestedAction: 'Recommended' | 'Requires Verification' | 'High Scrutiny';
}

export interface DocumentIntelligenceRequest {
  documentId: string;
  documentUrl: string;
  documentType: 'GST_CERTIFICATE' | 'PAN' | 'TECHNICAL_BID' | 'FINANCIAL_BID' | 'WORK_COMPLETION';
}

export interface DocumentIntelligenceResponse {
  documentId: string;
  isAuthentic: boolean;
  extractedFields: Record<string, string | number>;
  mismatchesFound: string[];
}

export interface ImageIntelligenceRequest {
  projectId: string;
  imageUrl: string;
  claimedProgressPct: number;
  locationCoordinates: { lat: number; lng: number };
}

export interface ImageIntelligenceResponse {
  detectedProgressPct: number;
  confidence: number;
  anomalyDetected: boolean;
  geoTagMatches: boolean;
  detectedObjects: string[];
}

export const FUTURE_AI_CAPABILITIES = [
  {
    name: 'Bidder Collusion & Cartel Graph Network',
    model: 'BTI-Graph-v2 + Gemini 2.5 Flash',
    purpose: 'Detects cross-director commonalities, common IP origins, and rotating win-loss patterns',
  },
  {
    name: 'DSR BoQ Rate Variance Outlier Detection',
    model: 'BTI-Cost-Statistical-Engine',
    purpose: 'Flags line items quoted significantly above CPWD / State Schedule of Rates',
  },
  {
    name: 'Geo-Tagged Site Photo EXIF & Concurrence Scanner',
    model: 'BTI-Vision-Classifier',
    purpose: 'Validates satellite texture delta and site image GPS coordinates against geo-fence',
  },
  {
    name: 'Automated FIR & Vigilance Dossier Generation',
    model: 'Gemini 2.5 Pro Document Synth',
    purpose: 'Compiles CVC-compliant investigative case briefs with cryptographically signed trails',
  },
];

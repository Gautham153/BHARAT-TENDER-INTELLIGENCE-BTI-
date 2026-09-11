// Bharat Tender Intelligence (BTI) — Deterministic Tender Matching Engine
// Phase 3B Pre-Lock Architecture: 4 Major Deterministic Criteria (100 Points Total)
//
// 1. Sector & Category Alignment (Max: 35 pts)
//    - Primary Sector Match: 25 pts
//    - Scope & Subcategory Alignment: 10 pts
// 2. Geographic Jurisdiction (Max: 25 pts)
//    - State Jurisdiction: 15 pts
//    - District & Regional Operational Base: 10 pts
// 3. Operational Capabilities (Max: 20 pts)
//    - Verified Technical Specialization Overlap: 20 pts
// 4. Financial Capacity Ratio (Max: 20 pts)
//    - Ratio = Organization Annual Turnover / Tender Estimated Value
//    - Thresholds:
//      * Ratio >= 3.0x: 20 pts (Superior financial capacity)
//      * Ratio >= 1.5x: 15 pts (Strong financial capacity)
//      * Ratio >= 1.0x: 10 pts (Adequate capacity meeting project scale)
//      * Ratio >= 0.5x:  5 pts (Marginal capacity)
//      * Ratio < 0.5x:   0 pts (Insufficient annual turnover)
//
// Note: Pluggable design (ITenderMatcher) enables clean substitution by future AI/ML matchers
// without breaking UI consumers. Strictly deterministic, rule-based, and explainable. No LLM invocation.

import {
  Tender,
  TenderMatchResult,
  TenderMatchFactorItem,
  TenderMatchTier,
} from '../../types/tender.js';
import { Organization } from '../../types/organization.js';

/**
 * Authoritative, immutable deterministic matching weights summing to exactly 100.
 * Fixed Phase 3B deterministic scoring model: 35 / 25 / 20 / 20 = 100 pts.
 */
export const BTI_DETERMINISTIC_WEIGHTS = {
  sectorCategoryWeight: 35,
  geographicJurisdictionWeight: 25,
  operationalCapabilitiesWeight: 20,
  financialCapacityWeight: 20,
} as const;

export type MajorMatchingWeights = typeof BTI_DETERMINISTIC_WEIGHTS;

export const DEFAULT_MAJOR_MATCHING_WEIGHTS: MajorMatchingWeights = BTI_DETERMINISTIC_WEIGHTS;

/**
 * Documented Financial Capacity Scoring Thresholds
 */
export interface FinancialCapacityThreshold {
  minRatio: number;
  score: number;
  label: string;
  description: string;
}

export const FINANCIAL_CAPACITY_THRESHOLDS: FinancialCapacityThreshold[] = [
  {
    minRatio: 3.0,
    score: 20,
    label: 'Ratio ≥ 3.0x (Superior Capacity)',
    description: 'Annual verified turnover exceeds 300% of tender estimated value, providing excellent execution buffer.',
  },
  {
    minRatio: 1.5,
    score: 15,
    label: 'Ratio ≥ 1.5x (Strong Capacity)',
    description: 'Annual verified turnover exceeds 150% of tender estimated value, demonstrating strong financial qualification.',
  },
  {
    minRatio: 1.0,
    score: 10,
    label: 'Ratio ≥ 1.0x (Adequate Capacity)',
    description: 'Annual verified turnover meets or exceeds 100% of tender estimated value, satisfying standard capacity benchmarks.',
  },
  {
    minRatio: 0.5,
    score: 5,
    label: 'Ratio ≥ 0.5x (Marginal Capacity)',
    description: 'Annual verified turnover covers 50%–99% of tender estimated value, representing marginal financial bandwidth.',
  },
  {
    minRatio: 0.0,
    score: 0,
    label: 'Ratio < 0.5x (Insufficient Capacity)',
    description: 'Annual verified turnover is below 50% of tender estimated value or unverified, falling below standard turnover thresholds.',
  },
];

/**
 * Interface for pluggable tender matching strategies.
 */
export interface ITenderMatcher {
  readonly strategyName: 'RuleBasedMatcher' | 'AIProposalMatcher' | 'CustomMLMatcher';
  calculateMatch(tender: Tender, organization?: Organization | null): TenderMatchResult;
  batchMatch(tenders: Tender[], organization?: Organization | null): Map<string, TenderMatchResult>;
}

/**
 * Helper to format currency for explanation strings (Crores and Lakhs)
 */
function formatCurrencyCr(amountInInr: number): string {
  if (amountInInr >= 10000000) {
    const cr = amountInInr / 10000000;
    return `₹${cr.toFixed(2)} Cr`;
  }
  if (amountInInr >= 100000) {
    const lk = amountInInr / 100000;
    return `₹${lk.toFixed(2)} Lakh`;
  }
  return `₹${amountInInr.toLocaleString('en-IN')}`;
}

/**
 * Deterministic, rule-based tender compatibility matcher.
 * Contains exactly 4 inspectable criteria summing to 100 points.
 * All weights are immutable constants (35 / 25 / 20 / 20 = 100).
 */
export class RuleBasedTenderMatcher implements ITenderMatcher {
  public readonly strategyName = 'RuleBasedMatcher';
  public readonly weights: MajorMatchingWeights = BTI_DETERMINISTIC_WEIGHTS;

  /**
   * Helper to normalize sector/category terms for robust deterministic comparison
   */
  private normalizeCategory(cat?: string): string {
    if (!cat) return '';
    const lower = cat.toLowerCase().trim();
    if (lower.includes('road') || lower.includes('highway') || lower.includes('civil')) return 'civil_roads';
    if (lower.includes('water') || lower.includes('sanitation') || lower.includes('ro plant')) return 'water_sanitation';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('hospital')) return 'healthcare';
    if (lower.includes('education') || lower.includes('school') || lower.includes('classroom')) return 'education';
    if (lower.includes('electric') || lower.includes('solar') || lower.includes('power')) return 'electricity';
    if (lower.includes('agri') || lower.includes('cold storage') || lower.includes('farm')) return 'agriculture';
    if (lower.includes('building') || lower.includes('panchayat') || lower.includes('community')) return 'public_buildings';
    return lower;
  }

  public calculateMatch(tender: Tender, organization?: Organization | null): TenderMatchResult {
    const factors: TenderMatchFactorItem[] = [];
    let totalScore = 0;

    if (!organization) {
      return {
        tenderId: tender.id,
        score: 0,
        tier: 'LOW',
        headline: 'Profile Data Required',
        summary: 'Organization profile details are required to calculate deterministic compatibility.',
        factors: [
          {
            id: 'f-profile',
            name: 'Organization Profile',
            matched: false,
            scoreAwarded: 0,
            maxScore: 100,
            explanation: 'No registered organization profile linked to current session.',
            calculationBasis: 'Session lacks authenticated organization credentials.',
            type: 'sector_category',
          },
        ],
        matchingStrategy: this.strategyName,
        calculatedAt: new Date().toISOString(),
      };
    }

    const orgCategoryNorm = this.normalizeCategory(organization.businessCategory);
    const tenderCategoryNorm = this.normalizeCategory(tender.category);

    // =========================================================================
    // CRITERION 1: Sector & Category Alignment (Max: 35 points)
    // =========================================================================
    // Subcomponent 1A: Primary Category Match (25 pts)
    const isCategoryMatch = orgCategoryNorm !== '' && orgCategoryNorm === tenderCategoryNorm;
    const categoryBaseScore = isCategoryMatch ? 25 : 0;

    // Subcomponent 1B: Subcategory & Specialized Scope Alignment (10 pts)
    let subcategoryMatched = false;
    let subcategoryDetail = '';

    if (tender.subCategory && organization.specializations && organization.specializations.length > 0) {
      const matchFound = organization.specializations.some(
        (spec) =>
          spec.toLowerCase().includes(tender.subCategory!.toLowerCase()) ||
          tender.subCategory!.toLowerCase().includes(spec.toLowerCase())
      );
      if (matchFound) {
        subcategoryMatched = true;
        subcategoryDetail = `Scope "${tender.subCategory}" directly matches registered specializations.`;
      }
    } else if (isCategoryMatch && tender.subCategory) {
      subcategoryMatched = true;
      subcategoryDetail = `Scope "${tender.subCategory}" falls within standard ${organization.businessCategory} works.`;
    } else if (isCategoryMatch && !tender.subCategory) {
      subcategoryMatched = true;
      subcategoryDetail = 'General works scope matches registered classification.';
    }

    if (!subcategoryMatched) {
      subcategoryDetail = tender.subCategory
        ? `Scope "${tender.subCategory}" is outside primary documented specializations.`
        : 'Specific subcategory details not specified in procurement notice.';
    }

    const subcategoryScore = subcategoryMatched ? 10 : 0;
    const sectorTotalScore = categoryBaseScore + subcategoryScore;
    totalScore += sectorTotalScore;

    factors.push({
      id: 'f-sector-category',
      name: 'Sector & Category Alignment',
      matched: sectorTotalScore >= 25,
      scoreAwarded: sectorTotalScore,
      maxScore: BTI_DETERMINISTIC_WEIGHTS.sectorCategoryWeight,
      explanation: isCategoryMatch
        ? `Tender category (${tender.category}) matches registered classification (${organization.businessCategory}). ${subcategoryDetail}`
        : `Tender category (${tender.category}) differs from registered business classification (${organization.businessCategory}). ${subcategoryDetail}`,
      calculationBasis: `Category match: ${categoryBaseScore}/25 pts + Subcategory alignment: ${subcategoryScore}/10 pts = ${sectorTotalScore}/35 pts awarded.`,
      type: 'sector_category',
    });

    // =========================================================================
    // CRITERION 2: Geographic Jurisdiction (Max: 25 points)
    // =========================================================================
    // Subcomponent 2A: State Jurisdiction Match (15 pts)
    const orgState = (organization.state || '').trim().toLowerCase();
    const tenderState = (tender.state || '').trim().toLowerCase();
    const isStateMatch = orgState.length > 0 && orgState === tenderState;
    const stateScore = isStateMatch ? 15 : 0;

    // Subcomponent 2B: District & Regional Base Match (10 pts)
    let isDistrictMatch = false;
    let districtScore = 0;
    let districtDetail = '';
    const tenderDistrict = (tender.district || '').trim().toLowerCase();

    const isOperatingRegion = organization.operatingRegions?.some(
      (r) => r.toLowerCase() === tenderState || (tenderDistrict && r.toLowerCase() === tenderDistrict)
    );

    const isInRegisteredAddress =
      tenderDistrict.length > 0 && organization.registeredAddress.toLowerCase().includes(tenderDistrict);

    if (tenderDistrict && (organization.district?.toLowerCase() === tenderDistrict || isInRegisteredAddress)) {
      isDistrictMatch = true;
      districtScore = 10;
      districtDetail = `Headquarters base in ${tender.district} provides local execution advantage.`;
    } else if (isOperatingRegion) {
      isDistrictMatch = true;
      districtScore = 10;
      districtDetail = `State/District (${tender.state}) is listed in registered operating territories.`;
    } else if (isStateMatch) {
      districtScore = 5; // Partial regional credit within home state
      districtDetail = `Project district (${tender.district || 'Unspecified'}) is located within home state (${tender.state}).`;
    } else {
      districtScore = 0;
      districtDetail = `Project location (${tender.district || 'Unspecified'}, ${tender.state}) is outside primary operating geography.`;
    }

    const jurisdictionTotalScore = stateScore + districtScore;
    totalScore += jurisdictionTotalScore;

    factors.push({
      id: 'f-geographic-jurisdiction',
      name: 'Geographic Jurisdiction',
      matched: isStateMatch || isDistrictMatch,
      scoreAwarded: jurisdictionTotalScore,
      maxScore: BTI_DETERMINISTIC_WEIGHTS.geographicJurisdictionWeight,
      explanation: isStateMatch
        ? `Project location is within registered state (${tender.state}). ${districtDetail}`
        : `Project location (${tender.state}) is outside registered state (${organization.state || 'Unspecified'}). ${districtDetail}`,
      calculationBasis: `State jurisdiction: ${stateScore}/15 pts + District/regional presence: ${districtScore}/10 pts = ${jurisdictionTotalScore}/25 pts awarded.`,
      type: 'geographic_jurisdiction',
    });

    // =========================================================================
    // CRITERION 3: Operational Capabilities (Max: 20 points)
    // =========================================================================
    let capabilityScore = 0;
    let matchedCapabilityName = '';
    let capabilityExplanation = '';

    if (organization.capabilities && organization.capabilities.length > 0) {
      const searchTarget = `${tender.title} ${tender.category} ${tender.subCategory || ''} ${tender.description}`.toLowerCase();
      const matchedCap = organization.capabilities.find((cap) => {
        const cLower = cap.toLowerCase();
        return searchTarget.includes(cLower);
      });

      if (matchedCap) {
        matchedCapabilityName = matchedCap;
        capabilityScore = 20;
        capabilityExplanation = `Registered operational capability "${matchedCap}" aligns with project scope requirements.`;
      }
    }

    if (capabilityScore === 0 && isCategoryMatch) {
      // Partial credit for registered sector classification alignment
      capabilityScore = 10;
      capabilityExplanation = `Registered business classification (${organization.businessCategory}) aligns with tender sector (${tender.category}).`;
    } else if (capabilityScore === 0) {
      capabilityExplanation = 'No registered operational capability or category overlap found for this specialized procurement.';
    }

    totalScore += capabilityScore;

    factors.push({
      id: 'f-operational-capabilities',
      name: 'Operational Capabilities',
      matched: capabilityScore > 0,
      scoreAwarded: capabilityScore,
      maxScore: BTI_DETERMINISTIC_WEIGHTS.operationalCapabilitiesWeight,
      explanation: capabilityExplanation,
      calculationBasis: matchedCapabilityName
        ? `Registered capability match ("${matchedCapabilityName}") evaluated against project scope: 20/20 pts awarded.`
        : capabilityScore > 0
        ? `Registered sector classification alignment evaluated: 10/20 pts awarded.`
        : `No registered capability overlap detected: 0/20 pts.`,
      type: 'operational_capabilities',
    });

    // =========================================================================
    // CRITERION 4: Financial Capacity Ratio (Max: 20 points)
    // Formula: Ratio = Organization Annual Turnover / Tender Estimated Value
    // =========================================================================
    const tenderEstimatedValue = tender.estimatedValue || tender.sanctionedAmount || tender.estimatedCost || 0;
    const orgAnnualTurnover = organization.annualTurnover || 0;
    const isTurnoverVerified = organization.financialCapacityVerified === true;

    let financialRatio: number | null = null;
    let financialScore = 0;
    let financialMatched = false;
    let appliedThreshold: FinancialCapacityThreshold = FINANCIAL_CAPACITY_THRESHOLDS[4];

    let financialExplanation = '';
    let financialCalcBasis = '';

    if (tenderEstimatedValue > 0 && orgAnnualTurnover > 0) {
      financialRatio = orgAnnualTurnover / tenderEstimatedValue;

      if (isTurnoverVerified) {
        // Find matching threshold from highest to lowest for verified turnover
        for (const threshold of FINANCIAL_CAPACITY_THRESHOLDS) {
          if (financialRatio >= threshold.minRatio) {
            appliedThreshold = threshold;
            financialScore = threshold.score;
            break;
          }
        }
        financialMatched = financialScore >= 10; // At least 1.0x verified turnover

        const turnoverStr = formatCurrencyCr(orgAnnualTurnover);
        const valueStr = formatCurrencyCr(tenderEstimatedValue);
        const ratioStr = `${financialRatio.toFixed(2)}x`;

        financialExplanation = `Annual verified turnover (${turnoverStr}) ÷ tender estimated value (${valueStr}) = ${ratioStr} ratio. ${appliedThreshold.description}`;
        financialCalcBasis = `Annual verified turnover (${turnoverStr}) ÷ tender estimated value (${valueStr}) = ${ratioStr} ratio. Deterministic threshold "${appliedThreshold.label}" awarded ${financialScore}/20 pts.`;
      } else {
        // Unverified turnover: cannot claim verified statutory capacity score (0 pts)
        appliedThreshold = FINANCIAL_CAPACITY_THRESHOLDS[4];
        financialScore = 0;
        financialMatched = false;

        const turnoverStr = formatCurrencyCr(orgAnnualTurnover);
        const valueStr = formatCurrencyCr(tenderEstimatedValue);
        const ratioStr = `${financialRatio.toFixed(2)}x`;

        financialExplanation = `Annual turnover (${turnoverStr}) is unverified (statutory financial capacity verification pending). Self-declared turnover cannot be certified for financial capacity scoring (0/20 pts).`;
        financialCalcBasis = `Unverified annual turnover (${turnoverStr}) ÷ tender estimated value (${valueStr}) = ${ratioStr} ratio. Awarded 0/20 pts: requires statutory CA/GSTIN verified financial capacity.`;
      }
    } else if (tenderEstimatedValue <= 0) {
      // Tender value is zero or missing: strictly do NOT fabricate a ratio or award points
      financialRatio = null;
      appliedThreshold = FINANCIAL_CAPACITY_THRESHOLDS[4];
      financialScore = 0;
      financialMatched = false;

      if (orgAnnualTurnover > 0) {
        const turnoverLabel = isTurnoverVerified
          ? `Annual verified turnover: ${formatCurrencyCr(orgAnnualTurnover)}`
          : `Annual unverified turnover: ${formatCurrencyCr(orgAnnualTurnover)}`;
        financialExplanation = `Tender estimated value is unrecorded or zero in procurement notice. Financial capacity ratio cannot be computed (${turnoverLabel}) (0/20 pts).`;
        financialCalcBasis = 'Tender estimated value is ₹0 or unavailable. Division by zero prevented; awarded 0/20 pts under deterministic policy for missing procurement value.';
      } else {
        financialExplanation = 'Both tender estimated value and organization turnover are unrecorded. Financial capacity ratio cannot be evaluated (0/20 pts).';
        financialCalcBasis = 'Missing procurement value and unrecorded enterprise turnover; awarded 0/20 pts.';
      }
    } else {
      // orgAnnualTurnover <= 0 and tenderEstimatedValue > 0
      financialRatio = null;
      appliedThreshold = FINANCIAL_CAPACITY_THRESHOLDS[4];
      financialScore = 0;
      financialMatched = false;

      financialExplanation = 'Enterprise annual turnover is unrecorded. Complete statutory financial profile verification to evaluate capacity ratio (0/20 pts).';
      financialCalcBasis = 'Organization turnover unavailable; awarded 0/20 pts under threshold "< 0.5x".';
    }

    totalScore += financialScore;

    factors.push({
      id: 'f-financial-capacity',
      name: 'Financial Capacity Ratio',
      matched: financialMatched,
      scoreAwarded: financialScore,
      maxScore: BTI_DETERMINISTIC_WEIGHTS.financialCapacityWeight,
      explanation: financialExplanation,
      calculationBasis: financialCalcBasis,
      type: 'financial_capacity',
    });

    // Determine Compatibility Tier
    let tier: TenderMatchTier = 'LOW';
    if (totalScore >= 70) {
      tier = 'HIGH';
    } else if (totalScore >= 40) {
      tier = 'MODERATE';
    }

    const headline = `${totalScore}% Compatibility Score`;
    const summary =
      tier === 'HIGH'
        ? `High compatibility (${totalScore}/100) based on aligned business category, registered jurisdiction, technical capabilities, and financial turnover ratio.`
        : tier === 'MODERATE'
        ? `Moderate compatibility (${totalScore}/100). Favorable sector or jurisdictional overlap with scope, geographic, or financial capacity variations.`
        : `Low compatibility (${totalScore}/100). Significant misalignment in business classification, jurisdiction, or financial capacity against project requirements.`;

    return {
      tenderId: tender.id,
      score: totalScore,
      tier,
      headline,
      summary,
      factors,
      matchingStrategy: this.strategyName,
      calculatedAt: new Date().toISOString(),
    };
  }

  public batchMatch(tenders: Tender[], organization?: Organization | null): Map<string, TenderMatchResult> {
    const results = new Map<string, TenderMatchResult>();
    for (const tender of tenders) {
      results.set(tender.id, this.calculateMatch(tender, organization));
    }
    return results;
  }
}

/**
 * Public Service Entry Point: TenderMatchingService
 * Provides a clean abstraction boundary between UI and matching algorithms.
 */
export class TenderMatchingService {
  private static matcher: ITenderMatcher = new RuleBasedTenderMatcher();

  /**
   * Set custom or future AI/ML Matcher instance without altering consumer code.
   */
  public static setMatcher(customMatcher: ITenderMatcher): void {
    this.matcher = customMatcher;
  }

  /**
   * Calculate single tender match
   */
  public static calculateMatch(tender: Tender, organization?: Organization | null): TenderMatchResult {
    return this.matcher.calculateMatch(tender, organization);
  }

  /**
   * Calculate batch matches for a list of tenders
   */
  public static batchMatch(tenders: Tender[], organization?: Organization | null): Map<string, TenderMatchResult> {
    return this.matcher.batchMatch(tenders, organization);
  }
}

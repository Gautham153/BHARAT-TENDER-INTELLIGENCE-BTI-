// Bharat Tender Intelligence (BTI) — Organization Verification Service
// Phase 2A: Organization Verification Architecture, GSTIN Normalization & Provider Abstraction
// Note: This service acts as the unified application gateway for verification requests,
// abstracting behind a serverless-ready boundary and pluggable verification provider.

import {
  Organization,
  VerificationResult,
  VerificationStatus,
  GSTINValidationResult,
  VerificationProvider,
  VerificationEvent,
} from '../types/organization';
import { DevelopmentVerificationProvider } from './verification/DevelopmentVerificationProvider';
import {
  fetchOrganizationById,
  fetchOrganizationByGstin,
  updateOrganizationVerificationStatus,
  listOrganizationsForGovReview,
} from './firebase/organizations';
import { fetchVerificationAuditTrail } from './firebase/verificationEvents';

const STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
};

// Default active provider: Development / Simulation Provider
const activeProvider: VerificationProvider = new DevelopmentVerificationProvider();

/**
 * Character mapping table for GSTIN Mod 36 Luhn-variant checksum algorithm:
 * Digits 0-9 correspond to values 0-9; Uppercase letters A-Z correspond to values 10-35.
 */
const GSTIN_CHAR_MAP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Calculates the statutory Indian GSTIN check character for the first 14 characters
 * using the standard weighted Mod 36 algorithm.
 */
export function calculateGSTINCheckDigit(first14Chars: string): string {
  if (!first14Chars || first14Chars.length !== 14) {
    throw new Error('Check digit calculation requires exactly 14 alphanumeric characters.');
  }

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = first14Chars[i].toUpperCase();
    const val = GSTIN_CHAR_MAP.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid alphanumeric character '${char}' at position ${i + 1} in GSTIN.`);
    }

    // Weight factor: 1 for odd 1-based positions (indices 0, 2, 4, 6, 8, 10, 12)
    // 2 for even 1-based positions (indices 1, 3, 5, 7, 9, 11, 13)
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = val * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }

  const checkRemainder = sum % 36;
  const checkVal = (36 - checkRemainder) % 36;
  return GSTIN_CHAR_MAP[checkVal];
}

export class OrganizationVerificationService {
  /**
   * Normalize GSTIN (trim whitespace, convert to uppercase)
   */
  static normalizeGSTIN(rawGstin: string): string {
    return (rawGstin || '').trim().toUpperCase();
  }

  /**
   * Validate GSTIN format using statutory 15-character structure & Luhn Mod-36 checksum:
   * 2 State Code digits + 10 PAN alphanumeric chars + 1 Entity numeric/alpha char + 'Z' + 1 Check digit
   */
  static validateGSTINFormat(gstin: string): GSTINValidationResult {
    const cleanGstin = this.normalizeGSTIN(gstin);

    if (!cleanGstin) {
      return {
        isValid: false,
        cleanGstin: '',
        error: 'GSTIN is required for organization verification.',
      };
    }

    if (cleanGstin.length !== 15) {
      return {
        isValid: false,
        cleanGstin,
        error: `GSTIN must be exactly 15 characters (currently ${cleanGstin.length}).`,
      };
    }

    const stateCode = cleanGstin.substring(0, 2);
    if (!STATE_CODE_MAP[stateCode]) {
      return {
        isValid: false,
        cleanGstin,
        stateCode,
        error: `GSTIN state code "${stateCode}" is invalid. Must be between 01 and 37.`,
      };
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(cleanGstin)) {
      return {
        isValid: false,
        cleanGstin,
        stateCode,
        error:
          'Invalid GSTIN pattern. Expected: 2 State digits + 10 PAN characters + 1 Entity character + "Z" + 1 Check digit.',
      };
    }

    const pan = cleanGstin.substring(2, 12);
    const stateName = STATE_CODE_MAP[stateCode];

    // Compute statutory Mod-36 Checksum on first 14 characters
    try {
      const calculatedCheckDigit = calculateGSTINCheckDigit(cleanGstin.substring(0, 14));
      const actualCheckDigit = cleanGstin[14];

      if (actualCheckDigit !== calculatedCheckDigit) {
        return {
          isValid: false,
          cleanGstin,
          stateCode,
          stateName,
          pan,
          calculatedCheckDigit,
          error: `GSTIN checksum validation failed. Character 15 ('${actualCheckDigit}') does not match calculated check character ('${calculatedCheckDigit}').`,
        };
      }

      return {
        isValid: true,
        cleanGstin,
        stateCode,
        stateName,
        pan,
        calculatedCheckDigit,
      };
    } catch (err) {
      return {
        isValid: false,
        cleanGstin,
        stateCode,
        stateName,
        pan,
        error: err instanceof Error ? err.message : 'GSTIN checksum calculation failed.',
      };
    }
  }

  /**
   * Duplicate Organization Detection:
   * Performs application-level check across authoritative Firestore repository and local registries.
   */
  static async checkDuplicateGSTIN(
    gstin: string
  ): Promise<{
    isDuplicate: boolean;
    existingOrg: Organization | null;
    message?: string;
  }> {
    const cleanGstin = this.normalizeGSTIN(gstin);
    if (!cleanGstin || cleanGstin.length < 15) {
      return { isDuplicate: false, existingOrg: null };
    }

    const existingOrg = await fetchOrganizationByGstin(cleanGstin);
    if (!existingOrg) {
      return { isDuplicate: false, existingOrg: null };
    }

    let message = `An organization with GSTIN ${cleanGstin} is already registered.`;
    if (existingOrg.verificationStatus === 'verified') {
      message = `Organization "${existingOrg.displayName || existingOrg.legalName}" is already verified in Bharat Tender Intelligence.`;
    } else if (existingOrg.verificationStatus === 'pending') {
      message = `Verification for GSTIN ${cleanGstin} is already in progress (Application: ${existingOrg.applicationId}).`;
    } else if (existingOrg.verificationStatus === 'requires_review') {
      message = `Registration for GSTIN ${cleanGstin} is currently under Nodal Officer review.`;
    } else if (existingOrg.verificationStatus === 'failed') {
      message = `A previous verification attempt for GSTIN ${cleanGstin} failed. Controlled retry is permitted.`;
    }

    return {
      isDuplicate: true,
      existingOrg,
      message,
    };
  }

  /**
   * Verify organization via configured provider abstraction
   */
  static async verifyOrganization(
    gstin: string,
    context?: {
      legalName?: string;
      businessCategory?: string;
      state?: string;
    }
  ): Promise<VerificationResult> {
    const cleanGstin = this.normalizeGSTIN(gstin);
    const formatCheck = this.validateGSTINFormat(cleanGstin);

    if (!formatCheck.isValid) {
      return {
        gstin: cleanGstin,
        status: 'failed',
        provider: activeProvider.id,
        reference: `ERR-FORMAT-${Date.now()}`,
        isSimulation: activeProvider.isSimulation,
        message: formatCheck.error || 'GSTIN format validation failed.',
        timestamp: new Date().toISOString(),
      };
    }

    // Call active provider
    return activeProvider.verifyGSTIN(cleanGstin, context);
  }

  /**
   * Retrieve full organization verification status and chronological audit trail
   */
  static async getOrganizationVerificationDetails(
    organizationId: string
  ): Promise<{
    organization: Organization | null;
    auditTrail: VerificationEvent[];
  }> {
    const organization = await fetchOrganizationById(organizationId);
    const auditTrail = organization ? await fetchVerificationAuditTrail(organizationId) : [];

    return {
      organization,
      auditTrail,
    };
  }

  /**
   * Government Nodal Desk review action:
   * Authorizes verification status update (Approve, Request Review, Reject)
   */
  static async reviewOrganization(
    organizationId: string,
    newStatus: VerificationStatus,
    reviewer: {
      actorId: string;
      actorName: string;
      actorRole: 'government' | 'system';
      notes?: string;
      reason?: string;
    }
  ): Promise<Organization> {
    return updateOrganizationVerificationStatus(organizationId, newStatus, reviewer);
  }

  /**
   * Controlled retry verification for failed organizations
   */
  static async retryVerification(
    organizationId: string,
    user: { id: string; name: string }
  ): Promise<Organization> {
    const org = await fetchOrganizationById(organizationId);
    if (!org) {
      throw new Error(`Organization ${organizationId} not found.`);
    }

    // Run verification check again
    const result = await this.verifyOrganization(org.gstin, {
      legalName: org.legalName,
      businessCategory: org.businessCategory,
      state: org.state,
    });

    return updateOrganizationVerificationStatus(organizationId, result.status, {
      actorId: user.id,
      actorName: user.name,
      actorRole: 'agency',
      notes: `Retry verification requested. Outcome: ${result.status.toUpperCase()}. Provider ref: ${result.reference}.`,
    });
  }

  /**
   * Get provider information for technical honesty UI
   */
  static getProviderInfo(): { id: string; name: string; isSimulation: boolean } {
    return {
      id: activeProvider.id,
      name: activeProvider.name,
      isSimulation: activeProvider.isSimulation,
    };
  }

  /**
   * List organizations for Government review interface
   */
  static async listOrganizations(
    filterStatus?: VerificationStatus | 'all'
  ): Promise<Organization[]> {
    return listOrganizationsForGovReview(filterStatus);
  }
}

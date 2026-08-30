// Bharat Tender Intelligence (BTI) — Organization Verification Service
// Phase 1A: Abstraction Layer for GSTIN & Statutory Verification
// Note: This service defines the pluggable contract for future serverless (/api/verification) integration.

import { VerificationResult, VerificationStatus } from '../types/auth';

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
  '19': 'West Bengal',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
};

// Known synthetic demo organizations for testing
const DEMO_ORGANIZATION_REGISTRY: Record<string, Partial<VerificationResult>> = {
  '09AABCV9821L1ZM': {
    businessName: 'Vikramaditya Infrastructure Ltd',
    status: 'verified',
    stateCode: '09',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    message: 'Initial organization verification successful via statutory database.',
  },
  '27AABCA1234F1Z5': {
    businessName: 'Apex BuildTech Enterprises',
    status: 'pending',
    stateCode: '27',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    message: 'Registration received. Verification pending nodal scrutiny.',
  },
  '07AABCS5555L1Z1': {
    businessName: 'Shri Ram Engineering Works',
    status: 'verified',
    stateCode: '07',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    message: 'Initial organization verification successful.',
  },
};

export class OrganizationVerificationService {
  /**
   * Validate GSTIN format using statutory 15-character structure:
   * 2 digits (State Code) + 10 chars (PAN) + 1 char (Entity) + 'Z' + 1 checksum digit
   */
  static validateGSTINFormat(gstin: string): { isValid: boolean; stateName?: string; error?: string } {
    const cleanGstin = gstin.trim().toUpperCase();

    if (!cleanGstin) {
      return { isValid: false, error: 'GSTIN is required for organization verification.' };
    }

    if (cleanGstin.length !== 15) {
      return { isValid: false, error: `GSTIN must be exactly 15 characters (currently ${cleanGstin.length}).` };
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(cleanGstin)) {
      return {
        isValid: false,
        error: 'Invalid GSTIN format. Expected pattern: 2 State digits + 10 PAN chars + 1 Entity char + Z + 1 Check digit.',
      };
    }

    const stateCode = cleanGstin.substring(0, 2);
    const stateName = STATE_CODE_MAP[stateCode] || `State Code ${stateCode}`;

    return { isValid: true, stateName };
  }

  /**
   * Service verification method
   * Connects to /api/verification in production.
   * For Phase 1A, performs structure verification and returns structured synthetic result.
   */
  static async verifyGSTIN(gstin: string, businessName?: string): Promise<VerificationResult> {
    const cleanGstin = gstin.trim().toUpperCase();
    const formatCheck = this.validateGSTINFormat(cleanGstin);

    if (!formatCheck.isValid) {
      return {
        gstin: cleanGstin,
        status: 'failed',
        message: formatCheck.error || 'Invalid GSTIN format.',
      };
    }

    // Simulate network latency (200-400ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    const existingMatch = DEMO_ORGANIZATION_REGISTRY[cleanGstin];
    if (existingMatch) {
      return {
        gstin: cleanGstin,
        status: existingMatch.status || 'pending',
        businessName: existingMatch.businessName || businessName,
        stateCode: cleanGstin.substring(0, 2),
        taxpayerType: existingMatch.taxpayerType || 'Regular Taxpayer',
        activeStatus: true,
        message: existingMatch.message || 'Organization verification record processed.',
        verifiedAt: new Date().toISOString(),
      };
    }

    // Default status for new registrations: initial verification pending
    const stateCode = cleanGstin.substring(0, 2);
    return {
      gstin: cleanGstin,
      status: 'pending',
      businessName: businessName || 'Registered Enterprise',
      stateCode,
      taxpayerType: 'Regular Taxpayer',
      activeStatus: true,
      message: 'Format verified. Organization application submitted for nodal verification.',
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Status check by application ID
   */
  static async getVerificationStatus(applicationId: string): Promise<VerificationResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    return {
      gstin: '27AABCA1234F1Z5',
      applicationId,
      status: 'pending',
      businessName: 'Apex BuildTech Enterprises',
      message: 'Your organization verification is currently under review by the district nodal officer.',
      verifiedAt: new Date().toISOString(),
    };
  }
}

// Bharat Tender Intelligence (BTI) — Development Verification Provider
// Phase 2A: Isolated Development / Simulation GSTIN Verification Provider
// IMPORTANT TECHNICAL HONESTY NOTICE:
// Results produced by this provider are deterministic simulations for evaluation, development, and testing.
// They DO NOT represent a live query against the Government of India GST database.

import {
  VerificationProvider,
  VerificationResult,
  VerificationStatus,
} from '../../types/organization';

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

interface DemoCaseRule {
  status: VerificationStatus;
  legalName: string;
  taxpayerType: string;
  activeStatus: boolean;
  reference: string;
  message: string;
}

const DETERMINISTIC_DEMO_CASES: Record<string, DemoCaseRule> = {
  // TEST 2: VALID_DEMO_VERIFIED
  '09AABCV9821L1ZS': {
    status: 'verified',
    legalName: 'Vikramaditya Infrastructure Ltd',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    reference: 'DEV-VERIF-09-8812',
    message:
      '[Development Simulation] Entity records active and validated. Verification reference issued.',
  },
  '07AABCS5555L1Z0': {
    status: 'verified',
    legalName: 'Shri Ram Engineering Works',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    reference: 'DEV-VERIF-07-3319',
    message:
      '[Development Simulation] Entity records active and validated. Verification reference issued.',
  },

  // TEST 3: VALID_DEMO_PENDING
  '27AABCA1234F1Z9': {
    status: 'pending',
    legalName: 'Apex BuildTech Enterprises',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    reference: 'DEV-VERIF-27-4102',
    message:
      '[Development Simulation] Initial format validated. Organization registration queued for District Nodal Officer review.',
  },

  // TEST 4: VALID_DEMO_REVIEW
  '10AABCR9999P1ZI': {
    status: 'requires_review',
    legalName: 'Patliputra Civil Constellation LLP',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    reference: 'DEV-VERIF-10-9904',
    message:
      '[Development Simulation] Ambiguous registrar records flagged for manual nodal officer scrutiny prior to workspace clearance.',
  },

  // TEST 5: VALID_DEMO_FAILED
  '19AABCF0000X1ZE': {
    status: 'failed',
    legalName: 'Bengal Heavy Construction Syndicate',
    taxpayerType: 'Composition Taxpayer (Inactive)',
    activeStatus: false,
    reference: 'DEV-VERIF-19-0011',
    message:
      '[Development Simulation] Verification failed: Simulated registrar flagged inactive/cancelled GST registration.',
  },

  // TEST 6: VALID_DEMO_VERIFIED_TN
  '33AAACI1607G2Z5': {
    status: 'verified',
    legalName: 'Southern Infrastructure Technologies',
    taxpayerType: 'Regular Taxpayer',
    activeStatus: true,
    reference: 'DEV-VERIF-33-1607',
    message:
      '[Development Simulation] Entity records active and validated. Verification reference issued.',
  },
};

export class DevelopmentVerificationProvider implements VerificationProvider {
  public readonly id = 'development-simulation';
  public readonly name = 'BTI Development / Simulation Provider';
  public readonly isSimulation = true;

  /**
   * Execute deterministic simulated verification
   */
  async verifyGSTIN(
    gstin: string,
    context?: {
      legalName?: string;
      businessCategory?: string;
      state?: string;
    }
  ): Promise<VerificationResult> {
    const cleanGstin = gstin.trim().toUpperCase();
    const stateCode = cleanGstin.substring(0, 2);
    const stateName = STATE_CODE_MAP[stateCode] || `State Code ${stateCode}`;
    const timestamp = new Date().toISOString();

    // Simulated short network delay (150-300ms)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check if deterministic preset exists
    const match = DETERMINISTIC_DEMO_CASES[cleanGstin];
    if (match) {
      return {
        gstin: cleanGstin,
        status: match.status,
        legalName: match.legalName || context?.legalName || 'Registered Enterprise',
        businessName: match.legalName || context?.legalName || 'Registered Enterprise',
        stateCode,
        stateName,
        taxpayerType: match.taxpayerType,
        activeStatus: match.activeStatus,
        provider: this.id,
        reference: match.reference,
        isSimulation: true,
        message: match.message,
        timestamp,
        verifiedAt: match.status === 'verified' ? timestamp : undefined,
      };
    }

    // Default dynamic outcome for any other structurally valid GSTIN
    const randomRef = `DEV-VERIF-${stateCode}-${Date.now().toString().slice(-4)}`;
    return {
      gstin: cleanGstin,
      status: 'pending',
      legalName: context?.legalName || 'Registered Contractor Enterprise',
      businessName: context?.legalName || 'Registered Contractor Enterprise',
      stateCode,
      stateName,
      taxpayerType: 'Regular Taxpayer',
      activeStatus: true,
      provider: this.id,
      reference: randomRef,
      isSimulation: true,
      message:
        '[Development Simulation] GSTIN format verified. Organization registered in PENDING status awaiting District Nodal Officer review.',
      timestamp,
    };
  }
}

// Bharat Tender Intelligence (BTI) — Agency & Vendor Registration
// Phase 1A: Statutory 3-Step Organization Onboarding & GST Verification Gateway

import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ExternalLink,
  Info,
  BadgeCheck,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { RegistrationStepper } from '../../components/auth/RegistrationStepper';
import { VerificationBadge } from '../../components/auth/VerificationBadge';
import { BtiLogo } from '../../components/common/BtiLogo';
import { SyntheticDataNotice } from '../../components/common/SyntheticDataNotice';
import { DevelopmentEnvironmentNotice } from '../../components/common/DevelopmentEnvironmentNotice';
import { useAuth } from '../../context/AuthContext';
import { OrganizationVerificationService } from '../../services/organizationVerificationService';
import { AgencyRegistrationData, VerificationResult } from '../../types/auth';

export interface AgencyRegistrationPageProps {
  onNavigate: (path: string) => void;
}


const INDIAN_STATES = [
  { label: 'Select State / UT', value: '' },
  { label: 'Uttar Pradesh (09)', value: 'Uttar Pradesh' },
  { label: 'Maharashtra (27)', value: 'Maharashtra' },
  { label: 'Delhi (07)', value: 'Delhi' },
  { label: 'Karnataka (29)', value: 'Karnataka' },
  { label: 'Gujarat (24)', value: 'Gujarat' },
  { label: 'Tamil Nadu (33)', value: 'Tamil Nadu' },
  { label: 'Rajasthan (08)', value: 'Rajasthan' },
  { label: 'Madhya Pradesh (23)', value: 'Madhya Pradesh' },
  { label: 'Bihar (10)', value: 'Bihar' },
  { label: 'West Bengal (19)', value: 'West Bengal' },
  { label: 'Telangana (36)', value: 'Telangana' },
  { label: 'Andhra Pradesh (37)', value: 'Andhra Pradesh' },
  { label: 'Punjab (03)', value: 'Punjab' },
  { label: 'Haryana (06)', value: 'Haryana' },
];

const BUSINESS_CATEGORIES = [
  { label: 'Select Business Category', value: '' },
  { label: 'Civil Infrastructure & Roads', value: 'Civil Infrastructure' },
  { label: 'Water Supply & Drinking Water Projects', value: 'Water & Sanitation' },
  { label: 'Healthcare & Hospital Facilities', value: 'Healthcare Infrastructure' },
  { label: 'Educational Buildings & Schools', value: 'Education & Schools' },
  { label: 'Rural Electrification & Power Grid', value: 'Rural Electrification' },
  { label: 'Community Facilities & Multipurpose Halls', value: 'Community Facilities' },
  { label: 'General Contracting & Multi-Discipline', value: 'General Contracting' },
];

export const AgencyRegistrationPage: React.FC<AgencyRegistrationPageProps> = ({ onNavigate }) => {
  const { registerAgency } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    applicationId: string;
    organization: string;
    submissionDate: string;
    verification: VerificationResult;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<AgencyRegistrationData>({
    companyName: '',
    email: '',
    phone: '',
    password: '',
    gstin: '',
    businessName: '',
    address: '',
    state: '',
    businessCategory: '',
    termsAccepted: false,
  });

  const [confirmPassword, setConfirmPassword] = useState('');
  const [gstValidationStatus, setGstValidationStatus] = useState<{
    isValid: boolean;
    stateName?: string;
    error?: string;
  } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // GSTIN live validation handler
  const handleGstinChange = (value: string) => {
    const cleanGstin = value.toUpperCase().trim();
    setFormData((prev) => ({ ...prev, gstin: cleanGstin }));

    if (cleanGstin.length >= 2) {
      const check = OrganizationVerificationService.validateGSTINFormat(cleanGstin);
      setGstValidationStatus(check);
      if (check.stateName && !formData.state) {
        // Auto-match state if possible
        const matched = INDIAN_STATES.find((s) => s.label.includes(check.stateName!));
        if (matched) {
          setFormData((prev) => ({ ...prev, state: matched.value }));
        }
      }
    } else {
      setGstValidationStatus(null);
    }
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.companyName.trim()) errs.companyName = 'Company / Agency Name is required.';
    if (!formData.email.trim()) {
      errs.email = 'Official Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!formData.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (formData.phone.replace(/\D/g, '').length < 10) {
      errs.phone = 'Enter a valid 10-digit mobile number.';
    }
    if (!formData.password) {
      errs.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (formData.password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.gstin.trim()) {
      errs.gstin = 'GSTIN is required for statutory organization verification.';
    } else {
      const check = OrganizationVerificationService.validateGSTINFormat(formData.gstin);
      if (!check.isValid) {
        errs.gstin = check.error || 'Invalid 15-character GSTIN format.';
      }
    }
    if (!formData.businessName.trim()) {
      errs.businessName = 'Registered Business Name as per GST records is required.';
    }
    if (!formData.address.trim()) {
      errs.address = 'Registered Business Address is required.';
    }
    if (!formData.state) {
      errs.state = 'Please select the registration State / UT.';
    }
    if (!formData.businessCategory) {
      errs.businessCategory = 'Please select primary Business Category.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step Navigation
  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Final Registration Submission
  const handleSubmitRegistration = async () => {
    if (!formData.termsAccepted) {
      setErrors({ termsAccepted: 'You must confirm the statutory declaration to proceed.' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await registerAgency(formData);
      setSubmissionResult({
        applicationId: res.user.applicationId || `BTI-REG-${Date.now().toString().slice(-4)}`,
        organization: formData.companyName,
        submissionDate: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        verification: res.verificationResult,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : 'Registration submission failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Render Post-Submission Success / Verification Pending State
  if (submissionResult) {
    return (
      <div className="min-h-[82vh] flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <BtiLogo size="md" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-3">
              Registration Submitted
            </h1>
            <p className="text-xs text-slate-500">
              Bharat Tender Intelligence • Executing Agency Onboarding
            </p>
          </div>

          <Card className="p-8 border-slate-300 shadow-sm space-y-6">
            {/* Status Header */}
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-700 animate-pulse" />
                  <span className="font-bold text-sm text-amber-900">
                    Organization Verification Pending
                  </span>
                </div>
                <VerificationBadge status={submissionResult.verification.status} size="sm" />
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Your registration application has been logged into the National Nodal Desk. Initial GST structure verification is recorded, and formal nodal officer scrutiny is underway.
              </p>
            </div>

            {/* Application Summary Receipt */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                Application Summary Record
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Application ID</span>
                  <span className="font-mono font-bold text-slate-900">{submissionResult.applicationId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Submission Date</span>
                  <span className="font-semibold text-slate-900">{submissionResult.submissionDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Organization Name</span>
                  <span className="font-semibold text-slate-900">{submissionResult.organization}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Registered GSTIN</span>
                  <span className="font-mono font-semibold text-slate-900">{formData.gstin}</span>
                </div>
              </div>
            </div>

            {/* Verification Workflow Timeline */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">Next Steps in the Onboarding Pipeline:</div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>1. Account created & initial GST structure confirmed</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>2. District Nodal Officer verification of statutory PAN/GST credentials</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>3. Full bidding clearance for high-value MPLAD scheme work tenders</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <Button
                variant="gov"
                size="lg"
                className="w-full justify-center bg-[#002B49] hover:bg-[#003B64]"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => onNavigate('/agency/verification')}
              >
                View Organization Verification Status
              </Button>

              <Button
                variant="outline"
                size="md"
                className="w-full justify-center border-slate-300"
                onClick={() => onNavigate('/agency/dashboard')}
              >
                Go to Agency Workspace
              </Button>
            </div>

            <div className="text-center text-[10px] text-slate-400 font-mono">
              Statutory Ref: GFR-2017 • Rule 144(xi) • Public Procurement Compliance
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] py-10 px-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <BtiLogo size="md" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-3">
          Agency & Contractor Registration
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          Statutory vendor onboarding for participation in public MPLAD civil infrastructure works.
        </p>
      </div>

      {/* Technical Honesty Disclaimer */}
      <DevelopmentEnvironmentNotice />


      {/* Institutional Caution Note */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200/90 rounded-xl flex items-start gap-2.5 text-xs text-[#002B49]">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#002B49]" />
        <div className="leading-relaxed">
          <span className="font-bold">Controlled Institutional Access: </span>
          BTI is a regulated public works monitoring platform. All vendor registrations undergo mandatory GSTIN verification and district nodal officer review before full bidding clearance is granted.
        </div>
      </div>

      {/* Synthetic Notice */}
      <SyntheticDataNotice variant="inline" />

      {/* Registration Stepper */}
      <Card className="p-4 sm:p-6 border-slate-300 shadow-sm">
        <RegistrationStepper
          currentStep={currentStep}
          onStepClick={(step) => {
            if (step < currentStep) setCurrentStep(step);
          }}
        />
      </Card>

      {/* Form Card */}
      <Card className="p-6 sm:p-8 border-slate-300 shadow-sm space-y-6">
        {/* STEP 1: Account Details */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">Step 1: Account & Representative Information</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Provide the primary contact and official representative details for this organization.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="Company / Agency Name"
                placeholder="e.g. Vikramaditya Infrastructure Pvt Ltd"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                error={errors.companyName}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Official Email Address"
                  type="email"
                  placeholder="contact@company.in"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                  helperText="Must be monitored for tender notifications"
                  required
                />

                <Input
                  label="Official Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  error={errors.phone}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PasswordInput
                  label="Create Password"
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  error={errors.password}
                  showStrength
                  required
                />

                <PasswordInput
                  label="Confirm Password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={errors.confirmPassword}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => onNavigate('/login?portal=agency')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer text-center sm:text-left py-1"
              >
                Already registered? Sign in →
              </button>

              <Button
                variant="gov"
                size="md"
                className="w-full sm:w-auto justify-center bg-[#002B49]"
                icon={ArrowRight}
                iconPosition="right"
                onClick={handleNext}
              >
                Continue to Verification
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Organization Verification */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">Step 2: Organization & GSTIN Verification</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory details used for automated entity cross-referencing and compliance scoring.
              </p>
            </div>

            <div className="space-y-4">
              {/* Highlighted GSTIN Field */}
              <div className="p-4 bg-slate-50 border-2 border-dashed border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#002B49] flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4 text-blue-600" />
                    <span>GSTIN — Organization Verification *</span>
                  </label>
                  {gstValidationStatus?.isValid && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Valid Pattern ({gstValidationStatus.stateName})
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 09AABCV9821L1ZS"
                  value={formData.gstin}
                  onChange={(e) => handleGstinChange(e.target.value)}
                  className="w-full font-mono font-bold tracking-wider uppercase text-base p-3 rounded-lg border border-slate-300 focus:border-[#002B49] focus:ring-2 focus:ring-blue-100 bg-white text-slate-900 outline-none"
                />

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Your GSTIN will be used for initial organization verification against statutory registrar records. Verification status will be monitored throughout tender participation.
                </p>

                {errors.gstin && (
                  <p className="text-xs text-rose-600 font-semibold">{errors.gstin}</p>
                )}
              </div>

              <Input
                label="Registered Business Name (as per GST)"
                placeholder="e.g. Vikramaditya Infrastructure Ltd"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                error={errors.businessName}
                required
              />

              <Input
                label="Registered Business Address"
                placeholder="Plot / Office No., Industrial Area, City"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                error={errors.address}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="State / Union Territory"
                  options={INDIAN_STATES}
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  error={errors.state}
                  required
                />

                <Select
                  label="Primary Business Category"
                  options={BUSINESS_CATEGORIES}
                  value={formData.businessCategory}
                  onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                  error={errors.businessCategory}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="md"
                icon={ArrowLeft}
                onClick={handleBack}
                className="w-full sm:w-auto justify-center"
              >
                Back to Account
              </Button>

              <Button
                variant="gov"
                size="md"
                className="w-full sm:w-auto justify-center bg-[#002B49]"
                icon={ArrowRight}
                iconPosition="right"
                onClick={handleNext}
              >
                Review & Declaration
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Terms Declaration */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">Step 3: Review & Statutory Undertaking</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify your organization submission before logging your application with the Nodal Desk.
              </p>
            </div>

            {/* Review Summary Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Agency / Company Name</span>
                  <span className="font-bold text-slate-900">{formData.companyName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Official Email</span>
                  <span className="font-semibold text-slate-900">{formData.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Registered GSTIN</span>
                  <span className="font-mono font-bold text-[#002B49]">{formData.gstin}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">State / Location</span>
                  <span className="font-semibold text-slate-900">{formData.state}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block text-[11px]">Specialization Category</span>
                  <span className="font-semibold text-slate-900">{formData.businessCategory}</span>
                </div>
              </div>

              {/* Initial Verification Status Banner */}
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#002B49]">Initial Organization Verification Status</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Format validated • Ready for nodal dispatch</div>
                </div>
                <VerificationBadge status="pending" size="sm" />
              </div>
            </div>

            {/* Declaration Checkbox */}
            <div className="p-4 bg-white border border-slate-300 rounded-xl space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => {
                    setFormData({ ...formData, termsAccepted: e.target.checked });
                    if (errors.termsAccepted) setErrors({});
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-[#002B49] focus:ring-[#002B49] mt-0.5 shrink-0"
                />
                <span className="text-xs text-slate-700 leading-relaxed font-medium">
                  I hereby solemnly declare that the organization details and GSTIN provided are true and accurate. I understand that fraudulent claims or falsified bid certifications are punishable under the Indian Penal Code and the Prevention of Corruption Act.
                </span>
              </label>

              {errors.termsAccepted && (
                <p className="text-xs text-rose-600 font-semibold pl-7">{errors.termsAccepted}</p>
              )}
            </div>

            {errors.submit && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {errors.submit}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="md"
                icon={ArrowLeft}
                onClick={handleBack}
                disabled={loading}
                className="w-full sm:w-auto justify-center"
              >
                Back to Details
              </Button>

              <Button
                variant="gov"
                size="lg"
                className="w-full sm:w-auto justify-center bg-emerald-700 hover:bg-emerald-800 text-white"
                icon={CheckCircle2}
                iconPosition="right"
                onClick={handleSubmitRegistration}
                disabled={loading}
              >
                {loading ? 'Submitting Registration...' : 'Submit Agency Registration'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import {
  Shield,
  Building2,
  Users,
  ArrowRight,
  Sparkles,
  FileCheck2,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Lock,
  CheckCircle2,
  Activity,
  Layers,
  Database,
  Cpu,
  FileSpreadsheet,
  FolderKanban,
  History,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Timeline, TimelineStep } from '../../components/ui/Timeline';
import { HeroArtwork } from '../../components/common/HeroArtwork';
import { mockStats, mockProjects } from '../../data/mockData';

export interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const lifecycleSteps: TimelineStep[] = [
    {
      id: 'step-1',
      stepNumber: '01',
      title: 'Tender Creation',
      description: 'Nodal officers draft MPLAD tenders with structured BoQ and benchmark rates.',
      icon: FileSpreadsheet,
    },
    {
      id: 'step-2',
      stepNumber: '02',
      title: 'Proposal Submission',
      description: 'Verified agencies submit encrypted technical and financial bids.',
      icon: Building2,
    },
    {
      id: 'step-3',
      stepNumber: '03',
      title: 'AI Evaluation',
      description: 'BTI scans for cartel formation, price rigging, shell vendors & collusive patterns.',
      icon: Cpu,
    },
    {
      id: 'step-4',
      stepNumber: '04',
      title: 'Award & Approval',
      description: 'Merit-based algorithmic scoring guides transparent tender allocation.',
      icon: FileCheck2,
    },
    {
      id: 'step-5',
      stepNumber: '05',
      title: 'Project Execution',
      description: 'Milestone tracking with geo-tagged photographic evidence and fund audits.',
      icon: FolderKanban,
    },
    {
      id: 'step-6',
      stepNumber: '06',
      title: 'Audit & Transparency',
      description: 'Tamper-evident logs and open citizen transparency on every rupee spent.',
      icon: History,
    },
  ];

  const intelligenceCapabilities = [
    {
      icon: AlertTriangle,
      title: 'Bid Rigging & Cartel Detection',
      description: 'Detects coordinated bidding patterns, rotational winning, and anomalous identical pricing structures.',
      color: 'bg-rose-50 text-rose-700',
    },
    {
      icon: TrendingUp,
      title: 'Price Inflation & BoQ Outlier Analysis',
      description: 'Benchmarks line-item material rates against regional scheduled rates (DSR) to flag over-invoicing.',
      color: 'bg-amber-50 text-amber-700',
    },
    {
      icon: Building2,
      title: 'Shell Vendor & Co-location Analysis',
      description: 'Cross-verifies GSTIN, common directorships, shared IP addresses, and bank accounts between bidders.',
      color: 'bg-blue-50 text-[#002B49]',
    },
    {
      icon: MapPin,
      title: 'Ghost Project Prevention',
      description: 'Integrates GIS geo-fencing and tamper-proof EXIF metadata verification on construction photo uploads.',
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      icon: Activity,
      title: 'Milestone-Linked Disbursal Audits',
      description: 'Prevents advance fund drain by strictly gating financial releases against verified physical progress.',
      color: 'bg-purple-50 text-purple-700',
    },
    {
      icon: Database,
      title: 'Tamper-Evident System Audit Trail',
      description: 'Maintains an immutable ledger of all evaluation decisions, scoring logs, and officer approvals.',
      color: 'bg-slate-100 text-slate-800',
    },
  ];

  return (
    <div className="w-full font-sans">
      {/* 1. Hero Section */}
      <section className="relative pt-6 pb-14 lg:py-16 overflow-hidden bg-gradient-to-b from-slate-50/80 via-white to-slate-50/40 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Copy & Actions */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7 space-y-6"
            >
              {/* National Initiative Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#002B49] text-xs font-bold tracking-wide shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>MPLAD Scheme Intelligence & Monitoring Infrastructure</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-900 tracking-tight leading-[1.18]">
                AI-Powered Integrity, Fraud Detection & Transparency in Public Tenders
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl font-normal">
                Bharat Tender Intelligence (BTI) safeguards public funds under the Member of Parliament Local Area Development Scheme (MPLADS) by autonomously surfacing bid rigging, cost inflation, shell vendors, and milestone anomalies.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="gov"
                  size="lg"
                  onClick={() => onNavigate('/government/dashboard')}
                  icon={ArrowRight}
                  iconPosition="right"
                  className="bg-[#002B49] text-white hover:bg-[#001D33] shadow-sm"
                >
                  Government Portal
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onNavigate('/agency/dashboard')}
                  icon={Building2}
                  className="border-slate-300 text-slate-800 hover:bg-slate-50"
                >
                  Agency Workspace
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => onNavigate('/transparency')}
                  icon={Users}
                  className="text-[#002B49] hover:bg-blue-50 font-semibold"
                >
                  Citizen Transparency
                </Button>
              </div>

              {/* High-level Trust Indicators */}
              <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-left">
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900">₹ {mockStats.totalAllocationCr} Cr</div>
                  <div className="text-xs text-slate-500 mt-0.5">MPLAD Funds Tracked</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-700">{mockStats.totalProjects.toLocaleString('en-IN')}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Monitored Projects</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-[#002B49]">{mockStats.aiRiskAlertsActive}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Active Anomaly Flags</div>
                </div>
              </div>
            </motion.div>

            {/* Right Architectural Vector Illustration (Sansad Bhavan & National Flag) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-5 flex items-center justify-center min-w-0"
            >
              <HeroArtwork />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Three Dedicated Portals Entry Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Unified Ecosystem for Governance, Execution & Public Scrutiny
            </h2>
            <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
              Designed specifically for district administrations, authorized executing agencies, and citizens of Bharat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Government Portal Card */}
            <Card
              variant="elevated"
              className="p-7 flex flex-col justify-between border-t-4 border-t-[#002B49] relative"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#002B49] flex items-center justify-center mb-5">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Government & Nodal Portal</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  For District Collectors, Nodal Officers, and Vigilance teams to publish tenders, evaluate bids with AI risk matrices, and monitor ongoing works.
                </p>
                <ul className="space-y-2 text-xs text-slate-700 font-medium mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Algorithmic Bid Evaluation & Cartel Flags</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Real-time Risk Dashboards & Alert Triage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Milestone Approval & Fund Release Gates</span>
                  </li>
                </ul>
              </div>
              <Button
                variant="gov"
                size="md"
                onClick={() => onNavigate('/government/dashboard')}
                icon={ArrowRight}
                iconPosition="right"
                className="w-full justify-between"
              >
                Access Government Portal
              </Button>
            </Card>

            {/* Agency Portal Card */}
            <Card
              variant="elevated"
              className="p-7 flex flex-col justify-between border-t-4 border-t-emerald-600 relative"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Agency & Contractor Workspace</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  For registered vendors, public sector undertakings (PSUs), and contractors to discover tenders, submit transparent bids, and upload proof of work.
                </p>
                <ul className="space-y-2 text-xs text-slate-700 font-medium mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Live MPLAD Tender Discovery & Bidding</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Geo-tagged Milestone Evidence Uploads</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Disbursement Claim Tracking & Invoicing</span>
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={() => onNavigate('/agency/dashboard')}
                icon={ArrowRight}
                iconPosition="right"
                className="w-full justify-between border-emerald-300 text-emerald-900 hover:bg-emerald-50"
              >
                Access Agency Workspace
              </Button>
            </Card>

            {/* Public Transparency Card */}
            <Card
              variant="elevated"
              className="p-7 flex flex-col justify-between border-t-4 border-t-orange-500 relative"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center mb-5">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Citizen Transparency Hub</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  For public citizens, researchers, and media to view parliamentary constituency expenditures, track local community assets, and submit feedback.
                </p>
                <ul className="space-y-2 text-xs text-slate-700 font-medium mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Constituency & MP Wise Fund Breakdown</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>National GIS Map of All Community Assets</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Citizen Grievance & Progress Verification</span>
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={() => onNavigate('/transparency')}
                icon={ArrowRight}
                iconPosition="right"
                className="w-full justify-between border-orange-300 text-orange-950 hover:bg-orange-50"
              >
                Explore Public Data
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. Visual Lifecycle Section */}
      <section className="py-16 bg-slate-50/80 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-[#002B49]">
              End-to-End Governance Lifecycle
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              From Sanction to Verification: Transparent at Every Stage
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Every MPLAD public development project passes through rigorous automated integrity checks.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-xs">
            <Timeline steps={lifecycleSteps} activeStepIndex={2} />
          </div>
        </div>
      </section>

      {/* 4. AI Intelligence Capabilities */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#002B49] uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>AI Anomaly & Risk Engine</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Continuous Surveillance of Public Procurement
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('/how-it-works')}
              icon={ArrowRight}
              iconPosition="right"
            >
              Learn Technical Architecture
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {intelligenceCapabilities.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card
                  key={idx}
                  variant="flat"
                  className="p-6 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Public Transparency Spotlight & GIS Preview */}
      <section className="py-16 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-5">
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                Public Accountability
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                Empowering Citizens with Open Geo-Spatial Project Data
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Discover hospitals, drinking water facilities, community centers, and roads constructed in your Lok Sabha or Rajya Sabha constituency. Track contractor names, sanctioned costs, and physical completion dates with full audit trails.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="default"
                  size="md"
                  onClick={() => onNavigate('/map')}
                  icon={MapPin}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Open National GIS Map
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => onNavigate('/transparency')}
                  className="border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  Search by Constituency
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
                <span className="text-xs font-bold text-slate-200">Recent Completed Community Assets</span>
                <span className="text-[11px] text-emerald-400 font-mono">100% Geo-Verified</span>
              </div>
              <div className="space-y-3">
                {mockProjects.slice(0, 3).map((proj) => (
                  <div key={proj.id} className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-700/60 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white">{proj.title}</div>
                      <div className="text-[11px] text-slate-400">{proj.district}, {proj.state} • {proj.executingAgencyName}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-emerald-400">₹ {(proj.sanctionedBudget / 10000000).toFixed(2)} Cr</div>
                      <div className="text-[10px] text-slate-400 font-mono">{proj.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Institutional Compliance & Zero-Trust Architecture */}
      <section className="py-14 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-50 text-[#002B49] shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Zero-Trust Security</h4>
                <p className="text-xs text-slate-500 mt-0.5">Role-gated backend authority, SHA-256 tamper logs, and encrypted bids.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">CVC Compliance</h4>
                <p className="text-xs text-slate-500 mt-0.5">Aligned with Central Vigilance Commission procurement guidelines.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">MoSPI MPLADS Standards</h4>
                <p className="text-xs text-slate-500 mt-0.5">Incorporates nodal district verification & revised 2023 guideline mandates.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Open Data API Ready</h4>
                <p className="text-xs text-slate-500 mt-0.5">Extensible REST endpoints designed for integration with e-GramSwaraj & PFMS.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

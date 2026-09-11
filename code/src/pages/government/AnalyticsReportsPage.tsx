import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  TrendingUp,
  PieChart,
  Calendar,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useToast } from '../../context/ToastContext';

export const AnalyticsReportsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();

  const statePerformance = [
    { state: 'Uttar Pradesh', allocationCr: 412.5, utilizationPct: 68.4, projects: 2840 },
    { state: 'Maharashtra', allocationCr: 385.0, utilizationPct: 74.2, projects: 2410 },
    { state: 'Rajasthan', allocationCr: 290.0, utilizationPct: 62.1, projects: 1980 },
    { state: 'Bihar', allocationCr: 310.0, utilizationPct: 54.8, projects: 2150 },
    { state: 'Madhya Pradesh', allocationCr: 275.0, utilizationPct: 66.5, projects: 1820 },
    { state: 'Karnataka', allocationCr: 260.0, utilizationPct: 79.1, projects: 1640 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="MPLAD Scheme Reports & National Analytics"
        subtitle="Comprehensive fund utilization benchmarks, state-wise compliance indices and exportable MIS reports."
        actions={
          <Button
            variant="gov"
            size="sm"
            icon={Download}
            onClick={() => showToast('Report Generated', { message: 'National MPLAD MIS report downloaded.' })}
          >
            Download National MIS (PDF)
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* State Performance Breakdown */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">State-wise Fund Absorption Index</h3>
              <p className="text-xs text-slate-500">Expenditure ratio vs Sanctioned MPLAD allocations</p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">FY 2024-25</span>
          </div>

          <div className="space-y-4 pt-1">
            {statePerformance.map((st) => (
              <div key={st.state} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-800">{st.state}</span>
                  <span className="text-slate-600">
                    ₹ {st.allocationCr} Cr ({st.projects} Works) • <strong className="text-[#002B49]">{st.utilizationPct}%</strong>
                  </span>
                </div>
                <ProgressBar
                  value={st.utilizationPct}
                  size="sm"
                  color={st.utilizationPct >= 70 ? 'emerald' : st.utilizationPct >= 60 ? 'blue' : 'amber'}
                  showPercentage={false}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Sectoral Breakdown */}
        <Card className="space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Sectoral Allocation</h3>
            <p className="text-xs text-slate-500">Expenditure across community sectors</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900">Healthcare Facilities</div>
                <div className="text-slate-500">32.4% of total outlay</div>
              </div>
              <strong className="text-sm font-bold text-slate-900">₹ 795 Cr</strong>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900">Rural Roads & Bridges</div>
                <div className="text-slate-500">28.1% of total outlay</div>
              </div>
              <strong className="text-sm font-bold text-slate-900">₹ 690 Cr</strong>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900">Drinking Water Schemes</div>
                <div className="text-slate-500">21.5% of total outlay</div>
              </div>
              <strong className="text-sm font-bold text-slate-900">₹ 528 Cr</strong>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
              <div>
                <div className="font-bold text-slate-900">Community & Education</div>
                <div className="text-slate-500">18.0% of total outlay</div>
              </div>
              <strong className="text-sm font-bold text-slate-900">₹ 443 Cr</strong>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Lock,
  Cpu,
  Server,
  Users,
  CheckCircle2,
  Key,
  Database,
  Sliders,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { FUTURE_API_ENDPOINTS } from '../../services/futureBackend';
import { FUTURE_AI_CAPABILITIES } from '../../services/futureAiServices';

export const SettingsSecurityPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [cartelThreshold, setCartelThreshold] = useState(65);
  const [inflationThreshold, setInflationThreshold] = useState(25);
  const [geoToleranceMeters, setGeoToleranceMeters] = useState(50);

  const handleSaveSettings = () => {
    showToast('Security Configuration Saved', {
      message: 'Algorithm sensitivity parameters updated in system cache.',
      type: 'success',
    });
  };

  const rbacMatrix = [
    {
      role: 'District Magistrate / Nodal Officer',
      publishTender: true,
      evaluateBids: true,
      disburseFunds: true,
      viewInvestigations: true,
      systemConfig: false,
    },
    {
      role: 'Vigilance & Anti-Corruption Officer',
      publishTender: false,
      evaluateBids: true,
      disburseFunds: false,
      viewInvestigations: true,
      systemConfig: false,
    },
    {
      role: 'Executing Agency / Contractor',
      publishTender: false,
      evaluateBids: false,
      disburseFunds: false,
      viewInvestigations: false,
      systemConfig: false,
    },
    {
      role: 'Citizen / Public Researcher',
      publishTender: false,
      evaluateBids: false,
      disburseFunds: false,
      viewInvestigations: false,
      systemConfig: false,
    },
    {
      role: 'System Administrator / SecOps',
      publishTender: false,
      evaluateBids: false,
      disburseFunds: false,
      viewInvestigations: true,
      systemConfig: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Security Configuration"
        subtitle="Role-based permissions, AI detection sensitivity thresholds, and future integration blueprints."
        actions={
          <Button variant="gov" size="sm" onClick={handleSaveSettings}>
            Save Parameters
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. AI Anomaly Engine Sensitivity Sliders */}
        <Card className="space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Cpu className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">AI Anomaly Thresholds</h3>
              <p className="text-xs text-slate-500">Tune sensitivity of mathematical outlier algorithms</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-800">Bid Rigging & Cartel Alert Threshold</span>
                <strong className="text-rose-700">{cartelThreshold}% Score</strong>
              </div>
              <input
                type="range"
                min="30"
                max="90"
                value={cartelThreshold}
                onChange={(e) => setCartelThreshold(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#002B49]"
              />
              <span className="text-[11px] text-slate-400">Trigger alert when collusion confidence exceeds this score.</span>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-800">BoQ Material Inflation Outlier Limit</span>
                <strong className="text-amber-700">+{inflationThreshold}% vs DSR</strong>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                value={inflationThreshold}
                onChange={(e) => setInflationThreshold(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#002B49]"
              />
              <span className="text-[11px] text-slate-400">Flag items quoted significantly above District Schedule of Rates.</span>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-slate-800">GIS Geo-Fencing Variance Allowance</span>
                <strong className="text-[#002B49]">{geoToleranceMeters} Meters</strong>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                value={geoToleranceMeters}
                onChange={(e) => setGeoToleranceMeters(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#002B49]"
              />
              <span className="text-[11px] text-slate-400">Permissible GPS drift for photographic proof uploads.</span>
            </div>
          </div>
        </Card>

        {/* 2. Future Backend Architecture Blueprint Preview */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Server className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Future Serverless Architecture</h3>
              <p className="text-xs text-slate-500">Decoupled API endpoints prepared for Phase 1 backend integration</p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {FUTURE_API_ENDPOINTS.map((ep, idx) => (
              <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-[#002B49]">{ep.endpoint}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    {ep.method}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-1">{ep.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* RBAC Matrix Table */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#002B49]" />
            <h3 className="font-bold text-slate-900 text-sm">Role-Based Access Control (RBAC) Matrix</h3>
          </div>
          <span className="text-xs text-slate-400">Server-Side Enforced</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-3">User Role</th>
                <th className="p-3 text-center">Publish Tenders</th>
                <th className="p-3 text-center">Evaluate Bids</th>
                <th className="p-3 text-center">Disburse Funds</th>
                <th className="p-3 text-center">Inquiry Dossiers</th>
                <th className="p-3 text-center">System Config</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {rbacMatrix.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{r.role}</td>
                  <td className="p-3 text-center">
                    {r.publishTender ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {r.evaluateBids ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {r.disburseFunds ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {r.viewInvestigations ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {r.systemConfig ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

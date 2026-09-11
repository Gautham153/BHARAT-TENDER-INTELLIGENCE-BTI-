import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  ExternalLink,
  Lock,
  ArrowRight,
  TrendingUp,
  Cpu,
  FileCheck2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { Drawer } from '../../components/ui/Drawer';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { mockAnomalyAlerts } from '../../data/mockData';
import { AnomalyAlert } from '../../types';

export interface RiskAlertsProps {
  onNavigate: (path: string) => void;
}

export const RiskAlerts: React.FC<RiskAlertsProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState<AnomalyAlert[]>(mockAnomalyAlerts);
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);
  const [escalateDialogAlert, setEscalateDialogAlert] = useState<AnomalyAlert | null>(null);

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'All' && a.severity !== severityFilter) return false;
    if (typeFilter !== 'All' && a.type !== typeFilter) return false;
    return true;
  });

  const handleDismissAlert = (alert: AnomalyAlert) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    setSelectedAlert(null);
    showToast('Alert Dismissed', {
      message: 'Alert marked as reviewed and dismissed by Nodal Officer with audit note.',
      type: 'info',
    });
  };

  const handleEscalateAlert = () => {
    if (!escalateDialogAlert) return;
    setAlerts((prev) =>
      prev.map((a) => (a.id === escalateDialogAlert.id ? { ...a, status: 'Escalated' } : a))
    );
    showToast('Escalated to Vigilance Cell', {
      message: `Case file created and submitted to State Anti-Corruption & CVC monitoring desk.`,
      type: 'warning',
    });
    setEscalateDialogAlert(null);
    setSelectedAlert(null);
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'Bid Rigging':
      case 'Cartel Formation':
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      case 'Cost Inflation':
        return <TrendingUp className="w-5 h-5 text-amber-600" />;
      case 'Ghost Project':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="AI Anomaly & Risk Alerts Triage"
        subtitle="Autonomous procurement surveillance: cartels, price inflation, ghost sites, and shell agencies."
        badge={
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800">
            {alerts.filter((a) => a.severity === 'Critical' || a.severity === 'High').length} High Priority
          </span>
        }
      />

      {/* Filter Controls */}
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Severity:</span>
          </div>
          {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                severityFilter === sev
                  ? 'bg-[#002B49] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong className="text-slate-900">{filteredAlerts.length}</strong> active anomaly signals
        </div>
      </Card>

      {/* Alert Feed Cards Grid */}
      <div className="space-y-3.5">
        {filteredAlerts.map((alert) => (
          <Card
            key={alert.id}
            onClick={() => setSelectedAlert(alert)}
            className="p-5 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer border-l-4"
            style={{
              borderLeftColor:
                alert.severity === 'Critical' ? '#f43f5e' : alert.severity === 'High' ? '#ea580c' : '#f59e0b',
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-100 shrink-0 mt-0.5">
                  {getAlertIcon(alert.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900">{alert.title}</h4>
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {alert.type}
                    </span>
                    {alert.status === 'Escalated' && (
                      <span className="text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                        Under Investigation
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {alert.evidenceSummary}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-2.5">
                    <span>Target: <strong className="text-slate-700">{alert.tenderTitle || alert.projectTitle}</strong></span>
                    <span>•</span>
                    <span>Detected: {alert.detectedAt}</span>
                  </div>
                </div>
              </div>

              {/* Right Scores & Action */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="flex items-center gap-2">
                  <RiskBadge score={alert.riskScore} level={alert.severity.toUpperCase() as any} />
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {alert.confidenceScore}% Conf
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAlert(alert);
                  }}
                  className="text-xs py-1 px-2.5"
                >
                  Inspect Evidence
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Drawer: Detailed AI Evidence & ML Signals */}
      <Drawer
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        width="xl"
        title={
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>AI Anomaly Investigation Dossier</span>
          </div>
        }
        footer={
          selectedAlert && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDismissAlert(selectedAlert)}
              >
                Dismiss with Log
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    showToast('Payment Freeze Applied', {
                      message: 'Treasury milestone payout locked for this project pending audit.',
                      type: 'warning',
                    });
                  }}
                >
                  Freeze Disbursal
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setEscalateDialogAlert(selectedAlert)}
                >
                  Escalate to Vigilance
                </Button>
              </div>
            </div>
          )
        }
      >
        {selectedAlert && (
          <div className="space-y-6">
            {/* Dossier Header */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-base font-bold text-slate-900">{selectedAlert.title}</div>
              <div className="text-xs text-slate-600 leading-relaxed">{selectedAlert.evidenceSummary}</div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-mono text-slate-500">
                <span>Alert ID: {selectedAlert.id}</span>
                <span>Algorithm: BTI-AntiCollusion-v2</span>
              </div>
            </div>

            {/* Model Confidence & Risk breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Risk Severity</span>
                <div className="text-lg font-bold text-rose-600 mt-0.5">{selectedAlert.severity} ({selectedAlert.riskScore}/100)</div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">ML Confidence</span>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{selectedAlert.confidenceScore}% Certainty</div>
              </div>
            </div>

            {/* Technical Signal Indicators */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Corroborating Evidence Artifacts
              </h4>
              <div className="space-y-2">
                {selectedAlert.evidenceDetails?.map((detail, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-700"
                  >
                    <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{detail}</span>
                  </div>
                )) || (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                    High statistical deviation from regional procurement averages detected.
                  </div>
                )}
              </div>
            </div>

            {/* Recommended Protocol Action */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
              <div className="font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Statutory Governance Protocol</span>
              </div>
              <p>
                In accordance with Central Vigilance Commission (CVC) Office Order No. 02/01/22, an alert with &gt;80% confidence mandates a 3-member physical spot inquiry prior to fund release.
              </p>
            </div>
          </div>
        )}
      </Drawer>

      {/* Confirmation Dialog: Escalate to Vigilance */}
      <ConfirmDialog
        isOpen={Boolean(escalateDialogAlert)}
        onClose={() => setEscalateDialogAlert(null)}
        onConfirm={handleEscalateAlert}
        title="Escalate Alert to District Vigilance Officer?"
        message="This action will generate a formal investigation dossier and register an inquiry entry in the system audit logs. The tender evaluation will be temporarily put on hold."
        confirmText="Confirm Escalation"
        variant="danger"
      />
    </div>
  );
};

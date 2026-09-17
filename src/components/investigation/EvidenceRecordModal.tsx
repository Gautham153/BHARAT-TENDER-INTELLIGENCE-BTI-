// Bharat Tender Intelligence (BTI) — Underlying Record Inspection Modal
// Phase 8: Authoritative Source Record Inspection View

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EvidenceReference } from '../../types/evidence';
import { EvidenceChainService } from '../../services/evidence/evidenceChainService';
import {
  FileText,
  Calendar,
  Layers,
  Info,
  ShieldAlert,
  FileQuestion,
  CheckCircle2,
  RefreshCw,
  Database,
} from 'lucide-react';

interface EvidenceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: EvidenceReference | null;
  projectId?: string;
}

export const EvidenceRecordModal: React.FC<EvidenceRecordModalProps> = ({
  isOpen,
  onClose,
  evidence,
  projectId,
}) => {
  const [fetchedRecord, setFetchedRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && evidence) {
      const pId = projectId || (evidence.recordSnippet?.projectId as string);
      if (pId) {
        setLoading(true);
        setFetchError(null);
        EvidenceChainService.getEvidenceSource(evidence.sourceType, evidence.sourceId, pId)
          .then((res) => {
            if (isMounted) {
              setFetchedRecord(res);
              setLoading(false);
            }
          })
          .catch((err) => {
            if (isMounted) {
              setFetchError(err?.message || 'Could not fetch authoritative record');
              setLoading(false);
            }
          });
      } else {
        setFetchedRecord(null);
        setLoading(false);
      }
    } else {
      setFetchedRecord(null);
      setLoading(false);
      setFetchError(null);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, evidence, projectId]);

  if (!evidence) return null;

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'DIRECT':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'CALCULATED':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'RELATED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'MISSING':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const isDocumentSource = evidence.sourceType === 'PROJECT' || evidence.sourceType === 'TENDER' || evidence.sourceType === 'PROPOSAL';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900">
          <FileText className="w-5 h-5 text-indigo-700" />
          <span>Record Inspection: {evidence.sourceType.replace(/_/g, ' ')}</span>
        </div>
      }
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-slate-500 font-mono">
            Source ID: {evidence.sourceId}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Record View
          </Button>
        </div>
      }
    >
      <div className="space-y-5 py-1">
        {/* Source Header Banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border bg-white text-slate-800 border-slate-300 font-mono">
                {evidence.sourceType}
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getClassificationBadge(
                  evidence.classification
                )}`}
              >
                {evidence.classification} EVIDENCE
              </span>
            </div>
            {evidence.timestamp && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{new Date(evidence.timestamp).toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900">{evidence.title}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">{evidence.description}</p>
        </div>

        {/* Relationship to Finding */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Relationship to Finding</span>
          </div>
          <p className="text-indigo-900 leading-relaxed pl-5 font-sans">
            {evidence.relevance}
          </p>
        </div>

        {/* Document Content Analysis Disclaimer */}
        {isDocumentSource && (
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>Document metadata available; document content has not been analyzed.</span>
          </div>
        )}

        {/* Missing Evidence Notice */}
        {evidence.classification === 'MISSING' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <FileQuestion className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Evidence Not Available</span>
            </div>
            <p className="leading-relaxed">
              Evidence not available in the current system records. The monitoring calculation treats this information as unfiled or missing from authoritative registers.
            </p>
          </div>
        )}

        {/* Loading / Error States for Authoritative Record Fetch */}
        {loading && (
          <div className="flex items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-700" />
            <span>Resolving authoritative source record from project registers...</span>
          </div>
        )}

        {fetchError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            <p>Notice: Live repository query returned: {fetchError}. Displaying cached evidence attributes.</p>
          </div>
        )}

        {/* Live Authoritative Stored Record Payload */}
        {fetchedRecord && typeof fetchedRecord === 'object' && Object.keys(fetchedRecord).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800">
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-700" />
                <span>Authoritative Record Payload</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-full">
                Resolved Live
              </span>
            </div>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-64 space-y-1.5">
              {Object.entries(fetchedRecord).map(([key, val]) => (
                <div key={key} className="flex items-start justify-between border-b border-slate-800 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-emerald-400 shrink-0 mr-4 font-semibold">{key}:</span>
                  <span className="text-slate-200 text-right break-all">
                    {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Record Snippet & Stored Attributes */}
        {(!fetchedRecord || Object.keys(fetchedRecord).length === 0) && evidence.recordSnippet && Object.keys(evidence.recordSnippet).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Underlying Stored Record Fields</span>
            </div>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-64 space-y-1.5">
              {Object.entries(evidence.recordSnippet).map(([key, val]) => (
                <div key={key} className="flex items-start justify-between border-b border-slate-800 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-indigo-300 shrink-0 mr-4">{key}:</span>
                  <span className="text-slate-200 text-right break-all">
                    {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supporting Metrics */}
        {evidence.metrics && Object.keys(evidence.metrics).length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Derived Quantitative Metrics
            </span>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs font-mono">
              {Object.entries(evidence.metrics).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-slate-200/60 pb-1 last:border-0 last:pb-0">
                  <span className="text-slate-600">{k}:</span>
                  <span className="font-bold text-slate-900">{typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mandatory Regulatory Notice */}
        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Regulatory Evidentiary Standard:</strong> These records support the identification of a monitoring anomaly but do not, by themselves, establish fraud or wrongdoing. Administrative reconciliation and field verification are required before drawing institutional conclusions.
          </p>
        </div>
      </div>
    </Modal>
  );
};

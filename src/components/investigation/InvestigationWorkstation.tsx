// Bharat Tender Intelligence (BTI) — Investigation Workstation & Evidence Dossier
// Phase 8: Authoritative Government Investigation View for Anomaly Triage

import React, { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { EvidenceChainService } from '../../services/evidence/evidenceChainService';
import { EvidenceRecordModal } from './EvidenceRecordModal';
import {
  ProjectAnomaly,
  ANOMALY_TYPE_LABELS,
  VALID_ANOMALY_STATUS_TRANSITIONS,
} from '../../types/anomaly';
import {
  EvidenceChain,
  EvidenceReference,
  InvestigationNote,
  InvestigationAdvisory,
} from '../../types/evidence';
import {
  ShieldAlert,
  FileCheck2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Clock,
  History,
  Send,
  MessageSquare,
  AlertTriangle,
  FileText,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Bot,
} from 'lucide-react';

interface InvestigationWorkstationProps {
  anomaly: ProjectAnomaly | null;
  isOpen: boolean;
  onClose: () => void;
  onTakeAction: (anomaly: ProjectAnomaly) => void;
  onSelectAnomaly: (anomaly: ProjectAnomaly) => void;
  allAnomalies: ProjectAnomaly[];
}

export const InvestigationWorkstation: React.FC<InvestigationWorkstationProps> = ({
  anomaly,
  isOpen,
  onClose,
  onTakeAction,
  onSelectAnomaly,
  allAnomalies,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [evidenceChain, setEvidenceChain] = useState<EvidenceChain | null>(null);
  const [loadingChain, setLoadingChain] = useState<boolean>(true);
  const [aiAdvisory, setAiAdvisory] = useState<InvestigationAdvisory | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  // Inspected Evidence Item for Modal
  const [inspectedEvidence, setInspectedEvidence] = useState<EvidenceReference | null>(null);

  // Investigation Note Form State
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);

  // Copied State for Finding ID
  const [copiedFindingId, setCopiedFindingId] = useState<boolean>(false);

  // Active section view state
  const [activeSection, setActiveSection] = useState<
    'ALL' | 'WHY_FLAGGED' | 'EVIDENCE' | 'TIMELINE' | 'ADVISORY' | 'NOTES_AUDIT'
  >('ALL');

  // Load Evidence Chain on Anomaly Selection
  const loadChain = useCallback(async (targetAnomaly: ProjectAnomaly) => {
    setLoadingChain(true);
    setAiAdvisory(null);
    try {
      const chain = await EvidenceChainService.buildEvidenceChain(targetAnomaly);
      setEvidenceChain(chain);
    } catch (err: any) {
      console.error('[InvestigationWorkstation] Error building evidence chain:', err);
      showToast('Error Loading Evidence Chain', {
        message: err?.message || 'Could not assemble authoritative evidence chain.',
        type: 'error',
      });
    } finally {
      setLoadingChain(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (anomaly && isOpen) {
      loadChain(anomaly);
    } else {
      setEvidenceChain(null);
    }
  }, [anomaly, isOpen, loadChain]);

  // Trigger AI Advisory Generation
  const handleGenerateAiAdvisory = async () => {
    if (!anomaly || !evidenceChain) return;
    setLoadingAi(true);
    try {
      const advisory = await EvidenceChainService.fetchInvestigationAdvisory({
        findingId: evidenceChain.findingId,
        anomaly,
        evidenceItems: evidenceChain.evidenceItems,
        projectId: anomaly.projectId,
      });
      setAiAdvisory(advisory);
      showToast('AI Advisory Generated', {
        message: 'Grounded investigation intelligence synthesized successfully.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('[InvestigationWorkstation] AI advisory error:', err);
      showToast('AI Advisory Failed', {
        message: 'Using deterministic investigation checklist instead.',
        type: 'warning',
      });
    } finally {
      setLoadingAi(false);
    }
  };

  // Submit Append-Only Investigation Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !anomaly || !evidenceChain || !user) return;

    if (newNoteText.trim().length < 5) {
      showToast('Note Too Brief', {
        message: 'Please enter at least 5 characters of substantive observation.',
        type: 'warning',
      });
      return;
    }

    setSubmittingNote(true);
    try {
      const note = await EvidenceChainService.addInvestigationNote({
        findingId: evidenceChain.findingId,
        occurrenceId: anomaly.id,
        projectId: anomaly.projectId,
        note: newNoteText.trim(),
        user: {
          uid: (user as any).uid || user.id,
          id: user.id,
          name: user.name,
          role: user.role,
        },
      });

      setEvidenceChain((prev) => (prev ? { ...prev, investigationNotes: [note, ...prev.investigationNotes] } : prev));
      setNewNoteText('');
      showToast('Investigation Note Recorded', {
        message: 'Observation committed to immutable investigation log.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('[InvestigationWorkstation] Error saving investigation note:', err);
      showToast('Could Not Save Note', {
        message: err?.message || 'Failed to append investigation note.',
        type: 'error',
      });
    } finally {
      setSubmittingNote(false);
    }
  };

  const copyFindingId = () => {
    if (!evidenceChain) return;
    navigator.clipboard.writeText(evidenceChain.findingId);
    setCopiedFindingId(true);
    setTimeout(() => setCopiedFindingId(false), 2000);
  };

  if (!anomaly) return null;

  const allowedTransitions = VALID_ANOMALY_STATUS_TRANSITIONS[anomaly.status] || [];

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        width="2xl"
        title={
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  Government Investigation Dossier
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-300">
                  {anomaly.type}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                BTI Evidence Chain & Regulatory Decision Support Console
              </span>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Institutional Audit Trail Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close Dossier
              </Button>
              {allowedTransitions.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onTakeAction(anomaly)}
                  className="bg-[#002B49] hover:bg-[#001D32] text-white gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Take Status Action ({allowedTransitions.length})</span>
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-6 pb-6">
          {/* Section Navigation Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveSection('ALL')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeSection === 'ALL'
                  ? 'bg-[#002B49] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Sections
            </button>
            <button
              onClick={() => setActiveSection('WHY_FLAGGED')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeSection === 'WHY_FLAGGED'
                  ? 'bg-[#002B49] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Why Flagged
            </button>
            <button
              onClick={() => setActiveSection('EVIDENCE')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeSection === 'EVIDENCE'
                  ? 'bg-[#002B49] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Evidence Chain ({evidenceChain?.evidenceItems.length || 0})
            </button>
            <button
              onClick={() => setActiveSection('TIMELINE')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeSection === 'TIMELINE'
                  ? 'bg-[#002B49] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Related Timeline ({evidenceChain?.timeline.length || 0})
            </button>
            <button
              onClick={() => setActiveSection('ADVISORY')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeSection === 'ADVISORY'
                  ? 'bg-[#002B49] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
              <span>AI Advisory</span>
            </button>
            <button
              onClick={() => setActiveSection('NOTES_AUDIT')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeSection === 'NOTES_AUDIT'
                  ? 'bg-[#002B49] text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Notes & Audit ({evidenceChain?.investigationNotes.length || 0})
            </button>
          </div>

          {loadingChain ? (
            <div className="p-16 text-center text-slate-500 text-xs">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#002B49]" />
              Resolving authoritative project records and constructing evidence graph...
            </div>
          ) : !evidenceChain ? (
            <div className="p-12 text-center text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-xl">
              Failed to load evidence chain records for this finding.
            </div>
          ) : (
            <>
              {/* ==================================================== */}
              {/* 1. FINDING SUMMARY & IDENTITY DUALITY */}
              {/* ==================================================== */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                        anomaly.severity === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : anomaly.severity === 'HIGH'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-blue-50 text-blue-800 border-blue-300'
                      }`}
                    >
                      {anomaly.severity} SEVERITY
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium border bg-white text-slate-800 border-slate-300">
                      STATUS: {(anomaly.status || 'OPEN').replace('_', ' ')}
                    </span>
                    {anomaly.isConditionActive === false ? (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700 border border-slate-300">
                        Condition Cleared (Historical)
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        Active Surveillance Signal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Detected: {new Date(anomaly.detectedAt).toLocaleDateString('en-IN')}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{anomaly.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{anomaly.explanation}</p>
                </div>

                {/* Identity Separation: Stable Finding ID vs Occurrence ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Stable Finding Identity
                      </span>
                      <button
                        onClick={copyFindingId}
                        className="text-slate-400 hover:text-slate-700 p-0.5"
                        title="Copy Stable Finding ID"
                      >
                        {copiedFindingId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-indigo-950 truncate" title={evidenceChain.findingId}>
                      {evidenceChain.findingId}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Stable across rescans, recurrences, and terminal cycles.
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Occurrence Document ID
                    </span>
                    <div className="font-mono text-[11px] font-bold text-slate-800 truncate" title={anomaly.id}>
                      {anomaly.id}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Specific snapshot document for this detection cycle.
                    </div>
                  </div>
                </div>

                {/* Project Metadata Details */}
                <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-indigo-950">
                    <span className="font-bold">Project:</span>
                    <span className="font-mono font-bold text-indigo-900">
                      {evidenceChain.projectNumber || anomaly.projectId}
                    </span>
                  </div>
                  <div className="text-slate-700 font-medium">
                    {evidenceChain.projectTitle || 'MPLAD Development Scheme'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Executing Agency: <strong className="text-slate-700">{evidenceChain.agencyName || 'National Civil Infra Ltd.'}</strong>
                  </div>
                </div>
              </div>

              {/* ==================================================== */}
              {/* 2. WHY WAS IT FLAGGED? (DETERMINISTIC BREAKDOWN) */}
              {/* ==================================================== */}
              {(activeSection === 'ALL' || activeSection === 'WHY_FLAGGED') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-700" />
                      <span>Why Was It Flagged? (Deterministic Rule Audit)</span>
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {evidenceChain.whyFlagged.ruleKey}
                    </span>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 text-xs">
                    <div className="font-bold text-slate-900 border-b border-slate-100 pb-2">
                      Rule: {evidenceChain.whyFlagged.ruleName}
                    </div>

                    {/* Inputs Table */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Authoritative Record Inputs Evaluated
                      </span>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-2">Metric Label</th>
                              <th className="p-2">Observed Stored Value</th>
                              <th className="p-2">Source Origin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {evidenceChain.whyFlagged.inputs.map((inp, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-2 font-semibold text-slate-700">{inp.label}</td>
                                <td className="p-2 font-mono font-bold text-indigo-900">{inp.value}</td>
                                <td className="p-2 text-slate-500 text-[11px]">{inp.source}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mathematical Formula / Calculation */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Mathematical Formula Executed
                      </span>
                      <div className="font-mono font-bold text-indigo-950 text-[11px]">
                        {evidenceChain.whyFlagged.calculation}
                      </div>
                    </div>

                    {/* Threshold vs Result */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-900">
                        <strong className="block text-[10px] uppercase tracking-wider text-amber-800">
                          Monitoring Threshold
                        </strong>
                        <span className="mt-0.5 block">{evidenceChain.whyFlagged.threshold}</span>
                      </div>
                      <div className="p-2.5 bg-rose-50/60 border border-rose-200 rounded-lg text-rose-900">
                        <strong className="block text-[10px] uppercase tracking-wider text-rose-800">
                          Deterministic Outcome
                        </strong>
                        <span className="mt-0.5 block">{evidenceChain.whyFlagged.result}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* 3. EVIDENCE CHAIN (CHRONOLOGICAL SUPPORTING ARTIFACTS) */}
              {/* ==================================================== */}
              {(activeSection === 'ALL' || activeSection === 'EVIDENCE') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-700" />
                      <span>Evidence Chain ({evidenceChain.evidenceItems.length} Records)</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Authoritative Records Only — No Synthesized Claims
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {evidenceChain.evidenceItems.map((item) => {
                      const isMissing = item.classification === 'MISSING';
                      return (
                        <div
                          key={item.evidenceId}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isMissing
                              ? 'bg-amber-50/40 border-amber-200'
                              : 'bg-white border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  item.classification === 'DIRECT'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : item.classification === 'CALCULATED'
                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    : item.classification === 'RELATED'
                                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                              >
                                {item.classification}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-bold">
                                {item.sourceType}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                Ref: {item.sourceId}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {item.timestamp && (
                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {new Date(item.timestamp).toLocaleDateString('en-IN')}
                                </span>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInspectedEvidence(item)}
                                className="text-xs h-7 px-2.5 gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                              >
                                <span>Inspect Record</span>
                                <ChevronRight className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.description}</p>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-[11px] text-indigo-950 bg-indigo-50/40 p-2 rounded-lg">
                            <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Relevance:</strong> {item.relevance}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* 4. RELATED PROJECT LIFECYCLE TIMELINE */}
              {/* ==================================================== */}
              {(activeSection === 'ALL' || activeSection === 'TIMELINE') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-700" />
                      <span>Project Implementation Lifecycle Timeline</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Chronological Events ({evidenceChain.timeline.length})
                    </span>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {evidenceChain.timeline.map((event) => (
                        <div key={event.eventId} className="relative group">
                          {/* Marker Dot */}
                          <div
                            className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 bg-white ${
                              event.isDirectlySupportingFinding
                                ? 'border-rose-600 bg-rose-50'
                                : 'border-indigo-600'
                            }`}
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${event.badgeColor}`}
                                >
                                  {event.badgeText}
                                </span>
                                <span className="font-bold text-slate-900">{event.title}</span>
                              </div>
                              <span className="text-slate-400 font-mono text-[10px]">
                                {new Date(event.date).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed pl-1">
                              {event.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* 5. RELATED ANOMALIES ON THIS PROJECT */}
              {/* ==================================================== */}
              {(activeSection === 'ALL' || activeSection === 'WHY_FLAGGED') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Related Monitoring Indicators on this Project ({evidenceChain.relatedFindings.length})</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Cross-Signal Context Only (Not Proof of Wrongdoing)
                    </span>
                  </div>

                  {evidenceChain.relatedFindings.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      No other concurrent anomaly findings active on this project.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {evidenceChain.relatedFindings.map((rel) => {
                        const matchingFullAnomaly = allAnomalies.find((a) => a.id === rel.occurrenceId);
                        return (
                          <div
                            key={rel.occurrenceId}
                            className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-300 transition-all"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                                    rel.severity === 'CRITICAL'
                                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}
                                >
                                  {rel.severity}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {rel.type}
                                </span>
                                <span className="text-[10px] font-bold text-slate-600">
                                  [{rel.status}]
                                </span>
                              </div>
                              <div className="font-bold text-slate-900">{rel.title}</div>
                            </div>
                            {matchingFullAnomaly && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectAnomaly(matchingFullAnomaly)}
                                className="text-xs h-7 px-2.5 shrink-0"
                              >
                                View Finding
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* 6. AI INVESTIGATION ADVISORY (GROUNDED & ADVISORY) */}
              {/* ==================================================== */}
              {(activeSection === 'ALL' || activeSection === 'ADVISORY') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-indigo-700" />
                      <span>AI Investigation Advisory (Institutional Decision Support)</span>
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAiAdvisory}
                      disabled={loadingAi}
                      className="text-xs gap-1.5 border-indigo-200 text-indigo-800 hover:bg-indigo-50"
                    >
                      {loadingAi ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>{aiAdvisory ? 'Refresh AI Advisory' : 'Synthesize AI Advisory'}</span>
                    </Button>
                  </div>

                  {/* Mandatory Advisory Disclaimer Banner */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>Advisory Decision Support Notice:</strong> The AI advisory layer provides structured synthesis of stored project records and suggests neutral administrative inquiry areas. It explicitly does not declare fraud, determine legal liability, or substitute for executive verification.
                    </div>
                  </div>

                  {loadingAi ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-500 text-xs space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-700" />
                      <span>Synthesizing grounded investigation advisory via Gemini 3.8 Flash...</span>
                    </div>
                  ) : aiAdvisory ? (
                    <div className="p-4 bg-white border border-indigo-100 rounded-xl space-y-4 text-xs">
                      {/* Summary */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Administrative Synthesis
                        </span>
                        <p className="text-slate-800 font-medium leading-relaxed">
                          {aiAdvisory.summary}
                        </p>
                      </div>

                      {/* Evidence Summary */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Evidence Base Evaluated
                        </span>
                        <p className="text-slate-700 leading-relaxed">
                          {aiAdvisory.evidenceSummary}
                        </p>
                      </div>

                      {/* Recommended Review Areas */}
                      {aiAdvisory.recommendedReviewAreas && aiAdvisory.recommendedReviewAreas.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-indigo-900">
                            Recommended Review Areas & Inquiries
                          </span>
                          <ul className="space-y-1.5">
                            {aiAdvisory.recommendedReviewAreas.map((q, idx) => (
                              <li
                                key={idx}
                                className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg text-indigo-950 flex items-start gap-2 text-xs"
                              >
                                <span className="font-bold text-indigo-700 shrink-0">{idx + 1}.</span>
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Missing Evidence */}
                      {aiAdvisory.missingEvidence && aiAdvisory.missingEvidence.length > 0 && (
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1 text-amber-950">
                          <span className="text-[10px] uppercase font-bold text-amber-800">
                            Missing or Unverified System Information
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-xs">
                            {aiAdvisory.missingEvidence.map((m, idx) => (
                              <li key={idx}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Model & Attribution Footer */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10px] text-slate-400">
                        <span>Provider: <strong className="text-slate-600">{aiAdvisory.provider}</strong></span>
                        <span>Model: <strong className="text-slate-600 font-mono">{aiAdvisory.model}</strong></span>
                        <span>Generated: {new Date(aiAdvisory.timestamp).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs space-y-2">
                      <p>Click "Synthesize AI Advisory" above to generate a grounded, decision-support analysis of this finding based strictly on authoritative records.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* 7. INVESTIGATION NOTES (APPEND-ONLY) */}
              {/* ==================================================== */}
              {(activeSection === 'ALL' || activeSection === 'NOTES_AUDIT') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-indigo-700" />
                      <span>Investigation Notes & Observations ({evidenceChain.investigationNotes.length})</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Append-Only Regulatory Record
                    </span>
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Append Administrative Observation / Inquiry Finding:
                    </label>
                    <textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Record inspection observations, communication with agency, or directives issued..."
                      rows={3}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">
                        Notes become part of the immutable investigation audit log.
                      </span>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={submittingNote || !newNoteText.trim()}
                        className="bg-[#002B49] hover:bg-[#001D32] text-white text-xs gap-1.5"
                      >
                        {submittingNote ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        <span>Save Note</span>
                      </Button>
                    </div>
                  </form>

                  {/* Existing Notes Feed */}
                  {evidenceChain.investigationNotes.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      No investigation notes have been recorded for this finding yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {evidenceChain.investigationNotes.map((note) => (
                        <div
                          key={note.noteId}
                          className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">{note.authorName}</span>
                              <span>•</span>
                              <span className="text-indigo-700 uppercase font-semibold text-[10px]">
                                {note.authorRole}
                              </span>
                            </div>
                            <span>{new Date(note.timestamp).toLocaleString('en-IN')}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed font-sans pl-1">
                            {note.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* 8. AUDIT HISTORY */}
              {/* ==================================================== */}
              {(activeSection === 'ALL' || activeSection === 'NOTES_AUDIT') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-600" />
                      <span>Immutable Audit Trail for this Finding ({evidenceChain.auditEvents.length})</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Cryptographically Bound Log
                    </span>
                  </div>

                  {evidenceChain.auditEvents.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      No status mutation events recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {evidenceChain.auditEvents.map((ev) => (
                        <div
                          key={ev.eventId}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800 font-mono text-[11px]">
                              {ev.action}
                            </div>
                            <div className="text-slate-600 text-[11px]">{ev.notes}</div>
                            <div className="text-[10px] text-slate-400">
                              Actor: {ev.actorName || ev.actorId} ({ev.actorRole})
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(ev.timestamp).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Drawer>

      {/* Underlying Record Inspection Modal */}
      <EvidenceRecordModal
        isOpen={Boolean(inspectedEvidence)}
        onClose={() => setInspectedEvidence(null)}
        evidence={inspectedEvidence}
        projectId={anomaly.projectId}
      />
    </>
  );
};

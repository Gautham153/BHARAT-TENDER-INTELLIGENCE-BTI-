import React from 'react';
import { FileText, Download, ExternalLink, BookOpen, Code2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';

export const ResourcesPage: React.FC = () => {
  const { showToast } = useToast();

  const documents = [
    {
      title: 'Revised MPLADS Guidelines (2023 Edition)',
      category: 'Statutory Guidelines',
      size: '2.4 MB PDF',
      source: 'Ministry of Statistics & Programme Implementation',
    },
    {
      title: 'CPWD District Schedule of Rates (DSR-2024)',
      category: 'Rate Benchmark Standards',
      size: '14.8 MB PDF',
      source: 'Central Public Works Department',
    },
    {
      title: 'Central Vigilance Commission (CVC) Procurement Manual',
      category: 'Integrity Guidelines',
      size: '3.1 MB PDF',
      source: 'Central Vigilance Commission',
    },
    {
      title: 'Bharat Tender Intelligence Technical Whitepaper',
      category: 'AI Architecture',
      size: '1.8 MB PDF',
      source: 'BTI Research Team',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <div className="text-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[#002B49] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          Knowledge Base & Documentation
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Statutory Guidelines, DSR Manuals & Reference Standards
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Official publications, procurement manuals, and schema specifications governing MPLAD implementation.
        </p>
      </div>

      <div className="space-y-3">
        {documents.map((doc, idx) => (
          <Card key={idx} className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-[#002B49] rounded-xl shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{doc.category}</span>
                <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
                <div className="text-xs text-slate-500">{doc.source} • {doc.size}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => showToast('Document Download Initiated', { message: `${doc.title} downloaded.` })}
            >
              Download
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

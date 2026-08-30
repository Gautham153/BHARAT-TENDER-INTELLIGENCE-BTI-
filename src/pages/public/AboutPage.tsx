import React from 'react';
import { ShieldCheck, Award, Target, Landmark, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <div className="text-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[#002B49] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
          SIH National Innovation Framework
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          About Bharat Tender Intelligence (BTI)
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Solving the challenge of anomaly detection, cartel prevention, and fund optimization in the Members of Parliament Local Area Development Scheme (MPLADS).
        </p>
      </div>

      <Card className="p-8 space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#002B49]" />
            <span>The Problem Statement</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            The MPLAD Scheme allocates ₹5 Crores annually to each Member of Parliament to recommend developmental works addressing durable community asset needs. However, manual scrutiny across 543 Lok Sabha and 245 Rajya Sabha constituencies often faces systemic vulnerabilities: bidder cartels, duplicate fund sanctioning, non-adherence to District Schedule of Rates, and delayed field verification.
          </p>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Our Solution Architecture</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Bharat Tender Intelligence delivers an algorithmic integrity shield. By combining machine learning graph clustering for entity collusion detection, natural language processing for BoQ anomaly extraction, and geo-fenced computer vision for physical progress audit, BTI empowers District Magistrates, Vigilance Officers, and Citizens with uncompromising transparency.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <div className="font-bold text-slate-900">MoSPI Aligned</div>
            <div className="text-slate-500">Ministry of Statistics and Programme Implementation guidelines</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <div className="font-bold text-slate-900">PFMS Integrated</div>
            <div className="text-slate-500">Direct linkage with Public Financial Management System protocols</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl space-y-1">
            <div className="font-bold text-slate-900">CVC Standardized</div>
            <div className="text-slate-500">Adheres to Central Vigilance Commission anti-fraud circulars</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

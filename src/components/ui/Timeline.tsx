import React from 'react';
import { LucideIcon, Check } from 'lucide-react';
import { motion } from 'motion/react';

export interface TimelineStep {
  id: string;
  stepNumber: string; // e.g. "01"
  title: string;
  description: string;
  icon: LucideIcon;
  status?: 'completed' | 'current' | 'upcoming';
}

export interface TimelineProps {
  steps: TimelineStep[];
  activeStepIndex?: number;
  orientation?: 'horizontal' | 'vertical' | 'responsive';
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  steps,
  activeStepIndex = 0,
  orientation = 'responsive',
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Desktop Horizontal View */}
      <div
        className={`${
          orientation === 'vertical' ? 'hidden' : orientation === 'responsive' ? 'hidden md:flex' : 'flex'
        } items-start justify-between relative`}
      >
        {/* Continuous background connecting line */}
        <div className="absolute top-6 left-8 right-8 h-0.5 bg-slate-200 -z-0" />

        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < activeStepIndex;
          const isCurrent = index === activeStepIndex;

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center text-center px-2 relative z-10">
              {/* Step circle node */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-xs mb-3 ${
                  isCurrent
                    ? 'bg-[#002B49] text-white border-[#002B49] ring-4 ring-blue-100'
                    : isCompleted
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </motion.div>

              <div className="text-[11px] font-bold tracking-widest text-[#002B49] uppercase mb-0.5">
                {step.stepNumber}
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug mb-1">{step.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[150px]">{step.description}</p>
            </div>
          );
        })}
      </div>

      {/* Mobile Vertical View */}
      <div
        className={`${
          orientation === 'horizontal' ? 'hidden' : orientation === 'responsive' ? 'flex md:hidden' : 'flex'
        } flex-col relative pl-6 border-l-2 border-slate-200 ml-4 space-y-7 py-2`}
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < activeStepIndex;
          const isCurrent = index === activeStepIndex;

          return (
            <div key={step.id} className="relative">
              {/* Node indicator on left line */}
              <div
                className={`absolute -left-[33px] top-0 w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold ${
                  isCurrent
                    ? 'bg-[#002B49] text-white border-[#002B49] ring-4 ring-blue-50'
                    : isCompleted
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-500 border-slate-300'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>

              <div>
                <span className="text-[10px] font-bold tracking-wider text-[#002B49] uppercase">
                  Step {step.stepNumber}
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{step.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

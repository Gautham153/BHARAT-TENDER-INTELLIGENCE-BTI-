import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  number: number;
  title: string;
  subtitle: string;
}

export interface RegistrationStepperProps {
  currentStep: number;
  steps?: StepItem[];
  onStepClick?: (stepNumber: number) => void;
}

const DEFAULT_STEPS: StepItem[] = [
  { number: 1, title: 'Account Details', subtitle: 'Official Representative' },
  { number: 2, title: 'Organization Verification', subtitle: 'GSTIN & Statutory Data' },
  { number: 3, title: 'Review & Declaration', subtitle: 'Statutory Undertaking' },
];

export const RegistrationStepper: React.FC<RegistrationStepperProps> = ({
  currentStep,
  steps = DEFAULT_STEPS,
  onStepClick,
}) => {
  return (
    <div className="w-full py-4 px-2">
      <div className="flex items-center justify-between relative">
        {/* Background Connecting Line */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />
        <div
          className="absolute top-4 left-6 h-0.5 bg-[#002B49] transition-all duration-300 -z-0"
          style={{
            width: `${((Math.min(currentStep, steps.length) - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isClickable = onStepClick && step.number < currentStep;

          return (
            <div
              key={step.number}
              onClick={() => isClickable && onStepClick(step.number)}
              className={`flex flex-col items-center relative z-10 ${
                isClickable ? 'cursor-pointer' : ''
              }`}
            >
              {/* Step Circle Indicator */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-[#002B49] text-white ring-4 ring-blue-100'
                    : 'bg-white border-2 border-slate-300 text-slate-500'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.number}
              </div>

              {/* Step Labels */}
              <div className="text-center mt-2">
                <div
                  className={`text-xs font-bold tracking-tight ${
                    isCurrent ? 'text-[#002B49]' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {step.title}
                </div>
                <div className="hidden sm:block text-[10px] text-slate-400 mt-0.5 font-medium">
                  {step.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

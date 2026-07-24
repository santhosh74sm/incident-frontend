import React from 'react';
import { Check } from 'lucide-react';
import { SCANNER_STEPS } from '../utils/constants';

export function ProgressIndicator({ currentStep, steps = SCANNER_STEPS }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-label={`Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep]}`}
    >
      {steps.map((label, idx) => {
        const isActive = idx <= currentStep;
        return (
          <div
            className={isActive ? 'active' : ''}
            key={label}
            aria-current={idx === currentStep ? 'step' : undefined}
          >
            <i>{idx < currentStep ? <Check size={14} /> : idx + 1}</i>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

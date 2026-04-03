'use client';

import { WizardProvider, useWizard } from './wizard-context';
import { ProductSelectStep } from './product-select-step';
import { BriefStep } from './brief-step';
import { ScriptStep } from './script-step';
import { SceneStep } from './scene-step';
import { ReviewStep } from './review-step';
import { WIZARD_STEPS } from './types';
import { cn } from '@/lib/utils';

interface AdCreationWizardProps {
  onJobCreated?: (jobId: string) => void;
  onComplete?: (jobId: string) => void;
}

function WizardStepper() {
  const { step } = useWizard();

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {WIZARD_STEPS.map((stepName, index) => (
          <div key={stepName} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  index < step
                    ? 'border-primary bg-primary text-primary-foreground'
                    : index === step
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {index < step ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs font-medium',
                  index <= step ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {stepName}
              </span>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 w-8 md:w-16',
                  index < step ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WizardContent({
  onJobCreated,
}: {
  onJobCreated?: (jobId: string) => void;
}) {
  const { step, setStep } = useWizard();

  const handleNext = () => {
    if (step < WIZARD_STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleJobCreated = (jobId: string) => {
    onJobCreated?.(jobId);
  };

  switch (step) {
    case 0:
      return <ProductSelectStep onNext={handleNext} />;
    case 1:
      return <BriefStep onNext={handleNext} onBack={handleBack} />;
    case 2:
      return <ScriptStep onNext={handleNext} onBack={handleBack} />;
    case 3:
      return <SceneStep onNext={handleNext} onBack={handleBack} />;
    case 4:
      return <ReviewStep onBack={handleBack} onSubmit={handleJobCreated} />;
    default:
      return null;
  }
}

export function AdCreationWizard({ onJobCreated, onComplete }: AdCreationWizardProps) {
  return (
    <WizardProvider>
      <div className="mx-auto max-w-3xl">
        <WizardStepper />
        <WizardContent onJobCreated={onJobCreated || onComplete} />
      </div>
    </WizardProvider>
  );
}

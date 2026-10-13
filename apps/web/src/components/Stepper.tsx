// FR-N/A, NFR-011, ADR-021: Stepper component for setup workflows.
import React from "react";

export interface StepItem {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStepIndex }) => {
  return (
    <nav aria-label="Progress">
      <ol className="abh-stepper">
        {steps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;

          return (
            <React.Fragment key={step.id}>
              {index > 0 && <li className="abh-stepper-connector" aria-hidden="true" />}
              <li
                className={`abh-stepper-item ${isCompleted ? "abh-stepper-item--completed" : ""}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="abh-stepper-box" aria-hidden="true">
                  {isCompleted ? "✓" : index + 1}
                </span>
                <span className="abh-stepper-label">{step.label}</span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

// FR-N/A, NFR-011, ADR-021: Progress indicator component.
import React from "react";

export interface ProgressProps {
  label: string;
  value?: number; // 0 to 100 for determinate, undefined for indeterminate
}

export const Progress: React.FC<ProgressProps> = ({ label, value }) => {
  const isDeterminate = typeof value === "number";
  const clamped = isDeterminate ? Math.min(100, Math.max(0, value)) : undefined;

  return (
    <div className="abh-progress-wrapper">
      <div className="abh-progress-header">
        <span>{label}</span>
        {isDeterminate && <span>{Math.round(clamped!)}%</span>}
      </div>
      <div
        role="progressbar"
        aria-valuenow={isDeterminate ? clamped : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="abh-progress-track"
      >
        <div
          className={`abh-progress-bar ${!isDeterminate ? "abh-progress-bar--indeterminate" : ""}`}
          style={isDeterminate ? { width: `${clamped}%` } : undefined}
        />
      </div>
    </div>
  );
};

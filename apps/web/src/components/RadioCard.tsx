// FR-N/A, NFR-011, ADR-021: Radio card component for provider and selection screens.
import React, { type ReactNode } from "react";

export interface RadioCardProps {
  title: string;
  description: string;
  monogram: string;
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
  tag?: string;
  extra?: ReactNode;
}

export const RadioCard: React.FC<RadioCardProps> = ({
  title,
  description,
  monogram,
  checked,
  onChange,
  disabled = false,
  comingSoon = false,
  tag,
  extra,
}) => {
  const isInteractive = !disabled && !comingSoon;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={!isInteractive}
      className="abh-radio-card"
      onClick={() => isInteractive && onChange?.()}
    >
      <div className="abh-radio-card-monogram" aria-hidden="true">
        {monogram}
      </div>
      <div className="abh-radio-card-body">
        <div className="abh-radio-card-header">
          <h3 className="abh-radio-card-title">{title}</h3>
          {checked && <span className="abh-radio-card-tag">SELECTED</span>}
          {!checked && comingSoon && <span className="abh-radio-card-tag">COMING SOON</span>}
          {!checked && !comingSoon && tag && <span className="abh-radio-card-tag">{tag}</span>}
        </div>
        <p className="abh-radio-card-desc">{description}</p>
        {extra}
      </div>
    </button>
  );
};

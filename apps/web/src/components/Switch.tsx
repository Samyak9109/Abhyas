// FR-N/A, NFR-011, ADR-021: Accessible switch control.
import React, { useId } from "react";

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  id,
}) => {
  const generatedId = useId();
  const switchId = id || generatedId;
  const labelId = `${switchId}-label`;

  return (
    <div className="abh-switch-container" onClick={() => !disabled && onChange(!checked)}>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        className="abh-switch"
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      >
        <span className="abh-switch-knob" aria-hidden="true" />
      </button>
      <span id={labelId} className="abh-switch-label">
        {label} ({checked ? "ON" : "OFF"})
      </span>
    </div>
  );
};

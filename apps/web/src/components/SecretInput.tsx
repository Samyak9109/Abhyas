// FR-N/A, NFR-011, ADR-021: Masked secret input with toggle and no autofill.
import React, { type InputHTMLAttributes, useId, useState } from "react";

export interface SecretInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  helperText?: string;
  errorMessage?: string;
}

export const SecretInput = React.forwardRef<HTMLInputElement, SecretInputProps>(
  ({ label, helperText, errorMessage, className = "", id, ...props }, ref) => {
    const [showSecret, setShowSecret] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const isError = Boolean(errorMessage);
    const describedBy = isError ? errorId : helperText ? helperId : undefined;

    return (
      <div className="abh-form-field">
        <label htmlFor={inputId} className="abh-label">
          {label}
        </label>
        <div className="abh-input-wrapper">
          <input
            ref={ref}
            id={inputId}
            type={showSecret ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            className={`abh-input ${isError ? "abh-input--error" : ""} ${className}`}
            style={{ paddingRight: "48px" }}
            aria-invalid={isError ? "true" : undefined}
            aria-describedby={describedBy}
            {...props}
          />
          <button
            type="button"
            className="abh-secret-toggle"
            onClick={() => setShowSecret((prev) => !prev)}
            aria-label={showSecret ? "Hide secret value" : "Show secret value"}
            title={showSecret ? "Hide" : "Show"}
          >
            {showSecret ? "HIDE" : "SHOW"}
          </button>
        </div>
        {isError && (
          <span id={errorId} className="abh-error-text" role="alert">
            <span aria-hidden="true">✕</span> {errorMessage}
          </span>
        )}
        {!isError && helperText && (
          <span id={helperId} className="abh-helper-text">
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

SecretInput.displayName = "SecretInput";

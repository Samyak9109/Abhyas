// FR-N/A, NFR-011, ADR-021: Form input primitive with label, helper, and error states.
import React, { type InputHTMLAttributes, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  errorMessage?: string;
  isProse?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, errorMessage, isProse = false, className = "", id, ...props }, ref) => {
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
            className={`abh-input ${isProse ? "abh-input--prose" : ""} ${isError ? "abh-input--error" : ""} ${className}`}
            aria-invalid={isError ? "true" : undefined}
            aria-describedby={describedBy}
            {...props}
          />
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

Input.displayName = "Input";

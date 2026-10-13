// FR-N/A, NFR-011, ADR-021: Toast notification component for confirmations.
import React from "react";

export interface ToastProps {
  message: string;
  onDismiss?: () => void;
  icon?: string;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, icon = "✓" }) => {
  return (
    <div className="abh-toast" role="status" aria-live="polite">
      <span aria-hidden="true" style={{ color: "var(--success)", fontWeight: 700 }}>
        {icon}
      </span>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "0 4px",
            fontFamily: "var(--font-mono)",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

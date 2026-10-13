// FR-N/A, NFR-011, ADR-021: Callout message box.
import React, { type ReactNode } from "react";

export interface CalloutProps {
  variant?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
}

export const Callout: React.FC<CalloutProps> = ({ variant = "info", title, children }) => {
  const icon = {
    info: "ℹ",
    warning: "⚠",
    danger: "✕",
    success: "✓",
  }[variant];

  return (
    <div className={`abh-callout abh-callout--${variant}`} role="status">
      <span aria-hidden="true" style={{ fontWeight: "bold" }}>
        {icon}
      </span>
      <div>
        {title && <strong style={{ display: "block", marginBottom: "4px" }}>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
};

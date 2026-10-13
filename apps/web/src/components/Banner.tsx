// FR-N/A, NFR-011, ADR-021: Banner component for persistent app-wide alerts.
import React, { type ReactNode } from "react";

export interface BannerProps {
  message: string;
  variant?: "info" | "warning" | "danger";
  action?: ReactNode;
}

export const Banner: React.FC<BannerProps> = ({ message, variant = "info", action }) => {
  return (
    <div
      className={`abh-banner abh-banner--${variant}`}
      role={variant === "danger" ? "alert" : "status"}
    >
      <span>{message}</span>
      {action && <div>{action}</div>}
    </div>
  );
};

// FR-N/A, NFR-011, ADR-021: FAQ / collapsible disclosure component.
import React, { type ReactNode } from "react";

export interface DisclosureProps {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  summary,
  children,
  defaultOpen = false,
}) => {
  return (
    <details className="abh-disclosure" open={defaultOpen}>
      <summary className="abh-disclosure-summary">
        <span>{summary}</span>
        <span aria-hidden="true" style={{ fontFamily: "var(--font-mono)" }}>
          +
        </span>
      </summary>
      <div className="abh-disclosure-content">{children}</div>
    </details>
  );
};

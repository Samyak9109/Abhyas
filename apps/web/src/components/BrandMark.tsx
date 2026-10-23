// FR-N/A, design.md: Brand identity mark rendering the official pixel interviewer glyph with crisp theme adaptation.
import type { CSSProperties } from "react";

interface BrandMarkProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function BrandMark({ size = 28, className = "", style }: BrandMarkProps) {
  return (
    <span
      className={`abh-brand-mark ${className}`.trim()}
      aria-hidden="true"
      style={{ width: size, height: size, ...style }}
    >
      <img
        src="/abhyas-mark-dark.svg"
        alt=""
        className="abh-brand-mark-img abh-brand-mark-img--ink"
        width={size}
        height={size}
      />
      <img
        src="/abhyas-mark.svg"
        alt=""
        className="abh-brand-mark-img abh-brand-mark-img--paper"
        width={size}
        height={size}
      />
    </span>
  );
}

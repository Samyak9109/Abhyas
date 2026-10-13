// FR-N/A, NFR-011, ADR-021: Skeleton placeholder for content loading states.
import React, { type CSSProperties } from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "20px",
  className = "",
  style,
}) => {
  return (
    <div
      className={`abh-skeleton ${className}`}
      aria-hidden="true"
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
};

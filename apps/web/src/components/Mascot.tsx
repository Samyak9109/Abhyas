// FR-033, ADR-021, design.md 4.8: Pixel monitor-head interviewer mascot component.
import type { CSSProperties } from "react";

export type MascotFace =
  | "idle"
  | "ready"
  | "speaking"
  | "listening"
  | "thinking"
  | "paused"
  | "problem";
export type MascotSize = "hero" | "card" | "compact";

export interface MascotProps {
  face?: MascotFace;
  size?: MascotSize;
  className?: string;
  style?: CSSProperties;
  alt?: string;
  ariaHidden?: boolean;
}

export function Mascot({
  face = "ready",
  size = "card",
  className = "",
  style,
  alt = "Pixel mascot: a retro computer monitor with a smiling face",
  ariaHidden = false,
}: MascotProps) {
  const normalizedFace: MascotFace = face === "idle" ? "ready" : face;

  // Render facial pixels based on face state on the 8px pixel grid
  const renderScreenContent = () => {
    switch (normalizedFace) {
      case "problem":
        // Eyes as dashes (half height), small flat neutral mouth
        return (
          <g fill="var(--accent)">
            {/* Left Eye: dash */}
            <rect x="48" y="44" width="16" height="4" />
            {/* Right Eye: dash */}
            <rect x="80" y="44" width="16" height="4" />
            {/* Mouth: small flat neutral line */}
            <rect x="64" y="64" width="16" height="4" />
          </g>
        );

      case "paused":
        // Eyes half-height, flat line mouth
        return (
          <g fill="var(--accent)">
            {/* Left Eye: half height */}
            <rect x="48" y="44" width="12" height="8" />
            {/* Right Eye: half height */}
            <rect x="84" y="44" width="12" height="8" />
            {/* Mouth: flat line */}
            <rect x="58" y="64" width="28" height="4" />
          </g>
        );

      case "listening":
        // Eyes slightly taller (8x18), small flat mouth
        return (
          <g fill="var(--accent)">
            {/* Left Eye */}
            <rect x="48" y="38" width="12" height="18" />
            {/* Right Eye */}
            <rect x="84" y="38" width="12" height="18" />
            {/* Mouth: flat line */}
            <rect x="62" y="64" width="20" height="4" />
          </g>
        );

      case "thinking":
        // Tall eyes, 3 dots in place of mouth
        return (
          <g fill="var(--accent)">
            {/* Left Eye */}
            <rect x="48" y="40" width="12" height="16" />
            {/* Right Eye */}
            <rect x="84" y="40" width="12" height="16" />
            {/* 3 Dots in place of mouth */}
            <rect x="54" y="64" width="6" height="6" className="abh-mascot-dot abh-mascot-dot-1" />
            <rect x="69" y="64" width="6" height="6" className="abh-mascot-dot abh-mascot-dot-2" />
            <rect x="84" y="64" width="6" height="6" className="abh-mascot-dot abh-mascot-dot-3" />
          </g>
        );

      case "speaking":
        // Tall eyes, open mouth
        return (
          <g fill="var(--accent)">
            {/* Left Eye */}
            <rect x="48" y="40" width="12" height="16" />
            {/* Right Eye */}
            <rect x="84" y="40" width="12" height="16" />
            {/* Open mouth */}
            <rect x="56" y="60" width="32" height="10" />
            <rect x="60" y="70" width="24" height="4" />
          </g>
        );

      case "ready":
      default:
        // Idle/Ready: Tall eyes (8x16), smile (6 pixels)
        return (
          <g fill="var(--accent)">
            {/* Left Eye */}
            <rect x="48" y="40" width="12" height="16" />
            {/* Right Eye */}
            <rect x="84" y="40" width="12" height="16" />
            {/* Smile: curved pixel smile */}
            <rect x="54" y="62" width="6" height="6" />
            <rect x="60" y="66" width="24" height="6" />
            <rect x="84" y="62" width="6" height="6" />
          </g>
        );
    }
  };

  if (size === "compact") {
    // 44px compact indicator tile with 3 vertical bars
    return (
      <svg
        className={`abh-mascot abh-mascot-compact ${className}`}
        width="44"
        height="44"
        viewBox="0 0 44 44"
        role={ariaHidden ? "presentation" : "img"}
        aria-hidden={ariaHidden}
        aria-label={ariaHidden ? undefined : alt}
        style={style}
      >
        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          fill="var(--surface-2)"
          stroke="var(--line-strong)"
          strokeWidth="2"
        />
        <rect x="10" y="12" width="5" height="20" fill="var(--accent)" />
        <rect x="19" y="8" width="6" height="28" fill="var(--accent)" />
        <rect x="29" y="14" width="5" height="16" fill="var(--accent)" />
      </svg>
    );
  }

  if (size === "card") {
    // Head only (~144px width)
    return (
      <svg
        className={`abh-mascot abh-mascot-card ${className}`}
        width="144"
        height="120"
        viewBox="0 0 144 120"
        role={ariaHidden ? "presentation" : "img"}
        aria-hidden={ariaHidden}
        aria-label={ariaHidden ? undefined : alt}
        style={style}
      >
        {/* Monitor Body */}
        <rect
          x="14"
          y="10"
          width="116"
          height="88"
          rx="2"
          fill="var(--mascot-body)"
          stroke="var(--mascot-outline)"
          strokeWidth="3"
        />
        {/* Monitor Bezel Inset */}
        <rect x="22" y="18" width="100" height="72" fill="var(--mascot-bezel)" />
        {/* Monitor Screen */}
        <rect x="26" y="22" width="92" height="64" fill="var(--mascot-screen)" />
        {/* Screen Facial Pixels */}
        {renderScreenContent()}
        {/* Monitor Stand/Neck Base */}
        <rect
          x="58"
          y="98"
          width="28"
          height="10"
          fill="var(--mascot-neck)"
          stroke="var(--mascot-outline)"
          strokeWidth="2"
        />
        <rect
          x="42"
          y="108"
          width="60"
          height="8"
          fill="var(--mascot-body)"
          stroke="var(--mascot-outline)"
          strokeWidth="2"
        />
      </svg>
    );
  }

  // Hero size: full bust (~360px wide, ~340px tall)
  return (
    <svg
      className={`abh-mascot abh-mascot-hero ${className}`}
      width="360"
      height="340"
      viewBox="0 0 360 340"
      role={ariaHidden ? "presentation" : "img"}
      aria-hidden={ariaHidden}
      aria-label={ariaHidden ? undefined : alt}
      style={style}
    >
      {/* Upper Torso / Blazer & Shirt */}
      <g>
        {/* Blazer shoulders */}
        <path
          d="M 60 340 L 90 220 L 140 210 L 180 230 L 220 210 L 270 220 L 300 340 Z"
          fill="var(--mascot-blazer)"
          stroke="var(--mascot-outline)"
          strokeWidth="3"
        />
        {/* White shirt inner V */}
        <polygon
          points="144,210 180,270 216,210"
          fill="var(--mascot-shirt)"
          stroke="var(--mascot-outline)"
          strokeWidth="2"
        />
        {/* Neck */}
        <rect
          x="160"
          y="174"
          width="40"
          height="38"
          fill="var(--mascot-neck)"
          stroke="var(--mascot-outline)"
          strokeWidth="3"
        />
      </g>

      {/* Monitor Head (Center at x=180, y=100) */}
      <g transform="translate(108, 20)">
        {/* Monitor Outer Body */}
        <rect
          x="0"
          y="0"
          width="144"
          height="154"
          rx="2"
          fill="var(--mascot-body)"
          stroke="var(--mascot-outline)"
          strokeWidth="4"
        />
        {/* Top vent slits */}
        <line x1="28" y1="12" x2="116" y2="12" stroke="var(--mascot-neck)" strokeWidth="3" />
        <line x1="36" y1="18" x2="108" y2="18" stroke="var(--mascot-neck)" strokeWidth="3" />
        {/* Bezel frame */}
        <rect
          x="12"
          y="26"
          width="120"
          height="108"
          fill="var(--mascot-bezel)"
          stroke="var(--mascot-outline)"
          strokeWidth="2"
        />
        {/* Screen */}
        <rect x="16" y="30" width="112" height="100" fill="var(--mascot-screen)" />
        {/* Screen Content */}
        {renderScreenContent()}
        {/* Bottom knobs/badges */}
        <circle cx="120" cy="142" r="3" fill="var(--mascot-neck)" />
        <circle cx="130" cy="142" r="3" fill="var(--mascot-neck)" />
      </g>
    </svg>
  );
}

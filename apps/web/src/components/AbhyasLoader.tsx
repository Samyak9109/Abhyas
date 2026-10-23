// Brand pixel assembling preloader component.
import React from "react";

export interface AbhyasLoaderProps {
  label?: string;
  fullScreen?: boolean;
}

export const AbhyasLoader: React.FC<AbhyasLoaderProps> = ({
  label = "Loading Abhyas...",
  fullScreen = false,
}) => {
  return (
    <div
      className={`abh-loader-container ${fullScreen ? "abh-loader--fullscreen" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="ap-stage">
        <svg
          className="ap-mark"
          viewBox="0 0 70 70"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 0 }}
            x="20"
            y="0"
            width="30"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 1 }}
            x="10"
            y="10"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 2 }}
            x="40"
            y="10"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 3 }}
            x="0"
            y="20"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 4 }}
            x="50"
            y="20"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 5 }}
            x="0"
            y="30"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 6 }}
            x="50"
            y="30"
            width="20"
            height="10"
          />
          <rect className="ap-bar" x="0" y="40" width="70" height="10" />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 8 }}
            x="0"
            y="50"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 9 }}
            x="50"
            y="50"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 10 }}
            x="0"
            y="60"
            width="20"
            height="10"
          />
          <rect
            className="ap-px"
            style={{ ["--i" as unknown as string]: 11 }}
            x="50"
            y="60"
            width="20"
            height="10"
          />
        </svg>
        <div className="ap-word" aria-hidden="true">
          <span className="ap-word-text">abhyas</span>
          <span className="ap-cursor" />
        </div>
        <div className="ap-meter" aria-hidden="true">
          <span style={{ ["--s" as unknown as string]: 0 }} />
          <span style={{ ["--s" as unknown as string]: 1 }} />
          <span style={{ ["--s" as unknown as string]: 2 }} />
          <span style={{ ["--s" as unknown as string]: 3 }} />
          <span style={{ ["--s" as unknown as string]: 4 }} />
          <span style={{ ["--s" as unknown as string]: 5 }} />
          <span style={{ ["--s" as unknown as string]: 6 }} />
          <span style={{ ["--s" as unknown as string]: 7 }} />
        </div>
      </div>
    </div>
  );
};

// FR-010, FR-011, ADR-014: Subtitle lanes component.
// Displays live spoken text for both speakers in accessible, high-contrast lanes.
import type { SubtitleSize } from "@abhyas/core";

export interface SubtitleLanesProps {
  interviewerText?: string | undefined;
  candidateText?: string | undefined;
  isCandidateInterim?: boolean | undefined;
  size?: SubtitleSize | undefined;
  highContrast?: boolean | undefined;
  visible?: boolean | undefined;
  onToggleVisible?: (() => void) | undefined;
}

export function SubtitleLanes({
  interviewerText,
  candidateText,
  isCandidateInterim = false,
  size = "M",
  highContrast = false,
  visible = true,
  onToggleVisible,
}: SubtitleLanesProps) {
  if (!visible) {
    return (
      <div className="abh-subtitles-collapsed">
        {onToggleVisible && (
          <button
            type="button"
            className="abh-subtitles-toggle-btn"
            onClick={onToggleVisible}
            aria-label="Show live subtitles"
          >
            [ + Show Subtitles ]
          </button>
        )}
      </div>
    );
  }

  const sizeClass = `abh-subtitles--size-${size.toLowerCase()}`;
  const contrastClass = highContrast ? "abh-subtitles--high-contrast" : "";

  return (
    <section
      className={`abh-subtitles-container ${sizeClass} ${contrastClass}`}
      aria-label="Live interview subtitles"
    >
      <div className="abh-subtitles-header">
        <span className="abh-subtitles-title" id="subtitles-label">
          Live Subtitles
        </span>
        {onToggleVisible && (
          <button
            type="button"
            className="abh-subtitles-toggle-btn"
            onClick={onToggleVisible}
            aria-label="Hide live subtitles"
          >
            [ Hide ]
          </button>
        )}
      </div>

      <div className="abh-subtitles-lanes">
        {/* Interviewer Lane */}
        <div className="abh-subtitle-lane abh-subtitle-lane--interviewer" aria-live="polite">
          <span className="abh-subtitle-speaker">{"{ AI }"}</span>
          <p className="abh-subtitle-text">{interviewerText || "Waiting for question..."}</p>
        </div>

        {/* Candidate Lane */}
        <div className="abh-subtitle-lane abh-subtitle-lane--candidate" aria-live="polite">
          <span className="abh-subtitle-speaker">{"{ You }"}</span>
          <p
            className={`abh-subtitle-text ${
              isCandidateInterim ? "abh-subtitle-text--interim" : ""
            }`}
          >
            {candidateText || (
              <span className="abh-subtitle-placeholder">
                Push to talk or type your answer below...
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

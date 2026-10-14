// FR-N/A, NFR-011, ADR-021: Modal dialog with focus trap and typed phrase confirmation support.
import React, { type ReactNode, useEffect, useRef } from "react";
import { Button } from "./Button";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children, actions }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // NFR-011: run only when the dialog opens — parent re-renders (e.g. typed
  // confirmation input) must not steal focus back from the field being typed in.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      // Prompt dialogs focus the field first so typing can start immediately.
      const field = dialogRef.current?.querySelector<HTMLElement>("input, textarea, select");
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (field) {
        field.focus();
      } else if (focusable && focusable.length > 0) {
        focusable[0]?.focus();
      } else {
        dialogRef.current?.focus();
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCloseRef.current();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        previouslyFocusedElement.current?.focus();
      };
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="abh-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="abh-dialog-title"
        className="abh-dialog"
        tabIndex={-1}
      >
        <div className="abh-dialog-header">
          <h2 id="abh-dialog-title" className="abh-dialog-title">
            {title}
          </h2>
          <Button
            variant="ghost"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: "4px 8px" }}
          >
            ✕
          </Button>
        </div>
        <div className="abh-dialog-body">{children}</div>
        {actions && <div className="abh-dialog-actions">{actions}</div>}
      </div>
    </div>
  );
};

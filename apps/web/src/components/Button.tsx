// FR-N/A, NFR-011, ADR-021: Button primitive with all states and theme support.
import React, { type ButtonHTMLAttributes, type ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  isHero?: boolean;
  isLoading?: boolean;
  children: ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      isHero = false,
      isLoading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const classNames = ["abh-btn", `abh-btn--${variant}`, isHero ? "abh-btn--hero" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={props.type || "button"}
        className={classNames}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        aria-disabled={disabled || isLoading ? "true" : undefined}
        {...props}
      >
        {isLoading && <span className="abh-spinner" aria-hidden="true" />}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

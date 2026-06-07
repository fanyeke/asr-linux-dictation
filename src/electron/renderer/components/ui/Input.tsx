import { cn } from "../../lib/utils.js";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightElement, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--secondary-foreground)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              data-testid="input-left-icon"
            >
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-9 px-3 text-sm bg-[var(--background)] border border-[var(--input)] rounded-md text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
              "transition-all duration-150",
              "focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10",
              leftIcon && "pl-9",
              rightElement && "pr-9",
              error &&
                "border-red-500 focus:border-red-500 focus:ring-red-500/10",
              props.disabled && "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed",
              className,
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          {rightElement && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2"
              data-testid="input-right-element"
            >
              {rightElement}
            </span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-red-500" data-testid="input-error">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1 text-xs text-gray-500" data-testid="input-helper">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

import { cn } from "../../lib/utils.js";
import { type ReactNode } from "react";

export type BadgeVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral"
  | "recording"
  | "processing";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-[var(--success-bg)] text-[var(--success-text)]",
  error: "bg-[var(--error-bg)] text-[var(--error-text)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  info: "bg-[var(--info-bg)] text-[var(--info-text)]",
  neutral: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  recording: "bg-[var(--error-bg)] text-[var(--error-text)]",
  processing: "bg-[var(--brand-50)] text-[var(--brand-700)]",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-xs",
} as const;

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  pulse = false,
  className,
}: BadgeProps) {
  const showPulse = pulse || variant === "recording";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        variantStyles[variant],
        sizeStyles[size],
        dot && "gap-1.5",
        showPulse && "animate-pulse",
        className,
      )}
      data-testid="badge"
    >
      {(dot || variant === "recording") && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            variant === "recording"
              ? "bg-red-500"
              : variant === "success"
                ? "bg-green-500"
                : variant === "error"
                  ? "bg-red-500"
                  : variant === "warning"
                    ? "bg-amber-500"
                    : variant === "info"
                      ? "bg-blue-500"
                      : "bg-gray-500",
          )}
          data-testid="badge-dot"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

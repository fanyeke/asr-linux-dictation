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
  success: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-700",
  recording: "bg-red-100 text-red-700",
  processing: "bg-brand-100 text-brand-700",
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

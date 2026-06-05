import { cn } from "../../lib/utils.js";
import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  clickable?: boolean;
  padding?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const paddingStyles = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export function Card({
  children,
  className,
  hoverable = false,
  clickable = false,
  padding = "md",
  onClick,
}: CardProps) {
  const isInteractive = hoverable || clickable;

  return (
    <div
      className={cn(
        "bg-white border border-gray-200 rounded-lg shadow-card",
        paddingStyles[padding],
        isInteractive &&
          "hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200",
        clickable && "cursor-pointer",
        className,
      )}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

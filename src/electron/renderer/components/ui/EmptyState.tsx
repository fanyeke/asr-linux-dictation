import { cn } from "../../lib/utils.js";
import { type ReactNode } from "react";
import { FileQuestion } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const containerSizes = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-14 h-14",
} as const;

const iconSizes = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-7 h-7",
} as const;

const titleSizes = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
} as const;

const descriptionSizes = {
  sm: "text-xs",
  md: "text-xs",
  lg: "text-sm",
} as const;

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        className,
      )}
      data-testid="empty-state"
    >
      <div
        className={cn(
          "rounded-full bg-gray-100 flex items-center justify-center",
          containerSizes[size],
        )}
      >
        {icon ?? (
          <FileQuestion
            className={cn("text-brand-500", iconSizes[size])}
            data-testid="empty-state-default-icon"
          />
        )}
      </div>
      <h3
        className={cn(
          "text-dark-900 font-semibold mt-3",
          titleSizes[size],
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-gray-500 max-w-[280px] mt-1",
            descriptionSizes[size],
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

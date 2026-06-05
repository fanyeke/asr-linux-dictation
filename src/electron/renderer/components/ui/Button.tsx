import { cn } from "../../lib/utils.js";
import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary: "bg-white text-dark-700 border border-gray-200 hover:bg-gray-50",
  ghost: "bg-transparent text-dark-600 hover:bg-gray-100",
  danger: "bg-red-500 text-white hover:bg-red-600",
  icon: "bg-transparent text-gray-500 hover:bg-gray-100",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-sm",
};

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 p-2 text-xs",
  md: "h-9 p-2 text-sm",
  lg: "h-10 p-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isIcon = variant === "icon";

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium",
          "transition-all duration-150 ease-in-out",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
          variantStyles[variant],
          isIcon ? iconSizeStyles[size] : sizeStyles[size],
          isIcon ? "rounded-full" : "rounded-md",
          (disabled || isLoading) && "opacity-50 cursor-not-allowed",
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" data-testid="button-loading-icon" />
        ) : (
          leftIcon
        )}
        {!isIcon && children}
        {!isLoading && !isIcon && rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";

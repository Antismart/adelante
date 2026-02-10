import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-300 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2 border rounded-lg bg-surface-2 text-neutral-50 placeholder-neutral-500",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50",
            "disabled:bg-surface-1 disabled:text-neutral-500 disabled:cursor-not-allowed",
            error
              ? "border-danger-500/50 focus:ring-danger-500/40"
              : "border-neutral-700",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger-500">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-sm text-neutral-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

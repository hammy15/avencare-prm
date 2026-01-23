"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, ...props }, ref) => {
    const id = React.useId()

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-surface-700 dark:text-surface-300"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={id}
          className={cn(
            "neu-input",
            error && "ring-2 ring-rose-500/50",
            className
          )}
          ref={ref}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-surface-500">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-rose-500 animate-fade-in">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
